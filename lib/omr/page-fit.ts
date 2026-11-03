import { solveLinear } from "./geometry";
import type { GrayImage, OmrChoiceGroup, OmrTemplate, Point } from "./types";

/**
 * Paper is rarely flat. Held in a hand, lying on a soft or slatted surface, or curling at the
 * edges, it bends, and the four corner squares alone then place mid-page bubbles several
 * millimetres off — and not by the same amount across the page: a sheet curling toward the hand
 * squeezes the bubbles nearest that edge the most.
 *
 * So after the corner squares, every bubble is looked for where its printed circle actually is:
 *   1. each question's circles are found near where the corners put them (quickLook, coarseAlign),
 *      and finds that disagree with their neighbours are set aside — this also tells the right
 *      orientation and the right corner squares from wrong ones;
 *   2. every bubble is searched for, a smooth correction is fitted through the bubbles found
 *      (dropping any that do not fit), and the search is repeated closer each time (fitPage);
 *   3. the student-number rows are placed last, as one pattern (settleNumberGrid).
 * Positions stay in template millimetres; the reader maps them through the corner homography.
 */

/** Millimetres of photo kept around the marker frame for the quick search. */
const MARGIN = 8;
/** How far (mm) a question may sit from where the corner squares put it. */
const REACH = 7;
/** A find this far (mm) from what its neighbours predict does not agree with them. */
const AGREE_MM = 3;
/** Interpolation softening (mm) for the agreement check: finds closer than this weigh about the same. */
const SOFTEN = 25;
/** How much the corner squares (always exactly placed) count, against a clear question find (≈0.3–0.5). */
const CORNER_WEIGHT = 0.4;
/**
 * A bubble whose printed circle is found at least this share of the sheet's typical find is trusted,
 * and shapes the correction (a blurred photo lowers every find alike). Never below FOUND_FLOOR.
 */
const FOUND_SHARE = 0.45;
const FOUND_FLOOR = 0.04;
/** A find at least this share of the typical one is kept even where the smooth correction disagrees. */
const CLEAR_SHARE = 0.9;
/** First pass: how far (mm) a bubble may be searched, capped so the search never nears another bubble of its question. */
const FIRST_REACH = 8;
const SPACING_SHARE = 0.4;
/** Later passes search around the fitted correction, closer each time. */
const SECOND_REACH = 2;
const LAST_REACH = 1;
/** Reach of the local correction (mm): anchors this far away count about 60 % as much as one right here. */
const SIGMA = 25;
/** Weight of "no correction" at every point: an anchor ~70 mm away counts about as much. */
const PRIOR_WEIGHT = 0.01;
/** An anchor this far (mm) from the correction fitted through the others is dropped — unless its circle was found clearly. */
const MISFIT_MM = 2.5;
/** Reach (mm) of the number grid's search around the correction near it. */
const GRID_SEARCH = 4.5;
/** Tilts tried for the number rows (mm per mm along the row): up to ~3.5 mm over the 50 mm ones row. */
const GRID_TILTS = Array.from({ length: 13 }, (_, i) => (i - 6) * 0.0125);
/** A tilted grid is used only when its circles line up at least this much (share) better than level. */
const GRID_TILT_GAIN = 0.15;

// ─── Sampling ────────────────────────────────────────────────────────────────

/** Brightness at a template point (mm). */
type Lookup = (x: number, y: number) => number;

/** Samples the photo itself at template millimetres, through the corner homography (full detail). */
function photoLookup(gray: GrayImage, homography: number[]): Lookup {
  const { width, height, data } = gray;
  const [a, b, c, d, e, f, g, k, l] = homography;
  return (x, y) => {
    const den = g * x + k * y + l;
    const px = (a * x + b * y + c) / den;
    const py = (d * x + e * y + f) / den;
    if (!(px >= 0 && py >= 0 && px <= width - 1 && py <= height - 1)) return 255;
    const x0 = Math.floor(px);
    const y0 = Math.floor(py);
    const x1 = x0 + 1 < width ? x0 + 1 : x0;
    const y1 = y0 + 1 < height ? y0 + 1 : y0;
    const fx = px - x0;
    const fy = py - y0;
    const r0 = y0 * width;
    const r1 = y1 * width;
    const top = data[r0 + x0] + (data[r0 + x1] - data[r0 + x0]) * fx;
    const bottom = data[r1 + x0] + (data[r1 + x1] - data[r1 + x0]) * fx;
    return top + (bottom - top) * fy;
  };
}

