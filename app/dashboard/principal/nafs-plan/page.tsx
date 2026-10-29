"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Printer } from "lucide-react";
import { BRAND } from "@/lib/brand";
import { toEnglishDigits } from "@/lib/format";
import type { NafsBaseline } from "@/lib/nafs/baseline";
import { buildNafsPlan, type Priority } from "@/lib/nafs/plan";

const PRIORITY_STYLE: Record<Priority, string> = {
  "عاجلة": "bg-red-50 text-red-700",
  "مرتفعة": "bg-amber-50 text-amber-800",
  "متابعة": "bg-slate-50 text-slate-600",
};

function pct(value: number | null | undefined) {
  return value === null || value === undefined ? "—" : `${toEnglishDigits(value)}%`;
}

function change(value: number | null) {
  if (value === null) return "—";
  const sign = value > 0 ? "+" : "";
  return <span className={value < 0 ? "text-red-600" : value > 0 ? "text-brand" : ""}>{toEnglishDigits(`${sign}${value}`)}</span>;
}

/** Printable situation report and improvement plan built from the school's previous NAFS results. */
export default function NafsPlanPage() {
  const [baselines, setBaselines] = useState<NafsBaseline[] | null>(null);
  const [schoolName, setSchoolName] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/principal/nafs-baseline", { cache: "no-store" });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json.success) throw new Error(json.error || "تعذر تحميل نتائج نافس");
        setBaselines(json.baselines as NafsBaseline[]);
        setSchoolName(json.schoolName ?? "");
      } catch (err) {
        setError(err instanceof Error ? err.message : "تعذر تحميل نتائج نافس");
      }
    })();
  }, []);

  const plan = useMemo(() => (baselines ? buildNafsPlan(baselines) : null), [baselines]);

  return (
    <div className="min-h-screen bg-[#f7fafc] text-brand-navy print:bg-white" dir="rtl">
      <style>{`@page { size: A4; margin: 14mm; } @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } section { break-inside: avoid; } }`}</style>

      <div className="sticky top-0 z-10 border-b border-slate-100 bg-white/95 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/dashboard/principal" className="flex items-center gap-1 text-sm font-bold text-slate-500 hover:text-brand">
            <ArrowRight className="h-4 w-4" /> العودة
          </Link>
          {plan && (
            <button onClick={() => window.print()} className="flex items-center gap-1 rounded-xl bg-brand px-4 py-2 text-xs font-extrabold text-white">
              <Printer className="h-4 w-4" /> طباعة أو حفظ PDF
            </button>
          )}
        </div>
      </div>

      <main className="mx-auto max-w-4xl space-y-6 px-4 py-6 print:p-0">
        {error && <p className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm font-bold text-red-700">{error}</p>}
        {!baselines && !error && <p className="text-center text-sm font-bold text-slate-400">جارٍ إعداد التقرير...</p>}
        {baselines && !plan && (
          <p className="rounded-xl border border-amber-100 bg-amber-50 p-4 text-sm font-bold text-amber-800">
            لم تُدخل نتائج نافس بعد. أدخلها من تبويب «نافس السابق» في لوحة المدرسة.
          </p>
        )}

        {plan && (
          <>
            <header className="rounded-2xl bg-white p-6 print:p-0">
              <p className="text-xs font-extrabold text-brand">{BRAND.nameAr}</p>
              <h1 className="mt-1 text-2xl font-black">تقرير الوضع وخطة تحسين نواتج التعلم</h1>
              <p className="mt-1 text-sm font-bold text-slate-500">
                {schoolName} · مبني على نتائج نافس {toEnglishDigits(plan.year)}
                {plan.previousYear ? ` مقارنة بـ ${toEnglishDigits(plan.previousYear)}` : ""}
              </p>
            </header>

            <section className="rounded-2xl bg-white p-6 print:p-0">
              <h2 className="mb-3 text-lg font-black">أولًا: ماذا تقول الأرقام</h2>
              <ul className="list-disc space-y-1.5 pr-5 text-sm font-bold text-slate-700">
                {plan.findings.map((finding, index) => <li key={index}>{finding}</li>)}
              </ul>
            </section>

            {plan.subjects.map((subject) => (
              <section key={`${subject.grade}-${subject.subject}`} className="rounded-2xl bg-white p-6 print:p-0">
                <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-lg font-black">{subject.subject} — الصف {subject.grade === 3 ? "الثالث" : "السادس"}</h2>
                  <p className="text-sm font-bold text-slate-500">
                    متوسط الأداء {pct(subject.overall)} · التغير {change(subject.change)}
                    {subject.mastery !== null ? ` · نسبة التمكن ${pct(subject.mastery)}` : ""}
                  </p>
                </div>
                {subject.domains.length ? (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-right text-xs text-slate-500">
                        <th className="py-2">المجال</th>
                        <th>النسبة</th>
                        <th>التغير</th>
                        <th>الأولوية</th>
                        <th>الهدف المقترح</th>
                      </tr>
                    </thead>
                    <tbody>
                      {subject.domains.map((domain) => (
                        <tr key={domain.name} className="border-b border-slate-100 font-bold">
                          <td className="py-2">{domain.name}</td>
                          <td>{pct(domain.percent)}</td>
                          <td>{change(domain.change)}</td>
                          <td><span className={`rounded-full px-2 py-0.5 text-xs ${PRIORITY_STYLE[domain.priority]}`}>{domain.priority}</span></td>
                          <td>{pct(domain.target)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-sm font-bold text-slate-400">لم تُدخل نسب المجالات لهذه المادة.</p>
                )}
              </section>
            ))}

            <section className="rounded-2xl bg-white p-6 print:p-0">
              <h2 className="mb-3 text-lg font-black">ثانيًا: الأولويات</h2>
              {plan.priorities.length ? (
                <ol className="list-decimal space-y-1.5 pr-5 text-sm font-bold text-slate-700">
                  {plan.priorities.map((p) => (
                    <li key={`${p.grade}-${p.subject}-${p.domain}`}>
                      {p.domain} ({p.subject}، الصف {p.grade}): من {pct(p.percent)} إلى {pct(p.target)} — أولوية {p.priority}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm font-bold text-slate-500">كل المجالات المدخلة فوق 50%؛ الخطة للمتابعة والمحافظة.</p>
              )}
            </section>

            <section className="rounded-2xl bg-white p-6 print:p-0">
              <h2 className="mb-3 text-lg font-black">ثالثًا: خطة التحسين</h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-right text-xs text-slate-500">
                    <th className="py-2">الإجراء</th>
                    <th>المسؤول</th>
                    <th>التوقيت</th>
                    <th>مؤشر القياس</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.actions.map((action) => (
                    <tr key={action.title} className="border-b border-slate-100 align-top">
                      <td className="py-2 pl-3">
                        <p className="font-black">{action.title}</p>
                        <p className="text-xs font-bold text-slate-500">{action.detail}</p>
                      </td>
                      <td className="text-xs font-bold">{action.owner}</td>
                      <td className="text-xs font-bold">{action.when}</td>
                      <td className="text-xs font-bold">{action.measure}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section className="rounded-2xl bg-white p-6 print:p-0">
              <h2 className="mb-3 text-lg font-black">رابعًا: دورة دالة لكل أربعة أسابيع</h2>
              <div className="grid gap-2 sm:grid-cols-2">
                {plan.cycle.map((week) => (
                  <div key={week.week} className="rounded-xl border border-slate-100 p-3 text-sm">
                    <p className="font-black">الأسبوع {toEnglishDigits(week.week)}: {week.subject}</p>
                    <p className="mt-1 text-xs font-bold text-slate-500">
                      {week.focus.length ? `التركيز: ${week.focus.join("، ")}` : "تدريب شامل للمادة"}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl bg-white p-6 text-xs font-bold text-slate-500 print:p-0">
              <h2 className="mb-2 text-sm font-black text-brand-navy">كيف بُنيت الخطة</h2>
              <ul className="list-disc space-y-1 pr-5">
                {plan.rules.map((rule) => <li key={rule}>{rule}</li>)}
              </ul>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
