import { findSheetCorners } from "./reader";
import type { GrayImage, OmrTemplate, Point } from "./types";

/**
 * Live camera help for the scanner (no AI, runs on the phone several times a second):
 *   - where the sheet's four corner squares are in a small preview frame, and how much of the
 *     frame the sheet fills,
 *   - whether the phone has held still long enough to capture without shake,
 *   - how sharp a captured frame is, so the sharpest of a few frames is the one read.
 * A video frame is not a photo: it is exposed for up to 1/30 s and the tap on the button shakes the
 * phone at that very moment. Capturing only when the corners stand still, and keeping the sharpest of
 * a few frames, avoids most blurred captures.
 */

/** The sheet should fill at least this share of the frame's width (corner squares, left to right). */
export const MIN_SHEET_WIDTH = 0.55;
/** Corners moving less than this share of the frame width between looks count as still. */
const STILL_SHARE = 0.012;
/** Held still this long (ms), the sheet is captured. */
export const STILL_MS = 450;
/** After a capture, the corners must be gone this long (ms) — the sheet taken away — before the next. */
const GONE_MS = 300;
/** …or the sheet must have moved this share of the frame width (another sheet put in its place). */
const MOVED_SHARE = 0.08;

export type LiveStatus = "searching" | "closer" | "holding" | "ready" | "waiting";

export type LiveLook = {
  /** Corner squares as shares of the frame (0–1), clockwise from top-left; null when not all four are seen. */
  corners: Point[] | null;
  /** Share of the frame's width spanned by the corner squares. */
  width: number;
};

/** Finds the sheet in a small preview frame. */
export function lookAtFrame(gray: GrayImage, template: OmrTemplate): LiveLook {
  const corners = findSheetCorners(gray, template);
  if (!corners) return { corners: null, width: 0 };
  const xs = corners.map((p) => p.x);
  return {
    corners: corners.map((p) => ({ x: p.x / gray.width, y: p.y / gray.height })),
    width: (Math.max(...xs) - Math.min(...xs)) / gray.width,
  };
}

function largestMove(a: Point[], b: Point[]) {
  let move = 0;
  for (let i = 0; i < 4; i++) move = Math.max(move, Math.hypot(a[i].x - b[i].x, a[i].y - b[i].y));
  return move;
}

/**
 * Decides, look by look, when to capture: all four corners seen, sheet big enough, held still for
 * STILL_MS. After a capture it waits for the sheet to be taken away (or replaced) before the next,
 * so one sheet is not captured twice.
 */
export class AutoCaptureTracker {
  private previous: Point[] | null = null;
  private stillSince: number | null = null;
  private goneSince: number | null = null;
  private capturedAt: Point[] | null = null;
  private armed = true;

  /** Feeds one look; returns what the teacher should be told, and whether to capture now. */
  update(look: LiveLook, now: number): { status: LiveStatus; capture: boolean } {
    if (!look.corners) {
      this.previous = null;
      this.stillSince = null;
      this.goneSince ??= now;
      if (!this.armed && now - this.goneSince >= GONE_MS) this.rearm();
      return { status: this.armed ? "searching" : "waiting", capture: false };
    }
    this.goneSince = null;
    if (!this.armed && this.capturedAt && largestMove(look.corners, this.capturedAt) >= MOVED_SHARE) this.rearm();

    const moved = this.previous ? largestMove(look.corners, this.previous) : Infinity;
    this.previous = look.corners;
    if (moved > STILL_SHARE || this.stillSince === null) this.stillSince = now;
    if (!this.armed) return { status: "waiting", capture: false };
    if (look.width < MIN_SHEET_WIDTH) return { status: "closer", capture: false };
    if (this.stillSince === null || now - this.stillSince < STILL_MS) return { status: "holding", capture: false };
    return { status: "ready", capture: true };
  }

  /** How long (ms) the sheet has been held still, 0 when it has not. */
  heldFor(now: number) {
    return this.stillSince === null || !this.previous ? 0 : now - this.stillSince;
  }

  /** A capture was taken from what the tracker saw last: wait for the next sheet. */
  captured() {
    this.armed = false;
    this.capturedAt = this.previous;
    this.stillSince = null;
  }

  /** Start over (camera reopened, or the teacher wants this sheet captured again). */
  rearm() {
    this.armed = true;
    this.capturedAt = null;
    this.stillSince = null;
  }
}

/**
 * How sharp the corner squares' edges are (0–1). Along short lines across each square's edges, the
 * steepest one-pixel step is divided by the whole dark-to-paper step: a crisp edge changes within
 * about one pixel (near 1), motion or focus blur spreads it over several (about 1/n). The weaker of
 * the two directions counts, since a shake blurs edges across its direction only. Independent of
 * light and contrast. `corners` are shares of the frame, as from lookAtFrame.
 */
export function edgeSharpness(gray: GrayImage, corners: Point[], template: OmrTemplate): number {
  const xs = corners.map((p) => p.x * gray.width);
  const pxPerMm = (Math.max(...xs) - Math.min(...xs)) / template.width;
  const side = template.markerSize * pxPerMm;
  if (side < 4) return 0;
  const at = (x: number, y: number) => {
    const ix = Math.min(gray.width - 1, Math.max(0, Math.round(x)));
    const iy = Math.min(gray.height - 1, Math.max(0, Math.round(y)));
    return gray.data[iy * gray.width + ix];
  };
  const steepness = (values: number[]) => {
    let min = 255;
    let max = 0;
    let step = 0;
    for (let i = 0; i < values.length; i++) {
      min = Math.min(min, values[i]);
      max = Math.max(max, values[i]);
      if (i > 0) step = Math.max(step, Math.abs(values[i] - values[i - 1]));
    }
    return max - min < 30 ? 0 : step / (max - min);
  };
  let total = 0;
  for (const corner of corners) {
    const cx = corner.x * gray.width;
    const cy = corner.y * gray.height;
    const reach = Math.round(side);
    let across = 0;
    let down = 0;
    // Three lines each way through the square, each crossing both of its edges.
    for (const offset of [-0.25, 0, 0.25]) {
      const row: number[] = [];
      const column: number[] = [];
      for (let i = -reach; i <= reach; i++) {
        row.push(at(cx + i, cy + offset * side));
        column.push(at(cx + offset * side, cy + i));
      }
      across += steepness(row);
      down += steepness(column);
    }
    total += Math.min(across, down) / 3;
  }
  return total / corners.length;
}
