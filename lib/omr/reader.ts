import { applyHomography, distance, isConvex, orderClockwise, polygonArea, solveHomography } from "./geometry";
import { adaptiveDarkMask, connectedComponents, downscale, sample, toGray, type Blob } from "./image";
import { coarseAlign, fieldAt, fitPage, quickLook, shiftHomography, type CoarseAlignment, type QuickLook } from "./page-fit";
import type {
  BubbleDecision,
  GrayImage,
  GroupReading,
  OmrChoiceGroup,
  OmrReading,
  OmrTemplate,
  Point,
  RgbaImage,
} from "./types";

/**
 * Reads a photographed Dala answer sheet without any AI:
 *   1. find the four corner squares,
 *   2. map the template onto the photo,
 *   3. measure how much of each bubble is shaded, and
 *   4. accept an answer only when one bubble is clearly shaded and the others clearly are not.
 * Anything in between is returned as "unclear" so the teacher decides — the reader never guesses.
 */

/** A bubble counts as shaded above this share of dark inside, and as empty below EMPTY. */
export const FILLED = 0.45;
export const EMPTY = 0.2;
/** Below this, a bubble is treated as untouched paper. */
export const FAINT = 0.1;
/** A bubble whose average darkness is this much above its row's typical bubble is never called blank. */
export const SHADE_STANDOUT = 0.05;
/** A pixel is "dark" when it is below this fraction of the local paper brightness. */
const DARK_RATIO = 0.68;

const DETECT_SIDE = 1000;
/** Marker frames checked against the printed circles (a shaded bubble can pass for a corner square). */
const FRAMES_TO_CHECK = 6;
/** A frame whose quick look finds the question circles this clearly (and clearly better than turned around) ends the search. */
const CLEAR_LOOK = 0.1;
/** Frames × orientations given a closer look after the quick one. */
const CLOSER_LOOKS = 3;
/** Below this, the question circles were not found near where any frame put them. */
const PAGE_FOUND = 0.05;
/** The right orientation must line up this much better than the page turned around. */
const ORIENTATION_MARGIN = 0.03;
/** Share of questions that must agree with one smooth correction across the page. */
const MIN_AGREEMENT = 0.6;
const MIN_FRAME_SHARE = 0.08;

const MESSAGES: Record<Exclude<OmrReading, { ok: true }>["reason"], string> = {
  markers_not_found: "لم تظهر المربعات السوداء الأربعة. صوّر الورقة كاملة من الأعلى وفي إضاءة جيدة.",
  orientation_unknown: "تعذّر تحديد اتجاه الورقة. صوّرها مستقيمة وأعد المحاولة.",
  alignment_failed: "الصورة غير واضحة بما يكفي لقراءة الدوائر. أعد التصوير دون ظل أو اهتزاز.",
  wrong_sheet: "هذه الورقة ليست ورقة هذا الاختبار. تأكد أنك تصحح الاختبار الصحيح.",
};

function fail(reason: Exclude<OmrReading, { ok: true }>["reason"]): OmrReading {
  return { ok: false, reason, message: MESSAGES[reason] };
}

function isGray(image: RgbaImage | GrayImage): image is GrayImage {
  return image.data.length === image.width * image.height;
}

// ─── 1. Markers ──────────────────────────────────────────────────────────────

type Frame = { corners: Point[]; aspect: number };