/**
 * The page resampled onto the template grid (2 px/mm) and softened, so a 1 mm search step cannot
 * step over a thin outline. `gray` should be a box-downscaled copy of the photo (`homography`
 * mapping into it), so thin outlines survive the resampling as grey instead of falling between samples.
 */
function softLookup(gray: GrayImage, homography: number[], template: OmrTemplate): Lookup {
  const ppm = 2;
  const w = Math.ceil((template.width + 2 * MARGIN) * ppm);
  const h = Math.ceil((template.height + 2 * MARGIN) * ppm);
  const raw = new Float32Array(w * h);
  const { width, height, data } = gray;
  const [a, b, c, d, e, f, g, k, l] = homography;
  const step = 1 / ppm;
  for (let y = 0; y < h; y++) {
    const ty = y * step - MARGIN;
    const tx0 = -MARGIN;
    // Numerators and denominator move linearly along a row.
    let nx = a * tx0 + b * ty + c;
    let ny = d * tx0 + e * ty + f;
    let den = g * tx0 + k * ty + l;
    const sx = a * step;
    const sy = d * step;
    const sd = g * step;
    const row = y * w;
    for (let x = 0; x < w; x++, nx += sx, ny += sy, den += sd) {
      const px = nx / den;
      const py = ny / den;
      if (!(px >= 0 && py >= 0 && px <= width - 1 && py <= height - 1)) {
        raw[row + x] = 255;
        continue;
      }
      const x0 = px | 0;
      const y0 = py | 0;
      const x1 = x0 + 1 < width ? x0 + 1 : x0;
      const r0 = y0 * width;
      const r1 = (y0 + 1 < height ? y0 + 1 : y0) * width;
      const fx = px - x0;
      const top = data[r0 + x0] + (data[r0 + x1] - data[r0 + x0]) * fx;
      const bottom = data[r1 + x0] + (data[r1 + x1] - data[r1 + x0]) * fx;
      raw[row + x] = top + (bottom - top) * (py - y0);
    }
  }
  const tmp = new Float32Array(w * h);
  const soft = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      tmp[row + x] = (raw[row + (x > 0 ? x - 1 : x)] + raw[row + x] + raw[row + (x < w - 1 ? x + 1 : x)]) / 3;
    }
  }
  for (let y = 0; y < h; y++) {
    const up = (y > 0 ? y - 1 : y) * w;
    const down = (y < h - 1 ? y + 1 : y) * w;
    for (let x = 0; x < w; x++) soft[y * w + x] = (tmp[up + x] + tmp[y * w + x] + tmp[down + x]) / 3;
  }
  return (x, y) => {
    const px = (x + MARGIN) * ppm;
    const py = (y + MARGIN) * ppm;
    if (!(px >= 0 && py >= 0 && px <= w - 1 && py <= h - 1)) return 255;
    const x0 = Math.floor(px);
    const y0 = Math.floor(py);
    const x1 = x0 + 1 < w ? x0 + 1 : x0;
    const y1 = y0 + 1 < h ? y0 + 1 : y0;
    const fx = px - x0;
    const fy = py - y0;
    const top = soft[y0 * w + x0] + (soft[y0 * w + x1] - soft[y0 * w + x0]) * fx;
    const bottom = soft[y1 * w + x0] + (soft[y1 * w + x1] - soft[y1 * w + x0]) * fx;
    return top + (bottom - top) * fy;
  };
}

const RING_COS = Array.from({ length: 16 }, (_, i) => Math.cos((2 * Math.PI * i) / 16));
const RING_SIN = Array.from({ length: 16 }, (_, i) => Math.sin((2 * Math.PI * i) / 16));

