"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toEnglishDigits } from "@/lib/format";
import { shrinkImage } from "@/lib/import/shrink-image";
import {
  BASELINE_TEMPLATE_CSV,
  DOMAIN_SUGGESTIONS,
  NAFS_GRADES,
  baselinesFromTable,
  subjectsForGrade,
  type NafsBaseline,
  type NafsSubject,
} from "@/lib/nafs/baseline";

type FormDomain = { name: string; percent: string };
type FormRow = {
  overall: string;
  mastery: string;
  tested: string;
  absent: string;
  domains: FormDomain[];
  levels: FormDomain[];
};

const keyOf = (year: number, grade: number, subject: string) => `${year}|${grade}|${subject}`;
const gradeName = (grade: number) => (grade === 3 ? "الثالث" : "السادس");
// Keep in step with MAX_TOTAL_BYTES in app/api/principal/nafs-report/route.ts.
const MAX_REPORT_BYTES = 4_200_000;
const str = (value: number | null | undefined) => (value === null || value === undefined ? "" : String(value));

function emptyRow(subject: NafsSubject): FormRow {
  return { overall: "", mastery: "", tested: "", absent: "", domains: DOMAIN_SUGGESTIONS[subject].map((name) => ({ name, percent: "" })), levels: [] };
}

function toForm(b: NafsBaseline): FormRow {
  return {
    overall: str(b.overallPercent),
    mastery: str(b.masteryPercent),
    tested: str(b.testedCount),
    absent: str(b.absentCount),
    domains: b.domains.length ? b.domains.map((d) => ({ name: d.name, percent: String(d.percent) })) : DOMAIN_SUGGESTIONS[b.subject].map((name) => ({ name, percent: "" })),
    levels: b.levels.map((l) => ({ name: l.name, percent: String(l.percent) })),
  };
}

