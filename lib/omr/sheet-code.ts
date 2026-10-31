import QRCode from "qrcode";

/**
 * The class QR printed on Dala sheets.
 *
 * Every class_package_assignment (one test for one class) gets a 7-character code from the database
 * on insert (migration 20261031010000). The QR holds HTTPS://DALAEDU.COM/R/<code>: uppercase keeps it in
 * alphanumeric mode, so it fits QR version 2 with error correction Q.
 *
 * Version, error correction, a single alphanumeric segment and mask pattern 2 are all fixed, so the
 * modules drawn on paper can be rebuilt exactly when scanning (see printed-qr.ts). The offline sheet
 * generator uses the same settings (Python qrcode, mask_pattern=2) and produces identical modules.
 */

export const SHEET_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const SHEET_CODE_LENGTH = 7;
export const SHEET_QR_PREFIX = "HTTPS://DALAEDU.COM/R/";
export const SHEET_QR_VERSION = 2;
export const SHEET_QR_MASK = 2;

const CODE_RE = new RegExp(`^[${SHEET_CODE_ALPHABET}]{${SHEET_CODE_LENGTH}}$`);

export function isSheetCode(value: string): boolean {
  return CODE_RE.test(value);
}

export function sheetCodeUrl(code: string): string {
  if (!isSheetCode(code)) throw new Error(`invalid sheet code: ${code}`);
  return SHEET_QR_PREFIX + code;
}

/** The code inside a scanned QR text or a /R/<code> path, or null. Accepts any letter case. */
export function sheetCodeFromText(text: string): string | null {
  const match = /\/R\/([A-Za-z0-9]+)\/?$/i.exec(text.trim());
  const code = match?.[1]?.toUpperCase() ?? "";
  return isSheetCode(code) ? code : null;
}

/** QR modules for a sheet code: 25 rows of "1" (dark) / "0" (light). Use for printing and for matching. */
export function sheetQrModules(code: string): string[] {
  const qr = QRCode.create([{ data: sheetCodeUrl(code), mode: "alphanumeric" }], {
    version: SHEET_QR_VERSION,
    errorCorrectionLevel: "Q",
    maskPattern: SHEET_QR_MASK,
  });
  const size = qr.modules.size;
  const rows: string[] = [];
  for (let y = 0; y < size; y++) {
    let row = "";
    for (let x = 0; x < size; x++) row += qr.modules.get(y, x) ? "1" : "0";
    rows.push(row);
  }
  return rows;
}

/** SVG of the QR in millimetres, for the print page. No quiet zone: the sheet layout leaves white around it. */
export function sheetQrSvg(code: string, sizeMm: number): string {
  const rows = sheetQrModules(code);
  const n = rows.length;
  const cell = sizeMm / n;
  const rects: string[] = [];
  rows.forEach((row, y) => {
    for (let x = 0; x < n; ) {
      if (row[x] !== "1") { x++; continue; }
      const start = x;
      while (x < n && row[x] === "1") x++;
      rects.push(`<rect x="${(start * cell).toFixed(4)}" y="${(y * cell).toFixed(4)}" width="${((x - start) * cell + 0.01).toFixed(4)}" height="${(cell + 0.01).toFixed(4)}"/>`);
    }
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${sizeMm} ${sizeMm}" width="${sizeMm}mm" height="${sizeMm}mm" shape-rendering="crispEdges" fill="#000">${rects.join("")}</svg>`;
}