function markerCandidates(image: GrayImage): Blob[] {
  const mask = adaptiveDarkMask(image);
  const area = image.width * image.height;
  const blobs = connectedComponents(mask, image.width, image.height, Math.round(area * 0.0001));
  return blobs
    .filter((blob) => {
      const w = blob.maxX - blob.minX + 1;
      const h = blob.maxY - blob.minY + 1;
      const aspect = w / h;
      const fill = blob.count / (w * h);
      return aspect > 0.5 && aspect < 2 && fill > 0.55 && blob.count < area * 0.03;
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 18);
}

/** The likeliest marker frames, best first. A shaded bubble can pass for a corner square, so a few are kept and checked against the printed circles. */
function findFrames(image: GrayImage, template: OmrTemplate, keep: number): Frame[] {
  const candidates = markerCandidates(image);
  if (candidates.length < 4) return [];
  const expected = template.width / template.height;
  const imageArea = image.width * image.height;
  const found: Array<{ score: number; frame: Frame }> = [];

  const n = candidates.length;
  for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) for (let c = b + 1; c < n; c++) for (let d = c + 1; d < n; d++) {
    const group = [candidates[a], candidates[b], candidates[c], candidates[d]];
    const counts = group.map((blob) => blob.count);
    const sizeRatio = Math.min(...counts) / Math.max(...counts);
    if (sizeRatio < 0.25) continue;

    const points = orderClockwise(group.map((blob) => ({ x: blob.cx, y: blob.cy })));
    if (!isConvex(points)) continue;
    const area = Math.abs(polygonArea(points));
    if (area < imageArea * MIN_FRAME_SHARE) continue;

    const top = distance(points[0], points[1]);
    const right = distance(points[1], points[2]);
    const bottom = distance(points[2], points[3]);
    const left = distance(points[3], points[0]);
    if (Math.min(top, bottom) / Math.max(top, bottom) < 0.6) continue;
    if (Math.min(left, right) / Math.max(left, right) < 0.6) continue;

    const aspect = (top + bottom) / (left + right);
    const aspectError = Math.min(Math.abs(Math.log(aspect / expected)), Math.abs(Math.log(aspect * expected)));
    if (aspectError > 0.3) continue;

    // A real marker's size matches the frame: side ≈ markerSize × (pixels per mm).
    const longSide = Math.max(top + bottom, left + right) / 2;
    const pxPerMm = longSide / Math.max(template.width, template.height);
    const expectedSide = template.markerSize * pxPerMm;
    const sizeErrors = group.map((blob) => Math.abs(Math.log(Math.sqrt(blob.count) / expectedSide)));
    const sizeError = Math.max(...sizeErrors);
    if (sizeError > 0.6) continue;

    // Corner squares are solid squares; a shaded bubble is round (fills at most ~79 % of its box) and often patchy.
    const squareness = Math.min(...group.map((blob) => blob.count / ((blob.maxX - blob.minX + 1) * (blob.maxY - blob.minY + 1))));
    const solid = Math.max(0.1, Math.min(1, (squareness - 0.6) / 0.3));
    // A dark blob cut by the photo's edge is more often background than a corner square.
    const edge = group.some((blob) => blob.minX <= 0 || blob.minY <= 0 || blob.maxX >= image.width - 1 || blob.maxY >= image.height - 1);
    const score = area * (1 - aspectError) * (1 - sizeError / 1.2) * Math.sqrt(sizeRatio) * solid * (edge ? 0.5 : 1);
    found.push({ score, frame: { corners: points, aspect } });
  }
  found.sort((p, q) => q.score - p.score);
  // Keep frames that differ from the ones already kept (not the same four squares found twice).
  const kept: Frame[] = [];
  for (const { frame } of found) {
    const same = kept.some((k) => k.corners.every((p, i) => distance(p, frame.corners[i]) < 3));
    if (!same) kept.push(frame);
    if (kept.length >= keep) break;
  }
  return kept;
}

// ─── 2. Sampling ─────────────────────────────────────────────────────────────

function percentile(values: number[], p: number) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * p)))];
}

const INNER_RINGS: Array<[number, number]> = [[0, 1], [0.24, 6], [0.46, 12], [0.68, 16]];

function ringPoints(center: Point, radius: number, count: number): Point[] {
  if (count === 1 || radius === 0) return [center];
  return Array.from({ length: count }, (_, i) => {
    const angle = (2 * Math.PI * i) / count;
    return { x: center.x + radius * Math.cos(angle), y: center.y + radius * Math.sin(angle) };
  });
}

type Sampler = (p: Point) => number;

/** Local paper brightness around a point (bright percentile of a surrounding ring). */
function localWhite(at: Sampler, center: Point, radius: number) {
  const values = [
    ...ringPoints(center, radius * 1.45, 16),
    ...ringPoints(center, radius * 1.7, 16),
  ].map(at);
  return Math.max(40, percentile(values, 0.8));
}

type BubbleMeasure = { fill: number; shade: number };

