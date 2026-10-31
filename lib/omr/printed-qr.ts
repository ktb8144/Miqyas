import { applyHomography } from "./geometry";
import { sample } from "./image";
import type { GrayImage } from "./types";

/**
 * Identifies the class/test QR printed on a Dala sheet without decoding it.
 *
 * Dala printed the QR, so after the corner markers are found it knows where every module sits.
 * We sample each module through the sheet's homography and compare the pattern with the QR codes
 * this sheet could carry (e.g. the same test for each of the teacher's classes). This keeps working
 * on photos too soft for a QR decoder (in tests: 100% vs ~78% for jsQR on normal photos, ~29% on hard ones).
 *
 * Store each code's module matrix when the sheet is printed, so the matcher compares against exactly
 * what is on paper (different QR libraries may pick different mask patterns for the same text).
 */

/** Where the QR is printed, in template mm (from the top-left marker centre). */
export type PrintedQr = { x: number; y: number; size: number; modules: number };
/** One possible code and its module matrix as printed: rows of "1" (dark) / "0" (light). */
export type QrCandidate = { code: string; matrix: string[] };

export type QrMatch = {
  /** The matched code, or null when the match is not clear enough (show a warning, never guess). */
  code: string | null;
  score: number;
  margin: number;
};

/** Minimum lead of the best candidate over the next one. Correct matches in tests: ≥ 0.15; wrong ones: never ranked first. */
export const QR_MIN_MARGIN = 0.12;
export const QR_MIN_SCORE = 0.35;

export function matchPrintedQr(image: GrayImage, homography: number[], qr: PrintedQr, candidates: QrCandidate[]): QrMatch {
  if (candidates.length === 0) return { code: null, score: 0, margin: 0 };
  const n = qr.modules;
  const cell = qr.size / n;
  const best = new Map<string, number>();
  const taps: Array<[number, number]> = [[0, 0], [0.18, 0], [-0.18, 0], [0, 0.18], [0, -0.18]];

  // A module is under 1 mm, so search a little around the marker-based position.
  for (let oy = -0.6; oy <= 0.601; oy += 0.15) {
    for (let ox = -0.6; ox <= 0.601; ox += 0.15) {
      const values = new Float64Array(n * n);
      for (let j = 0; j < n; j++) {
        for (let i = 0; i < n; i++) {
          let sum = 0;
          for (const [dx, dy] of taps) {
            const p = applyHomography(homography, { x: qr.x + ox + (i + 0.5 + dx) * cell, y: qr.y + oy + (j + 0.5 + dy) * cell });
            sum += sample(image, p.x, p.y);
          }
          values[j * n + i] = sum / taps.length;
        }
      }
      let mean = 0;
      for (let k = 0; k < values.length; k++) mean += values[k];
      mean /= values.length;
      let variance = 0;
      for (let k = 0; k < values.length; k++) variance += (values[k] - mean) ** 2;
      const sd = Math.sqrt(variance / values.length) || 1;

      for (const candidate of candidates) {
        let score = 0;
        for (let j = 0; j < n; j++) {
          const row = candidate.matrix[j];
          for (let i = 0; i < n; i++) {
            const darkness = (mean - values[j * n + i]) / sd;
            score += row.charCodeAt(i) === 49 /* "1" */ ? darkness : -darkness;
          }
        }
        score /= n * n;
        if (score > (best.get(candidate.code) ?? -Infinity)) best.set(candidate.code, score);
      }
    }
  }

  const ranked = Array.from(best.entries()).sort((a, b) => b[1] - a[1]);
  const [topCode, topScore] = ranked[0];
  const margin = ranked.length > 1 ? topScore - ranked[1][1] : topScore;
  const clear = topScore >= QR_MIN_SCORE && margin >= QR_MIN_MARGIN;
  return { code: clear ? topCode : null, score: topScore, margin };
}