const RING_VALUES = new Float64Array(16);

/**
 * The brighter half of a ring of 16 samples. Around a circle it is the paper level (neighbouring
 * option text does not lower it); on the circle it is dark only when the whole ring is dark — a
 * printed outline is, a pen stroke crossing the ring is not.
 */
function ringBrightHalf(at: Lookup, cx: number, cy: number, radius: number) {
  let mean = 0;
  for (let i = 0; i < 16; i++) {
    const v = at(cx + radius * RING_COS[i], cy + radius * RING_SIN[i]);
    RING_VALUES[i] = v;
    mean += v;
  }
  mean /= 16;
  let sum = 0;
  let count = 0;
  for (let i = 0; i < 16; i++) {
    if (RING_VALUES[i] >= mean) {
      sum += RING_VALUES[i];
      count++;
    }
  }
  return count ? sum / count : mean;
}

const paperAround = ringBrightHalf;

/**
 * How clearly a printed circle of `radius` sits at (cx, cy): the darkest of a few rings near the
 * radius (each judged by its brighter half, so it must be dark all round) against the paper just
 * outside (0 = nothing). `fine` looks at three rings; otherwise one (enough on the softened page).
 */
function circleScore(at: Lookup, cx: number, cy: number, radius: number, fine: boolean, paperLevel?: number) {
  const paper = paperLevel ?? paperAround(at, cx, cy, radius * 1.5);
  if (paper < 20) return 0;
  let darkest = ringBrightHalf(at, cx, cy, radius);
  if (fine) darkest = Math.min(darkest, ringBrightHalf(at, cx, cy, radius * 0.9), ringBrightHalf(at, cx, cy, radius * 1.1));
  return darkest < paper ? (paper - darkest) / paper : 0;
}

function groupScore(at: Lookup, group: OmrChoiceGroup, radius: number, dx: number, dy: number, fine: boolean) {
  let sum = 0;
  for (const b of group.bubbles) sum += circleScore(at, b.x + dx, b.y + dy, radius, fine);
  return sum / group.bubbles.length;
}

type Find = { d: Point; score: number };

/** Best group offset within ±`reach` of `from`, stepping `step` mm. */
function search(at: Lookup, group: OmrChoiceGroup, radius: number, from: Point, reach: number, step: number, fine: boolean): Find {
  let best: Find = { d: from, score: -1 };
  const n = Math.round(reach / step);
  for (let j = -n; j <= n; j++) {
    for (let i = -n; i <= n; i++) {
      const dx = from.x + i * step;
      const dy = from.y + j * step;
      const score = groupScore(at, group, radius, dx, dy, fine);
      if (score > best.score) best = { d: { x: dx, y: dy }, score };
    }
  }
  return best;
}

/** The strongest few separate group offsets on the softened page (a group can half-match a neighbouring row). */
function peaks(soft: Lookup, group: OmrChoiceGroup, radius: number, box: Box, keep: number): Find[] {
  const all: Find[] = [];
  const nx = Math.floor(box.x);
  const ny = Math.floor(box.y);
  for (let j = -ny; j <= ny; j++) {
    for (let i = -nx; i <= nx; i++) all.push({ d: { x: i, y: j }, score: groupScore(soft, group, radius, i, j, false) });
  }
  all.sort((p, q) => q.score - p.score);
  const kept: Find[] = [];
  for (const f of all) {
    if (kept.every((k) => Math.hypot(k.d.x - f.d.x, k.d.y - f.d.y) >= 2.5)) kept.push(f);
    if (kept.length >= keep) break;
  }
  return kept;
}

function centreOf(group: OmrChoiceGroup): Point {
  const n = group.bubbles.length;
  return {
    x: group.bubbles.reduce((sum, b) => sum + b.x, 0) / n,
    y: group.bubbles.reduce((sum, b) => sum + b.y, 0) / n,
  };
}

// ─── How far a search may go ─────────────────────────────────────────────────

