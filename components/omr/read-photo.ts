"use client";

import { applyHomography } from "@/lib/omr/geometry";
import { readAnswerSheet } from "@/lib/omr/reader";
import type { OmrReading, OmrTemplate } from "@/lib/omr/types";

/** Reading happens on the teacher's phone: the photo never leaves the device to be read. */

const READ_MAX_SIDE = 2000;

function loadImage(base64: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("تعذّر فتح الصورة"));
    img.src = `data:image/jpeg;base64,${base64}`;
  });
}

function drawScaled(img: HTMLImageElement, maxSide: number) {
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("المتصفح لا يدعم قراءة الصور");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return { canvas, ctx };
}

/** Cuts the part of the photo that holds a template rectangle (mm), for the teacher to look at. */
function cropTemplateRect(
  canvas: HTMLCanvasElement,
  homography: number[],
  rect: { x0: number; y0: number; x1: number; y1: number },
  outWidth = 320
) {
  const corners = [
    applyHomography(homography, { x: rect.x0, y: rect.y0 }),
    applyHomography(homography, { x: rect.x1, y: rect.y0 }),
    applyHomography(homography, { x: rect.x1, y: rect.y1 }),
    applyHomography(homography, { x: rect.x0, y: rect.y1 }),
  ];
  const minX = Math.max(0, Math.min(...corners.map((p) => p.x)));
  const maxX = Math.min(canvas.width, Math.max(...corners.map((p) => p.x)));
  const minY = Math.max(0, Math.min(...corners.map((p) => p.y)));
  const maxY = Math.min(canvas.height, Math.max(...corners.map((p) => p.y)));
  const w = maxX - minX;
  const h = maxY - minY;
  if (w < 4 || h < 4) return "";
  const out = document.createElement("canvas");
  out.width = outWidth;
  out.height = Math.max(1, Math.round((outWidth * h) / w));
  out.getContext("2d")?.drawImage(canvas, minX, minY, w, h, 0, 0, out.width, out.height);
  return out.toDataURL("image/jpeg", 0.85);
}

export type PhotoReading = {
  reading: OmrReading;
  /** Close-ups of every question (and the student number) the reader left for the teacher. */
  crops: Record<string, string>;
};

export async function readPhoto(base64: string, template: OmrTemplate): Promise<PhotoReading> {
  const img = await loadImage(base64);
  const { canvas, ctx } = drawScaled(img, READ_MAX_SIDE);
  // Let the camera UI breathe before the (short) synchronous read.
  await new Promise((resolve) => setTimeout(resolve, 0));
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const reading = readAnswerSheet({ width: imageData.width, height: imageData.height, data: imageData.data }, template);

  const crops: Record<string, string> = {};
  if (reading.ok) {
    const r = template.bubbleRadius;
    reading.questions.forEach((group, index) => {
      if (group.value !== "unclear") return;
      const bubbles = template.questions[index].bubbles;
      const xs = bubbles.map((b) => b.x);
      const y = bubbles[0].y;
      crops[group.key] = cropTemplateRect(canvas, reading.homography, {
        x0: Math.min(...xs) - r - 3,
        x1: Math.max(...xs) + r + 9,
        y0: y - r - 2.5,
        y1: y + r + 2.5,
      });
    });
    if (template.studentCode && reading.studentCodeDecision !== "ok") {
      const all = [...template.studentCode.ones.bubbles, ...template.studentCode.tens.bubbles];
      crops.code = cropTemplateRect(canvas, reading.homography, {
        x0: -3,
        x1: template.width + 3,
        y0: Math.min(...all.map((b) => b.y)) - 7,
        y1: Math.max(...all.map((b) => b.y)) + 5,
      }, 480);
    }
  }
  return { reading, crops };
}
