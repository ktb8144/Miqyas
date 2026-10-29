"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toEnglishDigits } from "@/lib/format";
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
};

const keyOf = (year: number, grade: number, subject: string) => `${year}|${grade}|${subject}`;
const str = (value: number | null | undefined) => (value === null || value === undefined ? "" : String(value));

function emptyRow(subject: NafsSubject): FormRow {
  return { overall: "", mastery: "", tested: "", absent: "", domains: DOMAIN_SUGGESTIONS[subject].map((name) => ({ name, percent: "" })) };
}

function toForm(b: NafsBaseline): FormRow {
  return {
    overall: str(b.overallPercent),
    mastery: str(b.masteryPercent),
    tested: str(b.testedCount),
    absent: str(b.absentCount),
    domains: b.domains.length ? b.domains.map((d) => ({ name: d.name, percent: String(d.percent) })) : DOMAIN_SUGGESTIONS[b.subject].map((name) => ({ name, percent: "" })),
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
  const domains = row.domains
    .map((d) => ({ name: d.name.trim(), percent: num(d.percent) }))
    .filter((d) => d.name && d.percent !== null);
  const all = [overall, mastery, tested, absent, ...domains.map((d) => d.percent)];
  if (all.every((v) => v === null)) return null;
  if (all.some((v) => v !== null && (Number.isNaN(v) || v < 0))) return "invalid";
  if ([overall, mastery, ...domains.map((d) => d.percent)].some((v) => v !== null && v > 100)) return "invalid";
  return {
    year,
    grade,
    subject,
    overallPercent: overall,
    masteryPercent: mastery,
    testedCount: tested === null ? null : Math.round(tested),
    absentCount: absent === null ? null : Math.round(absent),
    domains: domains.map((d) => ({ name: d.name, percent: d.percent as number })),
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
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/principal/nafs-baseline", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) throw new Error(json.error || "تعذر تحميل نتائج نافس");
      const baselines = json.baselines as NafsBaseline[];
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

  const save = async (keys?: string[], source: Record<string, FormRow> = forms) => {
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
        return;
      }
      if (baseline) baselines.push(baseline);
    }
    if (!baselines.length) {
      setMessage({ tone: "error", text: "أدخل نسبة واحدة على الأقل قبل الحفظ." });
      return;
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
    } catch (err) {
      setMessage({ tone: "error", text: err instanceof Error ? err.message : "تعذر الحفظ" });
    } finally {
      setSaving(false);
    }
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
          <p className="text-sm font-bold text-slate-400">أدخلها من تقرير المدرسة مرة واحدة، وتبني دالة منها تقرير الوضع وخطة التحسين.</p>
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

      {message && (
        <p role="status" className={`rounded-xl p-3 text-sm font-bold ${message.tone === "ok" ? "bg-teal-50 text-brand" : "bg-red-50 text-red-700"}`}>
          {message.text}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-100 bg-white p-3">
        <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold">
          {yearOptions.map((y) => <option key={y} value={y}>{toEnglishDigits(y)}</option>)}
        </select>
        <div className="flex rounded-xl border border-slate-200 p-0.5 text-sm font-extrabold">
          {NAFS_GRADES.map((g) => (
            <button key={g} onClick={() => setGrade(g)} className={`rounded-lg px-3 py-1.5 ${grade === g ? "bg-brand text-white" : "text-slate-500"}`}>
              الصف {g === 3 ? "الثالث" : "السادس"}
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
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button onClick={() => void save()} disabled={saving} className="rounded-xl bg-brand px-5 py-2.5 text-sm font-extrabold text-white disabled:opacity-60">
          {saving ? "جارٍ الحفظ..." : `حفظ نتائج ${toEnglishDigits(year)} للصف ${grade === 3 ? "الثالث" : "السادس"}`}
        </button>
        <p className="text-xs font-bold text-slate-400">أدخل عامين متتاليين ليظهر اتجاه التحسن أو التراجع.</p>
      </div>
    </div>
  );
}