type Box = { x: number; y: number };

/**
 * Half-widths (mm) of a search box around `p` that never comes within 60 % of the way to any of
 * `others` (other printed bubbles), capped at `cap`. A bubble in the same row limits the box along
 * the row; one in the same column, across it; one off to the side, along whichever way it is farther.
 */
function safeBox(p: Point, others: Point[], cap: number, band: number): Box {
  let rx = cap;
  let ry = cap;
  const near = others
    .map((o) => ({ dx: Math.abs(o.x - p.x), dy: Math.abs(o.y - p.y) }))
    .filter((o) => o.dx > 1e-6 || o.dy > 1e-6)
    .sort((a, b) => Math.hypot(a.dx, a.dy) - Math.hypot(b.dx, b.dy));
  for (const { dx, dy } of near) {
    if (rx <= SPACING_SHARE * dx || ry <= SPACING_SHARE * dy) continue;
    if (dy < band) rx = SPACING_SHARE * dx;
    else if (dx < band) ry = SPACING_SHARE * dy;
    else if (dx >= dy) rx = SPACING_SHARE * dx;
    else ry = SPACING_SHARE * dy;
  }
  return { x: rx, y: ry };
}

/** Every printed bubble of the template (questions and student number). */
function allBubbles(template: OmrTemplate): Point[] {
  const code = template.studentCode ? [...template.studentCode.ones.bubbles, ...template.studentCode.tens.bubbles] : [];
  return [...template.questions.flatMap((g) => g.bubbles), ...code];
}

/** How far a whole group may shift without any of its bubbles nearing another group's bubble. */
function groupBox(group: OmrChoiceGroup, template: OmrTemplate, cap: number): Box {
  const own = new Set(group.bubbles);
  const others = allBubbles(template).filter((b) => !own.has(b));
  const band = 2 * (group.radius ?? template.bubbleRadius);
  let x = cap;
  let y = cap;
  for (const b of group.bubbles) {
    const box = safeBox(b, others, cap, band);
    x = Math.min(x, box.x);
    y = Math.min(y, box.y);
  }
  return { x, y };
}

// ─── Corrections ─────────────────────────────────────────────────────────────

/** Anchors of the correction: template point, its offset (mm), and how much it counts. */
export type Field = Array<{ x: number; y: number; dx: number; dy: number; w: number }>;

/** Offset (mm) at a template point, averaged from the anchors (nearer anchors count more). */
export function fieldAt(field: Field, p: Point): Point {
  let sx = 0;
  let sy = 0;
  let sw = 0;
  for (const a of field) {
    if (a.w <= 0) continue;
    const w = a.w / ((a.x - p.x) ** 2 + (a.y - p.y) ** 2 + SOFTEN * SOFTEN);
    sx += w * a.dx;
    sy += w * a.dy;
    sw += w;
  }
  return sw > 0 ? { x: sx / sw, y: sy / sw } : { x: 0, y: 0 };
}

/**
 * The correction at a point: a plane fitted through the nearby anchors' offsets (moving least
 * squares), so it follows a sheet that bends more and more toward one edge, and leans toward a
 * flat correction where anchors are few.
 */
export function warpAt(anchors: Field, p: Point, skip = -1): Point {
  // The corner homography itself (no offset) is the default: far from every anchor, it decides.
  const m = [[PRIOR_WEIGHT, 0, 0], [0, 0, 0], [0, 0, 0]];
  const rx = [0, 0, 0];
  const ry = [0, 0, 0];
  let sw = PRIOR_WEIGHT;
  for (let n = 0; n < anchors.length; n++) {
    const a = anchors[n];
    if (a.w <= 0 || n === skip) continue;
    const d2 = (a.x - p.x) ** 2 + (a.y - p.y) ** 2;
    const w = a.w * (Math.exp(-d2 / (2 * SIGMA * SIGMA)) + 1e-4);
    const v = [1, (a.x - p.x) / SIGMA, (a.y - p.y) / SIGMA];
    for (let i = 0; i < 3; i++) {
      rx[i] += w * v[i] * a.dx;
      ry[i] += w * v[i] * a.dy;
      for (let j = 0; j < 3; j++) m[i][j] += w * v[i] * v[j];
    }
    sw += w;
  }
  m[1][1] += 0.1 * sw;
  m[2][2] += 0.1 * sw;
  const fx = solveLinear(m.map((row) => [...row]), rx);
  const fy = solveLinear(m.map((row) => [...row]), ry);
  if (!fx || !fy) return fieldAt(anchors, p);
  return { x: fx[0], y: fy[0] };
}

