import { PDFDocument, rgb, type PDFPage } from "pdf-lib";
import { sheetQrModules } from "./sheet-code";
import { readSheetMasterFromDoc, type SheetStampLayout } from "./sheet-master";

/**
 * Stamps a Dala master question sheet for one class, in the browser:
 *   - the class QR (vector, from the database's sheet code),
 *   - "فصل <class>" under it,
 *   - the title "<school> | <subject>", shrunk to fit, or on two lines when the name is very long.
 * Arabic text is drawn by the browser (correct letter joining) at ~610 dpi and placed as an image;
 * everything else in the master stays vector. Runs in the browser only (canvas + FontFace).
 */

const PT_PER_MM = 72 / 25.4;
const PX_PER_MM = 24;
const FAMILY = "DalaSheetPlex";
const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const INK = "#111111";

export type StampFonts = { arabic: string; latin: string };

/** IBM Plex Sans Arabic Bold, served from /public/fonts (OFL). */
export const DEFAULT_STAMP_FONTS: StampFonts = {
  arabic: "/fonts/ibm-plex-sans-arabic-arabic-700-normal.woff2",
  latin: "/fonts/ibm-plex-sans-arabic-latin-700-normal.woff2",
};

const ARABIC_RANGE = "U+0600-06FF, U+0750-077F, U+0870-08FF, U+200C-200E, U+2010-2011, U+FB50-FDFF, U+FE70-FEFC";
const LATIN_RANGE = "U+0000-00FF, U+2000-206F, U+2212, U+2215";

let fontsReady: Promise<void> | null = null;

function loadFonts(fonts: StampFonts) {
  if (!fontsReady) {
    fontsReady = (async () => {
      const faces = [
        new FontFace(FAMILY, `url("${fonts.arabic}")`, { weight: "700", unicodeRange: ARABIC_RANGE }),
        new FontFace(FAMILY, `url("${fonts.latin}")`, { weight: "700", unicodeRange: LATIN_RANGE }),
      ];
      for (const face of faces) {
        await face.load();
        document.fonts.add(face);
      }
    })().catch((error) => {
      fontsReady = null;
      throw error;
    });
  }
  return fontsReady;
}

export function toArabicDigits(text: string) {
  return text.replace(/[0-9]/g, (d) => AR_DIGITS[Number(d)]);
}

function fontCss(sizePt: number) {
  return `700 ${(sizePt / PT_PER_MM) * PX_PER_MM}px "${FAMILY}"`;
}

let measureCtx: CanvasRenderingContext2D | null = null;

/** Advance width of a text in mm at a size in points. */
function advance(text: string, sizePt: number) {
  measureCtx ??= document.createElement("canvas").getContext("2d");
  if (!measureCtx) throw new Error("المتصفح لا يدعم الرسم");
  measureCtx.font = fontCss(sizePt);
  measureCtx.direction = "rtl";
  return measureCtx.measureText(text).width / PX_PER_MM;
}

type TextImage = { png: Uint8Array; widthMm: number; heightMm: number; rightInsetMm: number; baselineMm: number; advanceMm: number };

async function textImage(text: string, sizePt: number, color = INK): Promise<TextImage> {
  const canvas = document.createElement("canvas");
  let ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("المتصفح لا يدعم الرسم");
  const font = fontCss(sizePt);
  ctx.font = font;
  ctx.direction = "rtl";
  const m = ctx.measureText(text);
  const sizePx = (sizePt / PT_PER_MM) * PX_PER_MM;
  const pad = Math.ceil(sizePx * 0.35);
  const ascent = Math.ceil(Math.max(m.actualBoundingBoxAscent, sizePx));
  const descent = Math.ceil(Math.max(m.actualBoundingBoxDescent, sizePx * 0.5));
  canvas.width = Math.ceil(m.width) + pad * 2;
  canvas.height = ascent + descent + pad * 2;
  ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("المتصفح لا يدعم الرسم");
  ctx.font = font;
  ctx.direction = "rtl";
  ctx.textAlign = "right";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = color;
  ctx.fillText(text, canvas.width - pad, pad + ascent);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("تعذّر رسم النص"))), "image/png")
  );
  return {
    png: new Uint8Array(await blob.arrayBuffer()),
    widthMm: canvas.width / PX_PER_MM,
    heightMm: canvas.height / PX_PER_MM,
    rightInsetMm: pad / PX_PER_MM,
    baselineMm: (pad + ascent) / PX_PER_MM,
    advanceMm: m.width / PX_PER_MM,
  };
}

/** Draws text so that its right edge is at `right` and its baseline at `baseline` (page mm). */
async function drawText(doc: PDFDocument, page: PDFPage, layout: SheetStampLayout, text: string, sizePt: number, right: number, baseline: number) {
  const img = await textImage(text, sizePt);
  const png = await doc.embedPng(img.png);
  const left = right + img.rightInsetMm - img.widthMm;
  const top = baseline - img.baselineMm;
  page.drawImage(png, {
    x: left * PT_PER_MM,
    y: (layout.page.height - top - img.heightMm) * PT_PER_MM,
    width: img.widthMm * PT_PER_MM,
    height: img.heightMm * PT_PER_MM,
  });
  return img.advanceMm;
}

