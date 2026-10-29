"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { gradeLabel } from "@/lib/labels";
import { getLevelFromPercentage, levelColor } from "@/lib/levels";
import { toEnglishDigits } from "@/lib/format";
import type { ClassReportData } from "../_lib/types";

const CONFIDENCE_STYLE: Record<string, string> = {
  عالية: "bg-emerald-50 text-emerald-700 border-emerald-200",
  متوسطة: "bg-amber-50 text-amber-700 border-amber-200",
  منخفضة: "bg-slate-50 text-slate-600 border-slate-200",
};

function Bar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-20 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full" style={{ width: `${Math.max(3, value)}%`, background: levelColor(value) }} />
      </div>
      <span className="text-xs font-extrabold tabular-nums" style={{ color: levelColor(value) }}>{toEnglishDigits(value)}%</span>
    </div>
  );
}

function Change({ from, to }: { from: number | null; to: number | null }) {
  if (from === null || to === null) return <span className="text-xs text-slate-400">—</span>;
  const diff = to - from;
  const color = diff > 0 ? "text-emerald-600" : diff < 0 ? "text-red-600" : "text-slate-500";
  return (
    <span className={`text-xs font-bold tabular-nums ${color}`}>
      {toEnglishDigits(from)}% ← {toEnglishDigits(to)}%
    </span>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="report-section">
      <h3 className="mb-3 text-sm font-black text-brand-navy">{title}</h3>
      {children}
    </section>
  );
}