function cornerAnchors(template: OmrTemplate): Field {
  return [
    { x: 0, y: 0 },
    { x: template.width, y: 0 },
    { x: template.width, y: template.height },
    { x: 0, y: template.height },
  ].map((p) => ({ ...p, dx: 0, dy: 0, w: CORNER_WEIGHT }));
}

/** Does each find agree with what the corners and the other finds predict for it? */
function agreement(template: OmrTemplate, finds: Find[]): boolean[] {
  const centres = template.questions.map(centreOf);
  const anchors: Field = finds.map((f, i) => ({ ...centres[i], dx: f.d.x, dy: f.d.y, w: Math.max(0, f.score) }));
  const corners = cornerAnchors(template);
  return finds.map((f, i) => {
    const predicted = fieldAt([...corners, ...anchors.filter((_, j) => j !== i)], centres[i]);
    return Math.hypot(predicted.x - f.d.x, predicted.y - f.d.y) <= AGREE_MM;
  });
}

// ─── 1. Orientation and corner squares ───────────────────────────────────────

export type QuickLook = {
  /** Candidate finds per question on the softened page, strongest first. */
  peaks: Find[][];
  /** How clearly the question circles were found, counting only finds that agree with their neighbours. */
  score: number;
  soft: Lookup;
};

/**
 * Cheap first look at one homography, to rank corner-square frames and orientations. `turnedFrom`
 * is the look at the same four squares turned half round: its softened page, read upside down,
 * is this one's.
 */
export function quickLook(
  small: { image: GrayImage; scale: number },
  homography: number[],
  template: OmrTemplate,
  turnedFrom?: QuickLook
): QuickLook {
  const base = turnedFrom?.soft;
  const s = small.scale;
  const toSmall = homography.map((v, i) => (i < 6 ? v * s : v));
  const soft: Lookup = base ? (x, y) => base(template.width - x, template.height - y) : softLookup(small.image, toSmall, template);
  const radius = template.bubbleRadius;
  const found = template.questions.map((group) => peaks(soft, group, radius, groupBox(group, template, REACH), 3));
  const best = found.map((p) => p[0] ?? { d: { x: 0, y: 0 }, score: 0 });
  const agrees = agreement(template, best);
  const score = best.reduce((sum, f, i) => sum + (agrees[i] ? f.score : 0), 0) / Math.max(1, best.length);
  return { peaks: found, score, soft };
}

export type CoarseAlignment = {
  /** 0–1-ish: how clearly the question circles were found, counting only finds that agree with their neighbours. */
  score: number;
  finds: Find[];
  agrees: boolean[];
  soft: Lookup;
};

/**
 * Closer look at a promising homography: each question's candidate finds are measured precisely on
 * the photo and checked against what the other finds predict. Turned the wrong way, or with a wrong
 * corner square, finds are weak and disagree.
 */
export function coarseAlign(gray: GrayImage, homography: number[], template: OmrTemplate, quick: QuickLook): CoarseAlignment {
  const photo = photoLookup(gray, homography);
  const radius = template.bubbleRadius;
  const finds = template.questions.map((group, i) => {
    let best: Find = { d: { x: 0, y: 0 }, score: 0 };
    for (const peak of quick.peaks[i]) {
      const wide = search(photo, group, radius, peak.d, 0.5, 0.5, true);
      const found = search(photo, group, radius, wide.d, 0.25, 0.25, true);
      if (found.score > best.score) best = found;
    }
    return best;
  });
  const agrees = agreement(template, finds);
  const score = finds.reduce((sum, f, i) => sum + (agrees[i] ? f.score : 0), 0) / Math.max(1, finds.length);
  return { score, finds, agrees, soft: quick.soft };
}