function num(value: string) {
  const cleaned = toEnglishDigits(value).replace("%", "").trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

function toBaseline(year: number, grade: 3 | 6, subject: NafsSubject, row: FormRow): NafsBaseline | null | "invalid" {
  const overall = num(row.overall);
  const mastery = num(row.mastery);
  const tested = num(row.tested);
  const absent = num(row.absent);
  const named = (list: FormDomain[]) =>
    list.map((d) => ({ name: d.name.trim(), percent: num(d.percent) })).filter((d) => d.name && d.percent !== null);
  const domains = named(row.domains);
  const levels = named(row.levels);
  const percents = [overall, mastery, ...domains.map((d) => d.percent), ...levels.map((l) => l.percent)];
  const all = [tested, absent, ...percents];
  if (all.every((v) => v === null)) return null;
  if (all.some((v) => v !== null && (Number.isNaN(v) || v < 0))) return "invalid";
  if (percents.some((v) => v !== null && v > 100)) return "invalid";
  return {
    year,
    grade,
    subject,
    overallPercent: overall,
    masteryPercent: mastery,
    testedCount: tested === null ? null : Math.round(tested),
    absentCount: absent === null ? null : Math.round(absent),
    domains: domains.map((d) => ({ name: d.name, percent: d.percent as number })),
    levels: levels.map((l) => ({ name: l.name, percent: l.percent as number })),
  };
}

/** Principal enters (or imports) last year's NAFS results; Dala builds the situation report and plan from them. */
export function NafsBaselineTab() {
  const [forms, setForms] = useState<Record<string, FormRow>>({});
  const [savedYears, setSavedYears] = useState<number[]>([]);
  const [year, setYear] = useState(new Date().getFullYear() - 1);
  const [grade, setGrade] = useState<3 | 6>(6);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [readerEnabled, setReaderEnabled] = useState(false);
  const [reading, setReading] = useState(false);
  // What the last report upload filled in: the principal reviews it before anything is saved.
  const [review, setReview] = useState<{ keys: string[]; warnings: string[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const reportRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/principal/nafs-baseline", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) throw new Error(json.error || "تعذر تحميل نتائج نافس");
      const baselines = json.baselines as NafsBaseline[];
      setReaderEnabled(Boolean(json.reportReaderEnabled));
      const next: Record<string, FormRow> = {};
      baselines.forEach((b) => { next[keyOf(b.year, b.grade, b.subject)] = toForm(b); });
      setForms(next);
      const years = Array.from(new Set(baselines.map((b) => b.year))).sort((a, b) => b - a);
      setSavedYears(years);
      if (years.length) setYear(years[0]);
    } catch (err) {
      setMessage({ tone: "error", text: err instanceof Error ? err.message : "تعذر تحميل نتائج نافس" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const subjects = subjectsForGrade(grade);
  const rowFor = (subject: NafsSubject) => forms[keyOf(year, grade, subject)] ?? emptyRow(subject);
  const update = (subject: NafsSubject, patch: Partial<FormRow>) =>
    setForms((prev) => ({ ...prev, [keyOf(year, grade, subject)]: { ...rowFor(subject), ...patch } }));

  const yearOptions = useMemo(() => {
    const current = new Date().getFullYear();
    return Array.from(new Set([...savedYears, current - 1, current - 2, current - 3, year])).sort((a, b) => b - a);
  }, [savedYears, year]);

  const save = async (keys?: string[], source: Record<string, FormRow> = forms): Promise<boolean> => {
    setMessage(null);
    const targets = keys ?? subjects.map((subject) => keyOf(year, grade, subject));
    const baselines: NafsBaseline[] = [];
    for (const key of targets) {
      const [y, g, subject] = key.split("|");
      const row = source[key];
      if (!row) continue;
      const baseline = toBaseline(Number(y), Number(g) === 3 ? 3 : 6, subject as NafsSubject, row);
      if (baseline === "invalid") {
        setMessage({ tone: "error", text: `تحقق من قيم ${subject} (${y}): النسب بين 0 و100.` });
        setYear(Number(y));
        setGrade(Number(g) === 3 ? 3 : 6);
        return false;
      }
      if (baseline) baselines.push(baseline);
    }
    if (!baselines.length) {
      setMessage({ tone: "error", text: "أدخل نسبة واحدة على الأقل قبل الحفظ." });
      return false;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/principal/nafs-baseline", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baselines }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) throw new Error(json.error || "تعذر الحفظ");
      setSavedYears((prev) => Array.from(new Set([...prev, ...baselines.map((b) => b.year)])).sort((a, b) => b - a));
      setMessage({ tone: "ok", text: `حُفظت ${toEnglishDigits(baselines.length)} مادة. افتح «الوضع وخطة التحسين» لرؤية النتيجة.` });
      return true;
    } catch (err) {
      setMessage({ tone: "error", text: err instanceof Error ? err.message : "تعذر الحفظ" });
      return false;
    } finally {
      setSaving(false);
    }
  };

  /** Uploads the NAFS report (PDF or photos); the numbers fill the form for review, unsaved. */
  const readReport = async (list: FileList | null) => {
    const picked = Array.from(list ?? []);
    if (reportRef.current) reportRef.current.value = "";
    if (!picked.length) return;
    setMessage(null);
    setReading(true);
    try {
      const files = await Promise.all(picked.map((file) => shrinkImage(file)));
      if (files.reduce((sum, f) => sum + f.size, 0) > MAX_REPORT_BYTES) {
        throw new Error("حجم الملف كبير. أرسل التقرير بحجم أصغر من 4 ميجابايت، أو صوّر صفحاته.");
      }
      const body = new FormData();
      files.forEach((file) => body.append("files", file));
      const res = await fetch("/api/principal/nafs-report", { method: "POST", body });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) throw new Error(json.error || "تعذرت قراءة التقرير");
      const read = json.baselines as NafsBaseline[];
      const next = { ...forms };
      read.forEach((b) => { next[keyOf(b.year, b.grade, b.subject)] = toForm(b); });
      setForms(next);
      setYear(read[0].year);
      setGrade(read[0].grade);
      setReview({ keys: read.map((b) => keyOf(b.year, b.grade, b.subject)), warnings: (json.warnings as string[]) ?? [] });
    } catch (err) {
      setMessage({ tone: "error", text: err instanceof Error ? err.message : "تعذرت قراءة التقرير" });
    } finally {
      setReading(false);
    }
  };

  const approveReview = async () => {
    if (!review) return;
    if (await save(review.keys)) setReview(null);
  };

  const discardReview = async () => {
    setReview(null);
    setMessage(null);
    await load();
  };

  const importFile = async (file: File | undefined) => {
    if (!file) return;
    setMessage(null);
    try {
      const sheets = await (await import("@/lib/import/table-file")).readTableFile(file);
      const imported = sheets.flatMap((sheet) => baselinesFromTable(sheet.rows));
      if (!imported.length) throw new Error("لم نجد الأعمدة المطلوبة: السنة، الصف، المادة، المجال، النسبة. استخدم القالب.");
      const next = { ...forms };
      imported.forEach((b) => { next[keyOf(b.year, b.grade, b.subject)] = toForm(b); });
      setForms(next);
      const first = imported[0];
      setYear(first.year);
      setGrade(first.grade);
      await save(imported.map((b) => keyOf(b.year, b.grade, b.subject)), next);
    } catch (err) {
      setMessage({ tone: "error", text: err instanceof Error ? err.message : "تعذر قراءة الملف" });
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const downloadTemplate = () => {
    const blob = new Blob(["﻿" + BASELINE_TEMPLATE_CSV], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "قالب-نتائج-نافس.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <p className="rounded-2xl bg-white p-6 text-center text-sm font-bold text-slate-400">جارٍ تحميل نتائج نافس...</p>;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-xl font-black text-brand-navy">نتائج نافس السابقة</h3>
          <p className="text-sm font-bold text-slate-400">ارفع تقرير المدرسة أو أدخل الأرقام مرة واحدة، وتبني دالة منها تقرير الوضع وخطة التحسين.</p>
        </div>
        <a
          href="/dashboard/principal/nafs-plan"
          target="_blank"
          rel="noreferrer"
          className="rounded-xl bg-brand px-4 py-2 text-sm font-extrabold text-white transition hover:bg-brand-dark"
        >
          الوضع وخطة التحسين
        </a>
      </div>

      {readerEnabled ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-dashed border-brand/30 bg-teal-50/40 p-4">
          <div className="min-w-0">
            <p className="text-base font-black text-brand-navy">ارفع تقرير نافس كما وصلك</p>
            <p className="text-xs font-bold leading-6 text-slate-500">
              ملف PDF أو صور الصفحات. تقرأ دالة الأرقام وتعرضها لك للمراجعة قبل الحفظ، ولا يُحفظ الملف نفسه.
            </p>
          </div>
          <input
            ref={reportRef}
            type="file"
            accept="application/pdf,image/*"
            multiple
            className="hidden"
            onChange={(e) => void readReport(e.target.files)}
          />
          <button
            onClick={() => reportRef.current?.click()}
            disabled={reading || saving}
            className="rounded-xl bg-brand px-5 py-2.5 text-sm font-extrabold text-white disabled:opacity-60"
          >
            {reading ? "جارٍ قراءة التقرير... (حتى دقيقة)" : "رفع التقرير (PDF أو صور)"}
          </button>
        </div>
      ) : (
        <p className="rounded-xl bg-slate-50 p-3 text-xs font-bold text-slate-500">
          قراءة تقارير PDF غير مفعّلة حاليًا؛ أدخل الأرقام يدويًا أو من قالب Excel.
        </p>
      )}

      {message && (
        <p role="status" className={`rounded-xl p-3 text-sm font-bold ${message.tone === "ok" ? "bg-teal-50 text-brand" : "bg-red-50 text-red-700"}`}>
          {message.text}
        </p>
      )}

      {review && (
        <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-black text-amber-900">
            قرأنا {toEnglishDigits(review.keys.length)} نتيجة من التقرير ولم تُحفظ بعد. راجع الأرقام في كل نتيجة (اضغط عليها لعرضها) وصحّح ما يلزم، ثم اعتمدها.
          </p>
          {review.warnings.length > 0 && (
            <ul className="list-inside list-disc space-y-1 text-xs font-bold leading-6 text-amber-800">
              {review.warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          )}
          <div className="flex flex-wrap gap-1.5">
            {review.keys.map((key) => {
              const [y, g, subject] = key.split("|");
              const active = Number(y) === year && Number(g) === grade;
              return (
                <button
                  key={key}
                  onClick={() => { setYear(Number(y)); setGrade(Number(g) === 3 ? 3 : 6); }}
                  className={`rounded-lg px-2.5 py-1 text-xs font-extrabold ${active ? "bg-amber-600 text-white" : "bg-white text-amber-800"}`}
                >
                  {toEnglishDigits(y)} · {gradeName(Number(g))} · {subject}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => void approveReview()} disabled={saving} className="rounded-xl bg-brand px-4 py-2 text-sm font-extrabold text-white disabled:opacity-60">
              {saving ? "جارٍ الحفظ..." : `اعتماد وحفظ (${toEnglishDigits(review.keys.length)})`}
            </button>
            <button onClick={() => void discardReview()} disabled={saving} className="rounded-xl border border-amber-300 px-4 py-2 text-sm font-extrabold text-amber-800 disabled:opacity-60">
              إلغاء
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-100 bg-white p-3">
        <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold">
          {yearOptions.map((y) => <option key={y} value={y}>{toEnglishDigits(y)}</option>)}
        </select>
        <div className="flex rounded-xl border border-slate-200 p-0.5 text-sm font-extrabold">
          {NAFS_GRADES.map((g) => (
            <button key={g} onClick={() => setGrade(g)} className={`rounded-lg px-3 py-1.5 ${grade === g ? "bg-brand text-white" : "text-slate-500"}`}>
              الصف {gradeName(g)}
            </button>
          ))}
        </div>
        <span className="flex-1" />
        <input ref={fileRef} type="file" accept=".xlsx,.csv,.txt" className="hidden" onChange={(e) => void importFile(e.target.files?.[0])} />
        <button onClick={() => fileRef.current?.click()} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-extrabold text-slate-600 hover:text-brand">
          استيراد من Excel
        </button>
        <button onClick={downloadTemplate} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-extrabold text-slate-600 hover:text-brand">
          تحميل القالب
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {subjects.map((subject) => {
          const row = rowFor(subject);
          return (
            <div key={subject} className="rounded-2xl border border-slate-100 bg-white p-4">
              <h4 className="mb-3 text-base font-black text-brand-navy">{subject}</h4>
              <div className="mb-3 grid grid-cols-2 gap-2">
                {([
                  ["overall", "متوسط الأداء %"],
                  ["mastery", "نسبة التمكن %"],
                  ["tested", "عدد المختبرين"],
                  ["absent", "عدد الغائبين"],
                ] as const).map(([field, label]) => (
                  <label key={field} className="text-[11px] font-bold text-slate-500">
                    {label}
                    <input
                      inputMode="decimal"
                      value={row[field]}
                      onChange={(e) => update(subject, { [field]: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm font-bold text-brand-navy"
                    />
                  </label>
                ))}
              </div>
              <p className="mb-1 text-[11px] font-bold text-slate-500">المجالات (النسبة من التقرير)</p>
              <div className="space-y-1.5">
                {row.domains.map((domain, index) => (
                  <div key={index} className="flex gap-1.5">
                    <input
                      value={domain.name}
                      onChange={(e) => update(subject, { domains: row.domains.map((d, i) => (i === index ? { ...d, name: e.target.value } : d)) })}
                      className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-bold"
                    />
                    <input
                      inputMode="decimal"
                      value={domain.percent}
                      placeholder="%"
                      onChange={(e) => update(subject, { domains: row.domains.map((d, i) => (i === index ? { ...d, percent: e.target.value } : d)) })}
                      className="w-16 rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-bold"
                    />
                    <button
                      onClick={() => update(subject, { domains: row.domains.filter((_, i) => i !== index) })}
                      aria-label="حذف المجال"
                      className="px-1 text-slate-300 hover:text-red-500"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={() => update(subject, { domains: [...row.domains, { name: "", percent: "" }] })}
                className="mt-2 text-xs font-extrabold text-brand"
              >
                + مجال
              </button>
              <p className="mb-1 mt-3 text-[11px] font-bold text-slate-500">توزيع الطلاب على مستويات الأداء % (اختياري)</p>
              <div className="space-y-1.5">
                {row.levels.map((level, index) => (
                  <div key={index} className="flex gap-1.5">
                    <input
                      value={level.name}
                      placeholder="المستوى"
                      onChange={(e) => update(subject, { levels: row.levels.map((l, i) => (i === index ? { ...l, name: e.target.value } : l)) })}
                      className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-bold"
                    />
                    <input
                      inputMode="decimal"
                      value={level.percent}
                      placeholder="%"
                      onChange={(e) => update(subject, { levels: row.levels.map((l, i) => (i === index ? { ...l, percent: e.target.value } : l)) })}
                      className="w-16 rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-bold"
                    />
                    <button
                      onClick={() => update(subject, { levels: row.levels.filter((_, i) => i !== index) })}
                      aria-label="حذف المستوى"
                      className="px-1 text-slate-300 hover:text-red-500"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={() => update(subject, { levels: [...row.levels, { name: "", percent: "" }] })}
                className="mt-2 text-xs font-extrabold text-brand"
              >
                + مستوى
              </button>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button onClick={() => void save()} disabled={saving} className="rounded-xl bg-brand px-5 py-2.5 text-sm font-extrabold text-white disabled:opacity-60">
          {saving ? "جارٍ الحفظ..." : `حفظ نتائج ${toEnglishDigits(year)} للصف ${gradeName(grade)}`}
        </button>
        <p className="text-xs font-bold text-slate-400">أدخل عامين متتاليين ليظهر اتجاه التحسن أو التراجع.</p>
      </div>
    </div>
  );
}
