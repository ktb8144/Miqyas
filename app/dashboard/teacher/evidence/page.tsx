"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Printer } from "lucide-react";
import { BRAND } from "@/lib/brand";
import { formatShortDate, toEnglishDigits } from "@/lib/format";
import { ETEC_LEVELS, levelColor, type LevelName } from "@/lib/levels";
import type { TeacherEvidence } from "@/lib/teachers/evidence";

const LEVELS: LevelName[] = ["متقدم", "متمكن", "أساسي", "دون الأساسي"];

function isoDaysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

const PRESETS = [
  { label: "كل الفترات", from: "", to: "" },
  { label: "آخر 30 يومًا", from: isoDaysAgo(30), to: "" },
  { label: "آخر 90 يومًا", from: isoDaysAgo(90), to: "" },
];

function pct(value: number | null) {
  return value === null ? "—" : `${toEnglishDigits(value)}%`;
}

export default function TeacherEvidencePage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [data, setData] = useState<TeacherEvidence | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const res = await fetch(`/api/teacher/evidence?${params}`, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) throw new Error(json.error || "تعذر تحميل ملف الشواهد");
      setData(json.data as TeacherEvidence);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تحميل ملف الشواهد");
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="min-h-screen bg-[#f7fafc] text-brand-navy print:bg-white" dir="rtl">
      <style>{`@page { size: A4; margin: 12mm; } @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }`}</style>

      {/* Toolbar — screen only */}
      <div className="sticky top-0 z-40 border-b border-slate-100 bg-white/90 backdrop-blur-xl print:hidden">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-4">
          <Link href="/dashboard/teacher" className="inline-flex items-center gap-2 text-sm font-extrabold text-slate-500 hover:text-brand">
            <ArrowRight className="h-4 w-4" />
            لوحة المعلم
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => {
                  setFrom(p.from);
                  setTo(p.to);
                }}
                className={`rounded-xl border px-3 py-2 text-xs font-extrabold transition ${
                  from === p.from && to === p.to ? "border-brand bg-teal-50 text-brand" : "border-slate-200 bg-white text-slate-500 hover:border-brand/40"
                }`}
              >
                {p.label}
              </button>
            ))}
            <label className="flex items-center gap-1 text-xs font-bold text-slate-500">
              من
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs" />
            </label>
            <label className="flex items-center gap-1 text-xs font-bold text-slate-500">
              إلى
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs" />
            </label>
            <button
              onClick={() => window.print()}
              disabled={!data || !data.entries.length}
              className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-extrabold text-white transition hover:bg-brand-dark disabled:opacity-50"
            >
              <Printer className="h-4 w-4" />
              طباعة / حفظ PDF
            </button>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-5xl px-5 py-8 print:max-w-none print:px-0 print:py-0">
        {loading && <div className="rounded-2xl border border-slate-100 bg-white p-8 text-center font-bold text-slate-500">جارٍ تجهيز ملف الشواهد...</div>}
        {error && <div className="rounded-2xl border border-red-100 bg-red-50 p-5 font-bold text-red-700">{error}</div>}
        {data && !loading && <EvidenceDocument data={data} />}
      </main>
    </div>
  );
}

