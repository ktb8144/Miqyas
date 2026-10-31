import { PDFDict, PDFDocument, PDFHexString, PDFName, PDFString } from "pdf-lib";
import type { PrintedQr } from "./printed-qr";
import type { OmrTemplate } from "./types";

/**
 * A Dala master question sheet: the PDF the content team uploads for a test.
 *
 * It is the finished sheet minus what changes per class (QR, class name) and per school (school name
 * in the title). It carries its own layout in the PDF Info dictionary under "DalaSheet": the reader
 * template (where every bubble is) and where to stamp the class-specific parts. One file, so the
 * printed layout and the reader can never drift apart. Made by scripts/sheets/dala_sheets.py master.
 *
 * All stamp positions are in millimetres from the page's top-left corner.
 */

export const SHEET_MASTER_KEY = "DalaSheet";

export type SheetStampLayout = {
  page: { width: number; height: number };
  /** e.g. "تدريب الرياضيات"; printed after the school name. */
  subjectTitle: string;
  title: {
    right: number;
    left: number;
    baseline: number;
    size: number;
    minSize: number;
    /** Space between the school name, the bar and the subject at full size (mm). */
    gap: number;
    bar: { width: number; above: number; below: number; color: string };
    /** Used when the school name is too long for one line: it moves above the title (ending at `right`, clear of the corner square). */
    twoLine: { right?: number; baseline: number; size: number; minSize: number };
  };
  classLabel: { cx: number; baseline: number; size: number; minSize: number; maxWidth: number; prefix: string };
  qr: { x: number; y: number; size: number };
};

export type SheetMasterTemplate = OmrTemplate & { printedQr: PrintedQr };

export type SheetMaster = {
  version: 1;
  /** Test id printed in the footer, e.g. DALA-G6-C1-MATH-10-V5. */
  sheet: string;
  template: SheetMasterTemplate;
  stamp: SheetStampLayout;
};

function isSheetMaster(value: unknown): value is SheetMaster {
  const v = value as SheetMaster | null;
  return (
    !!v &&
    v.version === 1 &&
    typeof v.sheet === "string" &&
    Array.isArray(v.template?.questions) &&
    v.template.questions.length > 0 &&
    typeof v.template.printedQr?.size === "number" &&
    typeof v.stamp?.qr?.size === "number" &&
    typeof v.stamp?.title?.baseline === "number" &&
    typeof v.stamp?.classLabel?.baseline === "number"
  );
}

/** The master layout stored in an already-loaded PDF, or null for an ordinary question PDF. */
export function readSheetMasterFromDoc(doc: PDFDocument): SheetMaster | null {
  const infoRef = doc.context.trailerInfo.Info;
  if (!infoRef) return null;
  const info = doc.context.lookup(infoRef);
  if (!(info instanceof PDFDict)) return null;
  const raw = info.get(PDFName.of(SHEET_MASTER_KEY));
  const text = raw instanceof PDFString || raw instanceof PDFHexString ? raw.decodeText() : null;
  if (!text) return null;
  try {
    const parsed: unknown = JSON.parse(text);
    return isSheetMaster(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function readSheetMaster(bytes: ArrayBuffer | Uint8Array): Promise<SheetMaster | null> {
  try {
    const doc = await PDFDocument.load(bytes, { updateMetadata: false, ignoreEncryption: true });
    return readSheetMasterFromDoc(doc);
  } catch {
    return null;
  }
}

/** Downloads a question PDF and returns its bytes and master layout (null layout for ordinary PDFs). */
export async function fetchSheetMaster(url: string): Promise<{ bytes: Uint8Array; master: SheetMaster | null }> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("تعذّر تحميل ورقة الأسئلة");
  const bytes = new Uint8Array(await res.arrayBuffer());
  return { bytes, master: await readSheetMaster(bytes) };
}