function ReportBody({ data }: { data: ClassReportData }) {
  const { diagnosis: d, narrative: n } = data;
  const latest = d.tests[d.tests.length - 1];
  const focusBySkill = new Map(d.focus.map((s) => [s.skill, s]));
  const groupBySkill = new Map(d.groups.map((g) => [g.skill, g.students]));
  const remeasured = d.skills.filter((s) => s.earlierMastery !== null && s.latestMastery !== null);
  const improved = remeasured.filter((s) => (s.latestMastery ?? 0) - (s.earlierMastery ?? 0) >= 5).length;

  return (
    <div className="space-y-7">
      <div className={`rounded-xl border px-4 py-3 text-xs font-bold leading-relaxed ${n.source === "ai" ? "border-teal-200 bg-teal-50 text-teal-800" : "border-slate-200 bg-slate-50 text-slate-600"}`}>
        {n.source === "ai"
          ? "✦ كتب الذكاء الاصطناعي التفسير والسبب المرجّح والإجراءات من نتائج الفصل. الأرقام محسوبة من نتائجكم مباشرة، والتفسير اقتراح يراجعه المعلم قبل اعتماده. لم تُرسل أسماء الطلاب."
          : data.notice ?? "كُتب هذا التقرير بالقواعد الثابتة من نتائج الفصل."}
      </div>

      {d.keyChecks.length > 0 && (
        <div className="print-keep rounded-xl border-2 border-red-200 bg-red-50 p-4">
          <div className="mb-2 text-sm font-black text-red-800">تحقق من مفتاح الإجابة قبل اعتماد النتائج</div>
          <ul className="space-y-1.5 text-xs leading-6 text-red-900">
            {d.keyChecks.map((k) => (
              <li key={`${k.test}-${k.question}`}>
                السؤال {toEnglishDigits(k.question)} في «{k.test}»: المفتاح {k.keyOption}{k.keyValue ? ` (${toEnglishDigits(k.keyValue)})` : ""}، وأجاب عنه صحيحًا {toEnglishDigits(k.mastery)}% فقط، بينما اختار {toEnglishDigits(k.popularShare)}% من الطلاب {k.popularOption}{k.popularValue ? ` (${toEnglishDigits(k.popularValue)})` : ""}.
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] font-bold text-red-700">هذا النمط يحدث عندما يكون المفتاح خطأ. إن تأكدت من الخطأ فتواصل مع فريق دالة لتصحيحه ثم أعد التصحيح.</p>
        </div>
      )}

      <div className="print-keep grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "المختبرون", value: `${toEnglishDigits(d.testedCount)} / ${toEnglishDigits(d.studentCount)}` },
          { label: "متوسط آخر اختبار", value: latest ? `${toEnglishDigits(latest.average)}%` : "—", sub: latest ? getLevelFromPercentage(latest.average) : "", color: latest ? levelColor(latest.average) : undefined },
          {
            label: "مهارات تحسنت",
            value: remeasured.length ? `${toEnglishDigits(improved)} / ${toEnglishDigits(remeasured.length)}` : "—",
            sub: remeasured.length ? "من المهارات التي أعيد قياسها" : "يظهر بعد إعادة قياس مهارة",
            color: remeasured.length ? (improved > 0 ? "#059669" : undefined) : undefined,
          },
          { label: "الاختبارات", value: toEnglishDigits(d.tests.length) },
        ].map((card) => (
          <div key={card.label} className="rounded-xl border border-slate-100 bg-white p-3">
            <div className="text-[11px] font-bold text-slate-400">{card.label}</div>
            <div className="mt-1 text-xl font-black tabular-nums" style={{ color: card.color ?? "#0b2447" }}>{card.value}</div>
            {card.sub && <div className="text-[11px] font-bold text-slate-400">{card.sub}</div>}
          </div>
        ))}
      </div>

      <Section title="الملخص">
        <p className="text-sm leading-7 text-slate-700">{n.summary}</p>
      </Section>

      {n.priorities.length > 0 && (
        <Section title="أولويات التدخل">
          <div className="space-y-3">
            {n.priorities.map((p, index) => {
              const stat = focusBySkill.get(p.skill);
              const group = groupBySkill.get(p.skill) ?? [];
              return (
                <div key={p.skill} className="print-keep rounded-xl border border-slate-200 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-extrabold text-brand-navy">{toEnglishDigits(index + 1)}. {p.skill}</div>
                    {stat && <Bar value={stat.mastery} />}
                  </div>
                  {stat && <div className="mt-0.5 text-[11px] font-bold text-slate-400">{stat.domain}</div>}
                  <p className="mt-2 text-sm leading-6 text-slate-700">{p.why}</p>
                  <div className="mt-2 rounded-lg bg-amber-50/60 p-3">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span className="text-xs font-black text-amber-800">السبب المرجّح</span>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-extrabold ${CONFIDENCE_STYLE[p.confidence] ?? CONFIDENCE_STYLE["متوسطة"]}`}>ثقة {p.confidence}</span>
                    </div>
                    <p className="text-sm leading-6 text-slate-700">{p.likelyCause}</p>
                  </div>
                  {group.length > 0 && (
                    <div className="mt-3 text-xs leading-6 text-slate-600">
                      <span className="font-black text-slate-700">لم يتقنها ({toEnglishDigits(group.length)}): </span>
                      {group.map((s) => s.name).join("، ")}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {n.actions.length > 0 && (
        <Section title="ماذا أفعل في الحصة القادمة؟">
          <ol className="space-y-3">
            {n.actions.map((a, index) => (
              <li key={`${a.title}-${index}`} className="print-keep rounded-xl bg-slate-50 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-extrabold text-brand-navy">{a.title}</span>
                  <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-slate-500">{a.target}</span>
                  <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-slate-500">{toEnglishDigits(a.duration)}</span>
                </div>
                <p className="mt-1.5 text-sm leading-6 text-slate-700">{a.detail}</p>
              </li>
            ))}
          </ol>
          {n.nextCheck && <p className="mt-3 text-sm leading-6 text-slate-700"><span className="font-black">للتحقق: </span>{n.nextCheck}</p>}
        </Section>
      )}

      {d.skills.length > 0 && (
        <Section title="المهارات المقيسة">
          <div className="overflow-x-auto rounded-xl border border-slate-100">
            <table className="w-full min-w-[560px] text-right text-xs">
              <thead className="bg-slate-50 text-[11px] font-black text-slate-500">
                <tr>
                  <th className="p-2.5">المهارة</th>
                  <th className="p-2.5">الإتقان</th>
                  <th className="p-2.5">لم يتقنها</th>
                  <th className="whitespace-nowrap p-2.5">قبل ← آخر قياس</th>
                  <th className="p-2.5">الخطأ الأكثر</th>
                </tr>
              </thead>
              <tbody>
                {d.skills.map((s) => (
                  <tr key={`${s.domain}-${s.skill}`} className="border-t border-slate-100 align-top">
                    <td className="p-2.5">
                      <div className="font-bold text-slate-800">{s.skill}</div>
                      <div className="text-[10px] text-slate-400">{s.domain} · {toEnglishDigits(s.questionCount)} {s.questionCount === 1 ? "سؤال" : "أسئلة"}</div>
                    </td>
                    <td className="p-2.5"><Bar value={s.mastery} /></td>
                    <td className="whitespace-nowrap p-2.5 font-bold tabular-nums text-slate-600">{toEnglishDigits(s.studentsMissed)} / {toEnglishDigits(s.studentsMeasured)}</td>
                    <td className="whitespace-nowrap p-2.5"><Change from={s.earlierMastery} to={s.latestMastery} /></td>
                    <td className="p-2.5 text-slate-600">
                      {s.misconception?.text
                        ?? (s.topWrong
                          ? `س${toEnglishDigits(s.topWrong.question)}: ${s.topWrong.option === "blank" ? "بدون إجابة" : `${s.topWrong.option}${s.topWrong.value ? ` (${s.topWrong.value})` : ""}`} — ${toEnglishDigits(s.topWrong.share)}% من أخطائه`
                          : "—")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {n.strengths.length > 0 && (
        <Section title="نقاط القوة">
          <ul className="list-inside list-disc space-y-1 text-sm leading-6 text-slate-700">
            {n.strengths.map((s) => <li key={s}>{s}</li>)}
          </ul>
        </Section>
      )}

      <Section title="الاختبارات في هذا التقرير">
        <div className="space-y-1.5">
          {d.tests.map((t) => (
            <div key={t.packageId} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-xs">
              <span className="font-bold text-slate-700">{t.title}{t.week ? ` · الأسبوع ${toEnglishDigits(t.week)}` : ""}</span>
              <span className="flex items-center gap-3">
                <span className="text-slate-400">{toEnglishDigits(t.tested)} طالبًا</span>
                <Bar value={t.average} />
              </span>
            </div>
          ))}
        </div>
      </Section>

      {(d.notTestedLatest.length > 0 || d.gaps.length > 0) && (
        <Section title="تنبيهات">
          <ul className="list-inside list-disc space-y-1 text-xs leading-6 text-slate-500">
            {d.notTestedLatest.length > 0 && (
              <li>لم يُختبر في آخر اختبار ({toEnglishDigits(d.notTestedLatest.length)}): {d.notTestedLatest.map((s) => s.name).join("، ")}</li>
            )}
            {d.gaps.map((g) => <li key={g}>{g}</li>)}
          </ul>
        </Section>
      )}
    </div>
  );
}

export function ReportModal({
  report, loading, error, onClose,
}: {
  report: ClassReportData | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    const done = () => document.body.classList.remove("print-class-report");
    window.addEventListener("afterprint", done);
    return () => { window.removeEventListener("afterprint", done); done(); };
  }, []);

  const print = () => {
    document.body.classList.add("print-class-report");
    window.print();
  };

  const d = report?.diagnosis;
  const modal = (
    <div id="class-report-print" className="fixed inset-0 z-50 flex items-center justify-center p-4" dir="rtl">
      <div className="no-print absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="report-sheet relative max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 rounded-t-2xl border-b border-gray-100 bg-white p-5">
          <div>
            <h2 className="text-lg font-black text-brand-navy">تقرير الفصل{d ? ` — ${d.className}` : ""}</h2>
            {d && (
              <p className="mt-0.5 text-xs font-bold text-slate-400">
                {[d.subject, gradeLabel(d.grade), report?.generatedAt ? new Date(report.generatedAt).toLocaleDateString("ar-SA-u-nu-latn", { day: "numeric", month: "long", year: "numeric" }) : ""].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
          <button onClick={onClose} className="no-print text-2xl leading-none text-gray-400 hover:text-gray-600" aria-label="إغلاق">×</button>
        </div>
        <div className="p-6">
          {loading && (
            <div className="py-12 text-center">
              <div className="mx-auto mb-4 h-14 w-14 animate-spin rounded-full border-4 border-slate-200 border-t-brand" />
              <p className="font-bold text-slate-600">نحلل نتائج الفصل مهارةً مهارة...</p>
              <p className="mt-1 text-sm text-slate-400">قد يستغرق ذلك بضع ثوانٍ</p>
            </div>
          )}
          {error && !loading && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center">
              <p className="mb-1 font-bold text-red-700">تعذّر إنشاء التقرير</p>
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
          {report && !loading && (
            <>
              <ReportBody data={report} />
              <div className="no-print mt-8 flex gap-3">
                <button className="flex-1 rounded-xl bg-brand py-2.5 text-sm font-extrabold text-white" onClick={print}>طباعة التقرير</button>
                <button className="flex-1 rounded-xl border-2 border-brand py-2.5 text-sm font-extrabold text-brand" onClick={onClose}>إغلاق</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );

  return mounted ? createPortal(modal, document.body) : null;
}
