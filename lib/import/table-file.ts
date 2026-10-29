"use client";

import readXlsxFile from "read-excel-file/universal";

/**
 * Reads a spreadsheet the user picked into plain rows of text, entirely in the browser.
 * Supports .xlsx, .csv/.txt, and the HTML-table ".xls" files that Noor and similar systems export.
 * Old binary .xls files are not supported; the message asks the user to save them as .xlsx.
 */

export type TableSheet = { name: string; rows: string[][] };

const MAX_BYTES = 5 * 1024 * 1024;

function decodeText(buffer: ArrayBuffer) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer).replace(/^﻿/, "");
  } catch {
    // Excel on Arabic Windows saves CSV as Windows-1256.
    return new TextDecoder("windows-1256").decode(buffer);
  }
}

function parseCsv(text: string): string[][] {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = [",", ";", "\t"].sort((a, b) => firstLine.split(b).length - firstLine.split(a).length)[0];
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delimiter) { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((value) => value.trim()));
}

function parseHtmlTables(text: string): TableSheet[] {
  const doc = new DOMParser().parseFromString(text, "text/html");
  return Array.from(doc.querySelectorAll("table")).map((table, index) => ({
    name: `جدول ${index + 1}`,
    rows: Array.from(table.querySelectorAll("tr")).map((tr) =>
      Array.from(tr.querySelectorAll("th,td")).map((cell) => (cell.textContent ?? "").trim())
    ),
  }));
}

export async function readTableFile(file: File): Promise<TableSheet[]> {
  if (file.size > MAX_BYTES) throw new Error("الملف أكبر من 5 ميجابايت. صدّر كشف الفصل فقط.");
  const name = file.name.toLowerCase();
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer.slice(0, 8));
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b; // .xlsx is a zip
  const isOldExcel = bytes[0] === 0xd0 && bytes[1] === 0xcf; // binary .xls

  if (isZip) {
    const sheets = await readXlsxFile(buffer);
    return sheets.map((sheet) => ({
      name: sheet.sheet,
      rows: sheet.data.map((row) => row.map((value) => (value === null || value === undefined ? "" : String(value)))),
    }));
  }
  if (isOldExcel) {
    throw new Error("هذا ملف Excel قديم (xls). افتحه في Excel واحفظه بصيغة xlsx أو CSV ثم ارفعه.");
  }
  const text = decodeText(buffer);
  if (/^\s*</.test(text) && /<table/i.test(text)) {
    const tables = parseHtmlTables(text);
    if (tables.length) return tables;
  }
  if (name.endsWith(".csv") || name.endsWith(".txt") || name.endsWith(".xls")) {
    return [{ name: file.name, rows: parseCsv(text) }];
  }
  throw new Error("صيغة الملف غير مدعومة. استخدم xlsx أو CSV.");
}