/** `fill`: share of the inside that is clearly dark. `shade`: average darkness, which still notices thin or blurred marks. */
function measureBubble(at: Sampler, center: Point, radius: number): BubbleMeasure {
  const white = localWhite(at, center, radius);
  let dark = 0;
  let shade = 0;
  let total = 0;
  for (const [fraction, count] of INNER_RINGS) {
    for (const p of ringPoints(center, radius * fraction, count)) {
      const value = at(p);
      total++;
      if (value < white * DARK_RATIO) dark++;
      shade += Math.max(0, 1 - value / white);
    }
  }
  return { fill: dark / total, shade: shade / total };
}

/**
 * How much darker the printed outline is than the paper around it (0 when the template is misplaced).
 * Paper that curls away from the camera shrinks its circles, so a few radii near the printed one are tried.
 */
function outlineContrast(at: Sampler, center: Point, radius: number) {
  const white = localWhite(at, center, radius);
  let best = 0;
  for (const f of [0.85, 0.92, 1, 1.08]) {
    const darkest = percentile(ringPoints(center, radius * f, 20).map(at), 0.35);
    best = Math.max(best, 1 - darkest / white);
  }
  return best;
}

/** Paper brightness just outside a rectangle (two frames, 2 mm and 3.5 mm out). */
function rectWhite(at: Sampler, x: number, y: number, w: number, h: number) {
  const values: number[] = [];
  for (const pad of [2, 3.5]) {
    const x0 = x - pad, y0 = y - pad, x1 = x + w + pad, y1 = y + h + pad;
    for (let i = 0; i <= 8; i++) {
      const fx = x0 + ((x1 - x0) * i) / 8;
      const fy = y0 + ((y1 - y0) * i) / 8;
      values.push(at({ x: fx, y: y0 }), at({ x: fx, y: y1 }), at({ x: x0, y: fy }), at({ x: x1, y: fy }));
    }
  }
  return Math.max(40, percentile(values, 0.8));
}

function rectFill(at: Sampler, x: number, y: number, w: number, h: number) {
  const white = rectWhite(at, x, y, w, h);
  let dark = 0;
  let total = 0;
  for (let i = 1; i <= 6; i++) {
    for (let j = 1; j <= 3; j++) {
      total++;
      if (at({ x: x + (w * i) / 7, y: y + (h * j) / 4 }) < white * DARK_RATIO) dark++;
    }
  }
  return dark / total;
}

// ─── 3. Decisions ────────────────────────────────────────────────────────────

export function decide(measures: BubbleMeasure[]): { index: number; decision: BubbleDecision } {
  const order = measures.map((m, index) => ({ ...m, index })).sort((a, b) => b.fill - a.fill);
  const first = order[0];
  const second = order[1] ?? { fill: 0, shade: 0, index: -1 };
  const shades = measures.map((m) => m.shade).sort((a, b) => a - b);
  const typicalShade = shades[Math.floor((shades.length - 1) / 2)];
  const standsOut = shades[shades.length - 1] - typicalShade >= SHADE_STANDOUT;

  // Blank only when nothing stands out; a faint, thin or blurred mark goes to the teacher instead.
  if (!standsOut && (first.fill < FAINT || (first.fill < EMPTY && first.fill - second.fill < 0.07))) {
    return { index: -1, decision: "blank" };
  }
  if (first.fill >= FILLED && second.fill >= FILLED) return { index: -1, decision: "multiple" };
  if (first.fill >= FILLED && second.fill < EMPTY) return { index: first.index, decision: "ok" };
  // A heavily shaded bubble next to a faint smudge (an erased answer) is still clear.
  if (first.fill >= 0.75 && second.fill <= 0.35 && first.fill - second.fill >= 0.45) {
    return { index: first.index, decision: "ok" };
  }
  return { index: -1, decision: "uncertain" };
}

/**
 * A bubble's printed outline counts as lined up when its contrast is at least this share of the
 * sheet's typical outline contrast (a blurred photo lowers every outline alike; a bubble measured
 * in the wrong place loses its outline altogether).
 */
const LINED_UP_SHARE = 0.4;

