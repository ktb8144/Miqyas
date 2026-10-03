export function toEnglishDigits(value: string | number | null | undefined) {
  if (value === null || value === undefined) return "";

  const digitMap: Record<string, string> = {
    "٠": "0",
    "١": "1",
    "٢": "2",
    "٣": "3",
    "٤": "4",
    "٥": "5",
    "٦": "6",
    "٧": "7",
    "٨": "8",
    "٩": "9",
    "۰": "0",
    "۱": "1",
    "۲": "2",
    "۳": "3",
    "۴": "4",
    "۵": "5",
    "۶": "6",
    "۷": "7",
    "۸": "8",
    "۹": "9",
  };

  return String(value).replace(/[٠-٩۰-۹]/g, (digit) => digitMap[digit] ?? digit);
}

/** Student code as plain digits without leading zeros ("٠٠١٢" → "12"). */
export function normalizeStudentCode(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number") return "";
  const digits = toEnglishDigits(value).replace(/[^\d]/g, "");
  if (!digits) return "";
  const numeric = Number(digits);
  return Number.isFinite(numeric) ? String(numeric) : digits;
}

function cleanDatePart(value: string | null | undefined) {
  return toEnglishDigits(value)
    .replace(/[\u200e\u200f\u061c]/g, "")
    .replace(/\s+/g, "")
    .trim();
}

function parseSlashDate(value: string | null | undefined) {
  const clean = cleanDatePart(value).replace(/هـ/g, "");
  const parts = clean.split("/");
  if (parts.length !== 3) return null;

  const [day, month, year] = parts;
  if (!day || !month || !year) return null;

  return {
    day: day.padStart(2, "0"),
    month: month.padStart(2, "0"),
    year,
  };
}

function parseIsoDate(value: string | null | undefined) {
  const clean = cleanDatePart(value);
  const parts = clean.split("-");
  if (parts.length !== 3) return parseSlashDate(value);

  const [year, month, day] = parts;
  if (!day || !month || !year) return null;

  return {
    day: day.padStart(2, "0"),
    month: month.padStart(2, "0"),
    year,
  };
}

function formatRange(
  start: ReturnType<typeof parseSlashDate>,
  end: ReturnType<typeof parseSlashDate>
) {
  if (!start || !end) return "";

  if (start.month === end.month && start.year === end.year) {
    return `${start.day}-${end.day}/${start.month}/${start.year}`;
  }

  if (start.year === end.year) {
    return `${start.day}/${start.month}-${end.day}/${end.month}/${end.year}`;
  }

  return `${start.day}/${start.month}/${start.year}-${end.day}/${end.month}/${end.year}`;
}

export function formatSchoolDateRange({
  startDate,
  endDate,
  startHijri,
  endHijri,
}: {
  startDate: string | null | undefined;
  endDate: string | null | undefined;
  startHijri: string | null | undefined;
  endHijri: string | null | undefined;
}) {
  const hijriRange = formatRange(parseSlashDate(startHijri), parseSlashDate(endHijri));
  const gregorianRange = formatRange(parseIsoDate(startDate), parseIsoDate(endDate));

  if (hijriRange && gregorianRange) return `${hijriRange}هـ (${gregorianRange})`;
  if (hijriRange) return `${hijriRange}هـ`;
  if (gregorianRange) return gregorianRange;
  return "";
}

/** 1234 → "1,234" with Latin digits. */
export function formatNumber(value: number) {
  return toEnglishDigits(new Intl.NumberFormat("en-US").format(value));
}

/** Saudi mobile in local form: "+966 5x…" / "5x…" → "05x…". */
export function normalizeSaudiMobile(value: string) {
  const digits = toEnglishDigits(value).replace(/\D/g, "");
  if (digits.startsWith("9665") && digits.length === 12) return `0${digits.slice(3)}`;
  if (digits.startsWith("5") && digits.length === 9) return `0${digits}`;
  return digits;
}

/** Trim and collapse inner whitespace in a person's name. */
export function cleanName(name: string) {
  return name.trim().replace(/\s+/g, " ");
}

/** Comparison key for names (cleaned + lower-cased). */
export function normalizeName(name: string) {
  return cleanName(name).toLowerCase();
}

const SHORT_DATE = new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** ISO date → "3 أكتوبر 2026" (Gregorian, Latin digits); "—" when missing. */
export function formatShortDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : SHORT_DATE.format(date);
}
