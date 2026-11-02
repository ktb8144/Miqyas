"use client";

import { downscale, toGray } from "@/lib/omr/image";
import { edgeSharpness, lookAtFrame } from "@/lib/omr/live";
import type { GrayImage, OmrTemplate } from "@/lib/omr/types";

/** Longest side (px) kept from a camera frame; reading scales larger photos down to 2000 anyway. */
const FRAME_MAX_SIDE = 2000;
/** Width (px) of the small copy the live look runs on, several times a second. */
const PREVIEW_WIDTH = 360;
/** A4 upright: width / height. */
const SHEET_RATIO = 1240 / 1754;

/** The centre of the camera frame in the sheet's shape (A4, upright): what the on-screen frame shows. */
function sheetCrop(video: HTMLVideoElement) {
  const sourceWidth = video.videoWidth || 1240;
  const sourceHeight = video.videoHeight || 1754;
  let sx = 0;
  let sy = 0;
  let sw = sourceWidth;
  let sh = sourceHeight;
  if (sourceWidth / sourceHeight > SHEET_RATIO) {
    sw = sourceHeight * SHEET_RATIO;
    sx = (sourceWidth - sw) / 2;
  } else {
    sh = sourceWidth / SHEET_RATIO;
    sy = (sourceHeight - sh) / 2;
  }
  return { sx, sy, sw, sh };
}

/** Draws that centre of the camera frame into `canvas`, at the camera's own resolution (at most `maxSide`). */
export function drawSheetFrame(video: HTMLVideoElement, canvas: HTMLCanvasElement, maxSide = FRAME_MAX_SIDE) {
  const { sx, sy, sw, sh } = sheetCrop(video);
  const scale = Math.min(1, maxSide / Math.max(sw, sh));
  canvas.width = Math.max(1, Math.round(sw * scale));
  canvas.height = Math.max(1, Math.round(sh * scale));
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return ctx;
}

/** A small grey copy of what the on-screen frame shows, for the live look. */
export function previewGray(video: HTMLVideoElement, canvas: HTMLCanvasElement): GrayImage | null {
  const ctx = drawSheetFrame(video, canvas, PREVIEW_WIDTH / SHEET_RATIO);
  if (!ctx) return null;
  return toGray(ctx.getImageData(0, 0, canvas.width, canvas.height));
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export type SharpestFrame = { canvas: HTMLCanvasElement; sharpness: number };

/**
 * Takes `count` frames `gap` ms apart, the first after `settle` ms (a tap shakes the phone for a
 * moment), and keeps the one whose corner squares have the sharpest edges. A frame where the
 * squares are not all seen scores 0; if none is seen, the last frame is kept (the reader will say why).
 */
export async function grabSharpest(
  video: HTMLVideoElement,
  template: OmrTemplate,
  { settle, count, gap }: { settle: number; count: number; gap: number }
): Promise<SharpestFrame | null> {
  let best: SharpestFrame | null = null;
  for (let i = 0; i < count; i++) {
    await pause(i === 0 ? settle : gap);
    const canvas = document.createElement("canvas");
    const ctx = drawSheetFrame(video, canvas);
    if (!ctx) continue;
    const full = toGray(ctx.getImageData(0, 0, canvas.width, canvas.height));
    const look = lookAtFrame(downscale(full, PREVIEW_WIDTH / SHEET_RATIO).image, template);
    const sharpness = look.corners ? edgeSharpness(full, look.corners, template) : 0;
    if (!best || sharpness > best.sharpness || (sharpness === 0 && best.sharpness === 0)) best = { canvas, sharpness };
  }
  return best;
}

const AUTO_KEY = "dala.scanner.auto";

/** Whether the teacher left automatic capture on (default on). */
export function readAutoCapture(): boolean {
  try {
    return window.localStorage.getItem(AUTO_KEY) !== "off";
  } catch {
    return true;
  }
}

export function writeAutoCapture(on: boolean) {
  try {
    window.localStorage.setItem(AUTO_KEY, on ? "on" : "off");
  } catch {
    // Storage can be unavailable (private mode); the switch still works for this visit.
  }
}