function Section({ title, serves, children }: { title: string; serves?: string; children: React.ReactNode }) {
  return (
    <section className="break-inside-avoid-page rounded-[1.25rem] border border-slate-100 bg-white p-6 print:rounded-none print:border-0 print:border-t print:border-slate-200 print:px-0">
      <h2 className="text-lg font-black text-brand-navy">{title}</h2>
      {serves && <p className="mt-1 text-xs font-extrabold text-brand">يخدم بند: {serves}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function EvidenceDocument({ data }: { data: TeacherEvidence }) {
  const periodLabel =
    data.period.from || data.period.to
      ? `${data.period.from ? formatShortDate(data.period.from) : "البداية"} — ${data.period.to ? formatShortDate(data.period.to) : "اليوم"}`
      : "كل الفترات";

  return (
    <div className="space-y-5">
      {/* Document header */}
      <header className="rounded-[1.25rem] border border-slate-100 bg-white p-6 print:rounded-none print:border-0 print:border-b-2 print:border-brand-navy print:px-0">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-extrabold text-brand">{BRAND.nameAr} — {BRAND.tagline}</p>
            <h1 className="mt-1 text-3xl/[1.4] font-black text-brand-navy">ملف شواهد المعلم</h1>
            <p className="mt-2 text-sm font-bold text-slate-500">
              {data.teacher.name}
              {data.teacher.subject ? ` | ${data.teacher.subject}` : ""} | {data.teacher.schoolName}
            </p>
          </div>
          <div className="text-left text-xs font-bold leading-6 text-slate-400">
            <div>الفترة: {periodLabel}</div>
            <div>تاريخ الإصدار: {formatShortDate(new Date().toISOString())}</div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["اختبارات مطبقة", data.totals.testsApplied],
            ["فصول", data.totals.classes],
            ["طلاب مقيَّمون", data.totals.studentsTested],
            ["إجابات محللة", data.totals.answersAnalyzed],
          ].map(([label, value]) => (
            <div key={label as string} className="rounded-xl bg-slate-50 p-3 text-center">
              <div className="text-2xl font-black text-brand-navy">{toEnglishDigits(value as number)}</div>
              <div className="text-xs font-bold text-slate-400">{label}</div>
            </div>
          ))}
        </div>
      </header>

      {!data.entries.length ? (
        <div className="rounded-[1.25rem] border border-dashed border-slate-200 bg-white p-10 text-center">
          <h2 className="text-lg font-black text-brand-navy">لا توجد اختبارات مصححة في هذه الفترة</h2>
          <p className="mt-2 text-sm font-bold text-slate-400">يُضاف كل اختبار إلى ملف الشواهد تلقائيًا بعد تصحيحه وحفظ نتائجه.</p>
        </div>
      ) : (
        <>
          <Section title="سجل التقويم المطبق" serves="تنوع أساليب التقويم">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-right text-xs font-extrabold text-slate-400">
                    <th className="py-2 pl-3">التاريخ</th>
                    <th className="py-2 pl-3">الاختبار</th>
                    <th className="py-2 pl-3">الفصل</th>
                    <th className="py-2 pl-3">المقيَّمون</th>
                    <th className="py-2 pl-3">المتوسط</th>
                    <th className="py-2">توزيع المستويات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {data.entries.map((e) => (
                    <tr key={e.assignmentId} className="align-top">
                      <td className="py-3 pl-3 font-bold text-slate-500">{formatShortDate(e.date)}</td>
                      <td className="py-3 pl-3">
                        <div className="font-extrabold text-brand-navy">{e.title}</div>
                        <div className="text-xs font-bold text-slate-400">
                          {e.typeLabel}
                          {e.weekNumber ? ` · الأسبوع ${toEnglishDigits(e.weekNumber)}` : ""}
                        </div>
                      </td>
                      <td className="py-3 pl-3 font-bold text-slate-600">
                        {e.gradeLabel} — {e.className}
                        <div className="text-xs text-slate-400">{e.subject}</div>
                      </td>
                      <td className="py-3 pl-3 font-bold text-slate-600">
                        {toEnglishDigits(e.studentsTested)}
                        {e.classSize ? <span className="text-slate-400"> / {toEnglishDigits(e.classSize)}</span> : null}
                      </td>
                      <td className="py-3 pl-3 font-black" style={{ color: e.average === null ? undefined : levelColor(e.average) }}>
                        {pct(e.average)}
                      </td>
                      <td className="py-3">
                        <div className="flex h-2.5 w-36 overflow-hidden rounded-full bg-slate-100">
                          {LEVELS.map((level) =>
                            e.distribution[level] ? (
                              <div
                                key={level}
                                style={{ width: `${(e.distribution[level] / Math.max(1, e.studentsTested)) * 100}%`, background: ETEC_LEVELS[level].color }}
                              />
                            ) : null
                          )}
                        </div>
                        <div className="mt-1 text-[11px] font-bold text-slate-400">
                          {LEVELS.map((level) => `${level} ${toEnglishDigits(e.distribution[level])}`).join(" · ")}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section title="تحليل النتائج وتشخيص المستويات" serves="تحليل نتائج المتعلمين وتشخيص مستوياتهم">
            <div className="grid gap-3 sm:grid-cols-2">
              {data.entries.map((e) => (
                <article key={e.assignmentId} className="break-inside-avoid rounded-xl border border-slate-100 p-4">
                  <div className="text-sm font-extrabold text-brand-navy">{e.title}</div>
                  <div className="text-xs font-bold text-slate-400">
                    {e.gradeLabel} — {e.className} · {formatShortDate(e.date)}
                  </div>
                  {e.weakestSkills.length ? (
                    <div className="mt-3 space-y-2">
                      <div className="text-xs font-extrabold text-slate-500">المهارات الأضعف في الفصل:</div>
                      {e.weakestSkills.map((s) => (
                        <div key={s.skill} className="flex items-center justify-between gap-3 text-xs font-bold">
                          <span className="text-slate-600">{s.skill}</span>
                          <span style={{ color: levelColor(s.mastery) }}>
                            {toEnglishDigits(s.mastery)}% <span className="text-slate-400">({toEnglishDigits(s.answers)} إجابة)</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-xs font-bold text-slate-400">لا توجد مهارة بإجابات كافية (5 على الأقل) لتحليلها في هذا الاختبار.</p>
                  )}
                </article>
              ))}
            </div>
          </Section>

          <Section title="نتائج الفصول عبر الأسابيع" serves="تحسين نتائج المتعلمين">
            <p className="mb-4 text-xs font-bold leading-6 text-slate-400">
              كل نقطة اختبار مختلف في محتواه، لذلك تُقرأ هذه النتائج سجلًّا للمتابعة لا قياسًا مباشرًا للتحسن. التحسن الدقيق في القسم التالي.
            </p>
            <div className="space-y-4">
              {data.classTimelines.map((c) => (
                <div key={c.className} className="break-inside-avoid">
                  <div className="mb-2 text-sm font-extrabold text-brand-navy">{c.className}</div>
                  <div className="flex flex-wrap gap-2">
                    {c.points.map((p, i) => (
                      <div key={`${p.title}-${i}`} className="min-w-[8.5rem] rounded-xl bg-slate-50 px-3 py-2">
                        <div className="text-lg font-black" style={{ color: p.average === null ? undefined : levelColor(p.average) }}>
                          {pct(p.average)}
                        </div>
                        <div className="truncate text-[11px] font-bold text-slate-500">{p.title}</div>
                        <div className="text-[11px] font-bold text-slate-400">{formatShortDate(p.date)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <Section title="تطور المهارات المعاد قياسها" serves="تحسين نتائج المتعلمين">
            {data.repeatedSkills.length ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-right text-xs font-extrabold text-slate-400">
                    <th className="py-2 pl-3">المهارة</th>
                    <th className="py-2 pl-3">الفصل</th>
                    <th className="py-2 pl-3">القياس الأول</th>
                    <th className="py-2 pl-3">آخر قياس</th>
                    <th className="py-2">التغير</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {data.repeatedSkills.map((s) => (
                    <tr key={`${s.className}-${s.skill}`}>
                      <td className="py-3 pl-3 font-extrabold text-brand-navy">{s.skill}</td>
                      <td className="py-3 pl-3 font-bold text-slate-500">{s.className}</td>
                      <td className="py-3 pl-3 font-bold text-slate-600">
                        {pct(s.first.mastery)} <span className="text-xs text-slate-400">{formatShortDate(s.first.date)}</span>
                      </td>
                      <td className="py-3 pl-3 font-bold text-slate-600">
                        {pct(s.latest.mastery)} <span className="text-xs text-slate-400">{formatShortDate(s.latest.date)}</span>
                      </td>
                      <td className={`py-3 font-black ${s.change > 0 ? "text-emerald-600" : s.change < 0 ? "text-red-500" : "text-slate-400"}`}>
                        {s.change > 0 ? "+" : ""}
                        {toEnglishDigits(s.change)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm font-bold leading-7 text-slate-400">
                لم تُقَس أي مهارة أكثر من مرة في نفس الفصل حتى الآن. يظهر التحسن هنا تلقائيًا عندما تعود المهارة في اختبارات لاحقة.
              </p>
            )}
          </Section>

          {/* Signatures — mostly for the printed copy */}
          <section className="break-inside-avoid grid grid-cols-3 gap-4 pt-4">
            {["المعلم", "قائد المدرسة", "التاريخ"].map((label) => (
              <div key={label} className="h-24 rounded-xl border border-dashed border-slate-300 p-3 text-xs font-extrabold text-slate-500">
                {label}
              </div>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