// ─── 2. Every bubble ─────────────────────────────────────────────────────────

export type PageFit = {
  field: Field;
  /** Where every question's bubbles finally sit (template mm, to map with the corner homography), in template order. */
  questions: Point[][];
  /** The same for the student-number rows, when the template has them. */
  code?: { ones: Point[]; tens: Point[] };
  /** Share of questions whose first find agreed with the rest of the page (0–1). */
  agreement: number;
};

type Settled = { p: Point; score: number };

/** Best circle position near `centre` on the photo: a box search of ±`reachX` × ±`reachY` mm, then a fine finish. */
function settleAt(photo: Lookup, centre: Point, radius: number, reachX: number, reachY: number, soft?: Lookup): Settled {
  let origin = centre;
  let rx = reachX;
  let ry = reachY;
  if (soft && Math.max(reachX, reachY) > 1.5) {
    // Wide: whole millimetres on the softened page first.
    const paper = paperAround(soft, centre.x, centre.y, radius * 1.5);
    let best = -1;
    const nx = Math.floor(reachX);
    const ny = Math.floor(reachY);
    for (let j = -ny; j <= ny; j++) {
      for (let i = -nx; i <= nx; i++) {
        const score = circleScore(soft, centre.x + i, centre.y + j, radius, false, paper);
        if (score > best) {
          best = score;
          origin = { x: centre.x + i, y: centre.y + j };
        }
      }
    }
    rx = 0.5;
    ry = 0.5;
  }
  const paper = paperAround(photo, origin.x, origin.y, radius * 1.5);
  let best: Settled = { p: origin, score: -1 };
  const scan = (from: Point, hx: number, hy: number, step: number) => {
    const nx = Math.round(hx / step);
    const ny = Math.round(hy / step);
    for (let j = -ny; j <= ny; j++) {
      for (let i = -nx; i <= nx; i++) {
        const x = from.x + i * step;
        const y = from.y + j * step;
        const score = circleScore(photo, x, y, radius, true, paper);
        if (score > best.score) best = { p: { x, y }, score };
      }
    }
  };
  if (Math.max(rx, ry) > 1) {
    scan(origin, rx, ry, 0.5);
    scan(best.p, 0.25, 0.25, 0.25);
  } else {
    scan(origin, rx, ry, 0.25);
  }
  return best;
}

/** How far each bubble of a group may be searched without nearing any other printed bubble. */
function reaches(group: OmrChoiceGroup, template: OmrTemplate, cap: number): Box[] {
  const all = allBubbles(template);
  const band = 2 * (group.radius ?? template.bubbleRadius);
  return group.bubbles.map((b) => safeBox(b, all, cap, band));
}

/** Drops anchors that the correction through the others misses by more than MISFIT_MM (two rounds), sparing clear finds. */
function pruneMisfits(anchors: Field, fixed: number, clear: number) {
  for (let round = 0; round < 2; round++) {
    const misfits: number[] = [];
    anchors.forEach((a, i) => {
      if (i < fixed || a.w <= 0 || a.w >= clear) return;
      const predicted = warpAt(anchors, a, i);
      if (Math.hypot(predicted.x - a.dx, predicted.y - a.dy) > MISFIT_MM) misfits.push(i);
    });
    if (!misfits.length) return;
    for (const i of misfits) anchors[i] = { ...anchors[i], w: 0 };
  }
}

/**
 * Settles every bubble on its printed circle, in three passes: a wide search from each question's own
 * find (or, if it disagreed, from the questions that agreed), a correction fitted through the bubbles
 * found (dropping finds that do not fit), then closer searches around that correction. The
 * student-number rows come last, from the correction near them.
 */
