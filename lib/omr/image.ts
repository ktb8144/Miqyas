import type { GrayImage, RgbaImage } from "./types";

export function toGray(image: RgbaImage): GrayImage {
  const { width, height, data } = image;
  const out = new Uint8Array(width * height);
  for (let i = 0, j = 0; i < out.length; i++, j += 4) {
    out[i] = (data[j] * 77 + data[j + 1] * 150 + data[j + 2] * 29) >> 8;
  }
  return { width, height, data: out };
}

/** Box-filter downscale so the longer side is at most `maxSide`. */
export function downscale(image: GrayImage, maxSide: number): { image: GrayImage; scale: number } {
  const longest = Math.max(image.width, image.height);
  if (longest <= maxSide) return { image, scale: 1 };
  const scale = maxSide / longest;
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const out = new Uint8Array(width * height);
  const step = 1 / scale;
  for (let y = 0; y < height; y++) {
    const y0 = Math.floor(y * step);
    const y1 = Math.min(image.height, Math.max(y0 + 1, Math.floor((y + 1) * step)));
    for (let x = 0; x < width; x++) {
      const x0 = Math.floor(x * step);
      const x1 = Math.min(image.width, Math.max(x0 + 1, Math.floor((x + 1) * step)));
      let sum = 0;
      for (let yy = y0; yy < y1; yy++) {
        const row = yy * image.width;
        for (let xx = x0; xx < x1; xx++) sum += image.data[row + xx];
      }
      out[y * width + x] = Math.round(sum / ((y1 - y0) * (x1 - x0)));
    }
  }
  return { image: { width, height, data: out }, scale: width / image.width };
}

/** Marks pixels clearly darker than their neighbourhood (window ≈ 1/8 of the image). */
export function adaptiveDarkMask(image: GrayImage, ratio = 0.72): Uint8Array {
  const { width, height, data } = image;
  const integral = new Float64Array((width + 1) * (height + 1));
  for (let y = 0; y < height; y++) {
    let rowSum = 0;
    for (let x = 0; x < width; x++) {
      rowSum += data[y * width + x];
      integral[(y + 1) * (width + 1) + x + 1] = integral[y * (width + 1) + x + 1] + rowSum;
    }
  }
  const half = Math.max(8, Math.round(Math.max(width, height) / 16));
  const mask = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    const y0 = Math.max(0, y - half);
    const y1 = Math.min(height, y + half + 1);
    for (let x = 0; x < width; x++) {
      const x0 = Math.max(0, x - half);
      const x1 = Math.min(width, x + half + 1);
      const sum =
        integral[y1 * (width + 1) + x1] -
        integral[y0 * (width + 1) + x1] -
        integral[y1 * (width + 1) + x0] +
        integral[y0 * (width + 1) + x0];
      const mean = sum / ((y1 - y0) * (x1 - x0));
      const value = data[y * width + x];
      if (value < mean * ratio && value < mean - 18) mask[y * width + x] = 1;
    }
  }
  return mask;
}

export type Blob = {
  count: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  cx: number;
  cy: number;
};

/** 8-connected components of a binary mask. */
export function connectedComponents(mask: Uint8Array, width: number, height: number, minCount: number): Blob[] {
  const labels = new Int32Array(width * height);
  const blobs: Blob[] = [];
  const stack = new Int32Array(width * height);
  let next = 1;
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || labels[start]) continue;
    let top = 0;
    stack[top++] = start;
    labels[start] = next;
    let count = 0;
    let minX = width, maxX = 0, minY = height, maxY = 0, sumX = 0, sumY = 0;
    while (top > 0) {
      const index = stack[--top];
      const x = index % width;
      const y = (index - x) / width;
      count++;
      sumX += x;
      sumY += y;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= height) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= width || (dx === 0 && dy === 0)) continue;
          const neighbour = ny * width + nx;
          if (mask[neighbour] && !labels[neighbour]) {
            labels[neighbour] = next;
            stack[top++] = neighbour;
          }
        }
      }
    }
    next++;
    if (count >= minCount) blobs.push({ count, minX, maxX, minY, maxY, cx: sumX / count, cy: sumY / count });
  }
  return blobs;
}

/** Bilinear sample; returns 255 outside the image. */
export function sample(image: GrayImage, x: number, y: number): number {
  const { width, height, data } = image;
  if (x < 0 || y < 0 || x > width - 1 || y > height - 1) return 255;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(width - 1, x0 + 1);
  const y1 = Math.min(height - 1, y0 + 1);
  const fx = x - x0;
  const fy = y - y0;
  const top = data[y0 * width + x0] * (1 - fx) + data[y0 * width + x1] * fx;
  const bottom = data[y1 * width + x0] * (1 - fx) + data[y1 * width + x1] * fx;
  return top * (1 - fy) + bottom * fy;
}