function readGroup(at: Sampler, group: OmrChoiceGroup, radius: number, linedUpAbove = 0): GroupReading {
  const r = group.radius ?? radius;
  const measures = group.bubbles.map((bubble) => measureBubble(at, bubble, r));
  const decided = decide(measures);
  // A bubble whose outline did not line up was measured in the wrong place: it may hide a mark,
  // so neither "blank" nor an answer can be trusted — the teacher decides.
  const linedUp = group.bubbles.every((bubble) => outlineContrast(at, bubble, r) > linedUpAbove);
  const { index, decision } = linedUp || decided.decision === "multiple" ? decided : { index: -1, decision: "uncertain" as const };
  const fill = measures.map((m) => m.fill);
  const value = decision === "ok" ? group.options[index] : decision === "blank" ? "blank" : "unclear";
  return { key: group.key, value, decision, fill: fill.map((f) => Math.round(f * 100) / 100) };
}

// ─── Main ────────────────────────────────────────────────────────────────────

export function readAnswerSheet(input: RgbaImage | GrayImage, template: OmrTemplate): OmrReading {
  const gray = isGray(input) ? input : toGray(input);
  const { image: small, scale } = downscale(gray, DETECT_SIDE);
  const frames = findFrames(small, template, FRAMES_TO_CHECK);
  if (!frames.length) return fail("markers_not_found");

  const templateCorners: Point[] = [
    { x: 0, y: 0 },
    { x: template.width, y: 0 },
    { x: template.width, y: template.height },
    { x: 0, y: template.height },
  ];
  const expected = template.width / template.height;

  // Each frame, in each orientation its shape allows: how well do the printed question circles line up?
  type Option = { frame: number; rotation: number; homography: number[]; ordered: Point[]; quick: QuickLook; coarse?: CoarseAlignment };
  const options: Option[] = [];
  for (let frameIndex = 0; frameIndex < frames.length; frameIndex++) {
    const frame = frames[frameIndex];
    const corners = frame.corners.map((p) => ({ x: p.x / scale, y: p.y / scale }));
    const evenFits = Math.abs(Math.log(frame.aspect / expected)) <= 0.3;
    const oddFits = Math.abs(Math.log(frame.aspect * expected)) <= 0.3;
    for (const k of [0, 1, 2, 3].filter((r) => (r % 2 === 0 ? evenFits : oddFits))) {
      const ordered = [0, 1, 2, 3].map((i) => corners[(i + k) % 4]);
      const homography = solveHomography(templateCorners, ordered);
      if (!homography) continue;
      const mark = template.orientationMark;
      if (mark) {
        // Answer sheets with a solid bar on one side: the bar settles the orientation.
        const at: Sampler = (p) => {
          const q = applyHomography(homography, p);
          return sample(gray, q.x, q.y);
        };
        const onMark = rectFill(at, mark.x, mark.y, mark.w, mark.h);
        const opposite = rectFill(at, template.width - mark.x - mark.w, template.height - mark.y - mark.h, mark.w, mark.h);
        if (onMark < 0.55 || onMark - opposite < 0.35) continue;
      }
      const halfTurn = options.find((o) => o.frame === frameIndex && o.rotation === (k + 2) % 4);
      options.push({ frame: frameIndex, rotation: k, homography, ordered, quick: quickLook({ image: small, scale }, homography, template, halfTurn?.quick) });
    }
    // The likeliest frame usually lines up plainly, far better than turned round or than any other
    // frame seen so far; then the rest need no look.
    const ranked = [...options].sort((p, q) => q.quick.score - p.quick.score);
    const lead = ranked[0];
    const rest = ranked.find((o) => o !== lead)?.quick.score ?? 0;
    const enough = lead && (lead.quick.score >= CLEAR_LOOK || (frameIndex >= 1 && lead.quick.score >= CLEAR_LOOK / 2));
    if (enough && rest < lead.quick.score / 2.5) break;
  }
  if (!options.length) return fail("orientation_unknown");
  // A closer look at the most promising few, and at the best one turned around.
  options.sort((p, q) => q.quick.score - p.quick.score);
  const closer = new Set(options.slice(0, CLOSER_LOOKS));
  const turnedOf = (o: Option) => options.find((other) => other.frame === o.frame && other !== o);
  const firstTurned = turnedOf(options[0]);
  if (firstTurned) closer.add(firstTurned);
  closer.forEach((o) => {
    o.coarse = coarseAlign(gray, o.homography, template, o.quick);
  });
  const ranked = options.filter((o) => o.coarse).sort((p, q) => q.coarse!.score - p.coarse!.score);
  const chosen = ranked[0];
  const chosenCoarse = chosen.coarse!;
  if (chosenCoarse.score < PAGE_FOUND) return fail("alignment_failed");
  if (!template.orientationMark) {
    // The same four squares turned the other way must line up clearly worse.
    const turned = turnedOf(chosen);
    const turnedScore = turned ? (turned.coarse ?? coarseAlign(gray, turned.homography, template, turned.quick)).score : 0;
    if (turned && chosenCoarse.score - turnedScore < ORIENTATION_MARGIN) return fail("orientation_unknown");
  }

  const { homography, ordered } = chosen;
  const fit = fitPage(gray, homography, template, chosenCoarse);
  const samplerFor = (offset: Point): Sampler => {
    const shifted = shiftHomography(homography, offset);
    return (p) => {
      const q = applyHomography(shifted, p);
      return sample(gray, q.x, q.y);
    };
  };
  const near = (p: Point) => samplerFor(fieldAt(fit.field, p));
  const radius = template.bubbleRadius;

  const at: Sampler = (p) => {
    const q = applyHomography(homography, p);
    return sample(gray, q.x, q.y);
  };
  const settled = (group: OmrChoiceGroup, bubbles: Point[]): OmrChoiceGroup => ({ ...group, bubbles });

  // Sanity check: the printed bubble outlines must line up where each bubble settled.
  const contrasts = fit.questions.flatMap((bubbles) => bubbles.map((bubble) => outlineContrast(at, bubble, radius)));
  const alignedCount = contrasts.filter((c) => c > 0.08).length;
  const bubbleCount = contrasts.length;
  const linedUpAbove = Math.max(0.04, LINED_UP_SHARE * percentile(contrasts, 0.5));
  if (alignedCount / Math.max(1, bubbleCount) < 0.7 || fit.agreement < MIN_AGREEMENT) return fail("alignment_failed");

  const warnings: string[] = [];

  // Identity strip: is this sheet for this test?
  const strip = template.idStrip;
  if (strip) {
    let mismatches = 0;
    let unsure = 0;
    strip.cells.forEach((cell, index) => {
      const s = strip.cellSize * 0.7;
      const fill = rectFill(near(cell), cell.x - s / 2, cell.y - s / 2, s, s);
      const bit = fill >= 0.55 ? 1 : fill <= 0.2 ? 0 : -1;
      if (bit === -1) unsure++;
      else if (bit !== strip.bits[index]) mismatches++;
    });
    if (mismatches >= 2) return fail("wrong_sheet");
    if (mismatches === 1 || unsure > 0) warnings.push("تحقق أن هذه الورقة لهذا الاختبار.");
  }

  const questions = template.questions.map((group, index) => readGroup(at, settled(group, fit.questions[index]), radius, linedUpAbove));
  const answers: Record<string, string> = {};
  questions.forEach((reading) => { answers[reading.key] = reading.value; });

  let studentCode = "";
  let studentCodeDecision: Extract<OmrReading, { ok: true }>["studentCodeDecision"] = "absent";
  if (template.studentCode) {
    const { ones: onesGroup, tens: tensGroup } = template.studentCode;
    const ones = readGroup(at, fit.code ? settled(onesGroup, fit.code.ones) : onesGroup, radius, linedUpAbove);
    const tens = readGroup(at, fit.code ? settled(tensGroup, fit.code.tens) : tensGroup, radius, linedUpAbove);
    if (ones.decision === "ok" && (tens.decision === "ok" || tens.decision === "blank")) {
      const value = Number(tens.decision === "ok" ? tens.value : "0") * 10 + Number(ones.value);
      if (value > 0) {
        studentCode = String(value);
        studentCodeDecision = "ok";
      } else {
        studentCodeDecision = "invalid";
      }
    } else if (ones.decision === "blank" && tens.decision === "blank") {
      studentCodeDecision = "blank";
    } else {
      studentCodeDecision = ones.decision === "ok" ? tens.decision : ones.decision;
    }
  }

  return {
    ok: true,
    templateId: template.id,
    answers,
    questions,
    studentCode,
    studentCodeDecision,
    homography,
    field: fit.field,
    bubbles: {
      questions: fit.questions,
      ...(fit.code ? { code: fit.code } : {}),
    },
    corners: ordered,
    warnings,
  };
}