export function fitPage(gray: GrayImage, homography: number[], template: OmrTemplate, coarse: CoarseAlignment): PageFit {
  const photo = photoLookup(gray, homography);
  const radius = template.bubbleRadius;
  const corners = cornerAnchors(template);
  const groups = template.questions;

  const start: Field = [
    ...corners,
    ...groups.map((g, i) => ({ ...centreOf(g), dx: coarse.finds[i].d.x, dy: coarse.finds[i].d.y, w: coarse.agrees[i] ? coarse.finds[i].score : 0 })),
  ];
  let positions = groups.map((g, i) => {
    const o = coarse.agrees[i] ? coarse.finds[i].d : warpAt(start, centreOf(g));
    const limits = reaches(g, template, FIRST_REACH);
    return g.bubbles.map((b, j) => settleAt(photo, { x: b.x + o.x, y: b.y + o.y }, radius, limits[j].x, limits[j].y, coarse.soft));
  });

  const scores = positions.flat().map((s) => s.score).sort((a, b) => a - b);
  const typical = scores[Math.floor(scores.length / 2)] ?? 0;
  const foundScore = Math.max(FOUND_FLOOR, FOUND_SHARE * typical);
  const clearScore = Math.max(foundScore * 1.5, CLEAR_SHARE * typical);

  const anchorsFrom = (found: Settled[][]): Field => {
    const anchors: Field = [...corners];
    found.forEach((settled, i) =>
      settled.forEach((s, j) => {
        const b = groups[i].bubbles[j];
        if (s.score >= foundScore) anchors.push({ ...b, dx: s.p.x - b.x, dy: s.p.y - b.y, w: s.score });
      })
    );
    pruneMisfits(anchors, corners.length, clearScore);
    return anchors;
  };

  let anchors = anchorsFrom(positions);
  for (const reach of [SECOND_REACH, LAST_REACH]) {
    const field = anchors;
    const before = positions;
    positions = groups.map((g, i) => {
      const limits = reaches(g, template, reach);
      return g.bubbles.map((b, j) => {
        const o = warpAt(field, b);
        const centre = { x: b.x + o.x, y: b.y + o.y };
        const found = settleAt(photo, centre, radius, limits[j].x, limits[j].y);
        // Keep an earlier, clearer find: the smooth correction cannot follow every sharp bend.
        if (before[i][j].score > found.score) return before[i][j];
        return found.score >= foundScore ? found : { p: centre, score: found.score };
      });
    });
    anchors = anchorsFrom(positions);
  }

  const grid = template.studentCode ? settleNumberGrid(photo, coarse.soft, template, anchors) : undefined;
  const agreed = coarse.agrees.filter(Boolean).length / Math.max(1, coarse.agrees.length);
  return {
    field: grid ? [...anchors, ...grid.anchors] : anchors,
    questions: positions.map((settled) => settled.map((s) => s.p)),
    code: grid ? { ones: grid.ones, tens: grid.tens } : undefined,
    agreement: agreed,
  };
}

// ─── 3. Student number ───────────────────────────────────────────────────────

/**
 * The student-number rows are a run of identical circles: shifted by one circle, a row still lines
 * up almost everywhere. So both rows are placed together, and the spots just past the ends of each
 * row — where nothing is printed — must stay empty: a shift by one circle puts a circle there.
 */