function drawRectMm(page: PDFPage, layout: SheetStampLayout, x: number, y: number, w: number, h: number, color = rgb(0, 0, 0)) {
  page.drawRectangle({ x: x * PT_PER_MM, y: (layout.page.height - y - h) * PT_PER_MM, width: w * PT_PER_MM, height: h * PT_PER_MM, color, borderWidth: 0 });
}

function hexColor(hex: string) {
  const v = parseInt(hex.replace("#", ""), 16);
  return rgb(((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255);
}

export type TitleFit = { mode: "one" | "two"; size: number };

/** Largest title that fits: school and subject on one line, else the school name on its own line above. */
export function fitTitle(layout: SheetStampLayout, school: string): TitleFit {
  const t = layout.title;
  const available = t.right - t.left;
  for (let size = t.size; size >= t.minSize - 1e-6; size -= 0.25) {
    const k = size / t.size;
    const width = advance(school, size) + advance(layout.subjectTitle, size) + 2 * t.gap * k + t.bar.width;
    if (width <= available) return { mode: "one", size };
  }
  const availableTwo = (t.twoLine.right ?? t.right) - t.left;
  for (let size = t.twoLine.size; size >= t.twoLine.minSize - 1e-6; size -= 0.25) {
    if (advance(school, size) <= availableTwo) return { mode: "two", size };
  }
  // Extremely long: shrink exactly to the width rather than run into the number grid.
  const size = t.twoLine.minSize * (availableTwo / advance(school, t.twoLine.minSize));
  return { mode: "two", size };
}

export function classLabelText(layout: SheetStampLayout, className: string) {
  const name = toArabicDigits(className.trim());
  return name.includes(layout.classLabel.prefix) ? name : `${layout.classLabel.prefix} ${name}`;
}

export type StampInput = {
  /** The master PDF (see sheet-master.ts). */
  master: ArrayBuffer | Uint8Array;
  schoolName: string;
  className: string;
  /** The class's sheet code from the database. */
  sheetCode: string;
  /** Pages in the output, all identical (one per student). Default 1. */
  copies?: number;
  fonts?: StampFonts;
};

export async function stampClassSheet({ master, schoolName, className, sheetCode, copies = 1, fonts = DEFAULT_STAMP_FONTS }: StampInput): Promise<Uint8Array> {
  await loadFonts(fonts);
  const doc = await PDFDocument.load(master, { updateMetadata: false });
  const info = readSheetMasterFromDoc(doc);
  if (!info) throw new Error("ورقة الأسئلة هذه ليست ورقة دالة جاهزة للطباعة لكل فصل");
  const layout = info.stamp;
  const page = doc.getPage(0);

  // QR: one rectangle per run of dark modules.
  const rows = sheetQrModules(sheetCode);
  const cell = layout.qr.size / rows.length;
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; ) {
      if (row[x] !== "1") { x++; continue; }
      const start = x;
      while (x < row.length && row[x] === "1") x++;
      drawRectMm(page, layout, layout.qr.x + start * cell, layout.qr.y + y * cell, (x - start) * cell + 0.02, cell + 0.02);
    }
  });

  // Class name under the QR, centred, shrunk if long.
  const c = layout.classLabel;
  const label = classLabelText(layout, className);
  let labelSize = c.size;
  while (labelSize > c.minSize && advance(label, labelSize) > c.maxWidth) labelSize -= 0.25;
  await drawText(doc, page, layout, label, labelSize, c.cx + advance(label, labelSize) / 2, c.baseline);

  // Title.
  const t = layout.title;
  const school = schoolName.trim();
  const fit = school ? fitTitle(layout, school) : null;
  if (!fit) {
    await drawText(doc, page, layout, layout.subjectTitle, t.size, t.right, t.baseline);
  } else if (fit.mode === "one") {
    const k = fit.size / t.size;
    let x = t.right;
    x -= await drawText(doc, page, layout, school, fit.size, x, t.baseline);
    x -= t.gap * k;
    drawRectMm(page, layout, x - t.bar.width, t.baseline - t.bar.above * k, t.bar.width, (t.bar.above + t.bar.below) * k, hexColor(t.bar.color));
    x -= t.bar.width + t.gap * k;
    await drawText(doc, page, layout, layout.subjectTitle, fit.size, x, t.baseline);
  } else {
    await drawText(doc, page, layout, school, fit.size, t.twoLine.right ?? t.right, t.twoLine.baseline);
    await drawText(doc, page, layout, layout.subjectTitle, t.size, t.right, t.baseline);
  }

  const docTitle = [layout.subjectTitle, school, label].filter(Boolean).join(" — ");
  doc.setTitle(docTitle);
  doc.setCreator("Dala");
  const stamped = await doc.save();
  const n = Math.max(1, Math.min(200, Math.round(copies)));
  if (n === 1) return stamped;

  // Copies share one page drawing, so 35 copies cost little more than one.
  const out = await PDFDocument.create();
  const [embedded] = await out.embedPdf(stamped, [0]);
  for (let i = 0; i < n; i++) {
    const p = out.addPage([embedded.width, embedded.height]);
    p.drawPage(embedded);
  }
  out.setTitle(docTitle);
  out.setCreator("Dala");
  return out.save();
}