function settleNumberGrid(photo: Lookup, soft: Lookup, template: OmrTemplate, anchors: Field) {
  const grid = template.studentCode!;
  const radius = template.bubbleRadius;
  const rows = [grid.ones, grid.tens];
  const radii = rows.map((row) => row.radius ?? radius);
  const ends: Array<{ p: Point; r: number }> = [];
  rows.forEach((row, k) => {
    const xs = row.bubbles.map((b) => b.x);
    const y = row.bubbles[0].y;
    const step = row.bubbles.length > 1 ? Math.abs(row.bubbles[1].x - row.bubbles[0].x) : 0;
    if (!step) return;
    for (const x of [Math.min(...xs) - step, Math.max(...xs) + step]) {
      const taken = rows.some((other) => other.bubbles.some((b) => Math.hypot(b.x - x, b.y - y) < 1));
      if (!taken) ends.push({ p: { x, y }, r: radii[k] });
    }
  });
  const all = rows.flatMap((row, k) => row.bubbles.map((b) => ({ p: b, r: radii[k] })));
  const centre = { x: all.reduce((sum, b) => sum + b.p.x, 0) / all.length, y: all.reduce((sum, b) => sum + b.p.y, 0) / all.length };
  // `tilt`: mm the rows rise per mm along them (paper bent in the hand turns the rows a little).
  const score = (at: Lookup, dx: number, dy: number, tilt: number, fine: boolean) => {
    let on = 0;
    for (const b of all) on += circleScore(at, b.p.x + dx, b.p.y + dy + tilt * (b.p.x - centre.x), b.r, fine);
    let off = 0;
    for (const e of ends) off += Math.max(0, circleScore(at, e.p.x + dx, e.p.y + dy + tilt * (e.p.x - centre.x), e.r, fine) - 0.1);
    return on / all.length - (ends.length ? off / ends.length : 0);
  };
  const scan = (at: Lookup, origin: Point, reach: number, step: number, tilts: number[], fine: boolean) => {
    const n = Math.round(reach / step);
    let best = { p: origin, tilt: 0, value: -Infinity };
    for (const tilt of tilts) {
      for (let j = -n; j <= n; j++) {
        for (let i = -n; i <= n; i++) {
          const x = origin.x + i * step;
          const y = origin.y + j * step;
          const value = score(at, x, y, tilt, fine);
          if (value > best.value) best = { p: { x, y }, tilt, value };
        }
      }
    }
    return best;
  };
  const gridGroup: OmrChoiceGroup = { key: "grid", options: [], bubbles: all.map((b) => b.p), radius: radii[0] };
  const reach = Math.min(GRID_SEARCH, ...Object.values(groupBox(gridGroup, template, GRID_SEARCH)));
  const rough = scan(soft, scan(soft, warpAt(anchors, centre), reach, 1, [0], false).p, 0.5, 0.5, [0], false).p;
  const level = scan(photo, rough, 0.5, 0.25, [0], true);
  const tilted = scan(photo, rough, 0.5, 0.25, GRID_TILTS, true);
  const { p: offset, tilt } = tilted.value > level.value * (1 + GRID_TILT_GAIN) ? tilted : level;
  const settle = (row: OmrChoiceGroup, r: number) =>
    row.bubbles.map((b) => settleAt(photo, { x: b.x + offset.x, y: b.y + offset.y + tilt * (b.x - centre.x) }, r, 0.75, 0.75));
  const ones = settle(grid.ones, radii[0]);
  const tens = settle(grid.tens, radii[1]);
  // The grid also tells the correction near the top of the sheet (where the class QR is).
  const gridAnchors: Field = [];
  [...grid.ones.bubbles, ...grid.tens.bubbles].forEach((b, i) => {
    const s = i < ones.length ? ones[i] : tens[i - ones.length];
    if (s.score > 0) gridAnchors.push({ ...b, dx: s.p.x - b.x, dy: s.p.y - b.y, w: s.score });
  });
  return { ones: ones.map((s) => s.p), tens: tens.map((s) => s.p), anchors: gridAnchors };
}

/**
 * How clearly a printed circle of `radius` (mm) sits at each template point on the photo: the same
 * complete-ring measure the page fit uses, so a bubble measured in the wrong place scores near 0.
 */
export function circleScorer(gray: GrayImage, homography: number[]) {
  const photo = photoLookup(gray, homography);
  return (p: Point, radius: number) => circleScore(photo, p.x, p.y, radius, true);
}

/** The homography that also applies a constant template offset `d` (mm): photo = H(p + d). */
export function shiftHomography(h: number[], d: Point): number[] {
  return [
    h[0], h[1], h[0] * d.x + h[1] * d.y + h[2],
    h[3], h[4], h[3] * d.x + h[4] * d.y + h[5],
    h[6], h[7], h[6] * d.x + h[7] * d.y + h[8],
  ];
}
