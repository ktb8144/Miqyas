"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, ChevronDown, Lightbulb, Target, X, XCircle } from "lucide-react";
import { formatShortDate, toEnglishDigits } from "@/lib/format";
import { levelColorByName, levelColor } from "@/lib/levels";
import type { SkillStatus, StudentProfile } from "@/lib/students/profile";

const STATUS_STYLE: Record<SkillStatus, string> = {
  "متقن": "bg-emerald-50 text-emerald-700 border-emerald-100",
  "يحتاج تثبيت": "bg-amber-50 text-amber-700 border-amber-100",
  "أولوية متابعة": "bg-red-50 text-red-700 border-red-100",
  "أدلة غير كافية": "bg-slate-50 text-slate-500 border-slate-100",
};

function optionLabel(value: string | null) {
  if (!value || value === "blank") return "بلا إجابة";
  if (value === "unclear") return "غير واضحة";
  return value;
}

/**
 * Side panel (full screen on phones) showing one student's file.
 * Opens over the current screen, so closing it returns the teacher to the same place.
 */
export function StudentProfilePanel({ studentId, onClose }: { studentId: string; onClose: () => void }) {
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setProfile(null);
    setError(null);
    fetch(`/api/students/${studentId}/profile`, { cache: "no-store" })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json.success) throw new Error(json.error || "تعذر تحميل ملف الطالب");
        if (!cancelled) setProfile(json.data as StudentProfile);
      })
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : "تعذر تحميل ملف الطالب"));
    return () => {
      cancelled = true;
    };
  }, [studentId]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60] flex" dir="rtl" role="dialog" aria-modal="true" aria-label="ملف الطالب">
      <button aria-label="إغلاق" onClick={onClose} className="hidden flex-1 bg-brand-navy/30 md:block" />
      <aside className="flex h-full w-full flex-col overflow-hidden bg-[#f7fafc] shadow-2xl md:max-w-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 bg-white px-5 py-4">
          <div>
            <p className="text-xs font-extrabold text-brand">ملف الطالب</p>
            <h2 className="mt-1 text-2xl font-black text-brand-navy">{profile?.student.name ?? "جارٍ التحميل..."}</h2>
            {profile && (
              <p className="mt-1 text-sm font-bold text-slate-400">
                {profile.student.gradeLabel} — {profile.student.className} | {profile.student.subject}
                {profile.student.code ? ` | رقم ${toEnglishDigits(profile.student.code)}` : ""}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition hover:border-brand/40 hover:text-brand"
            aria-label="إغلاق ملف الطالب"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
          {error && <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div>}
          {!profile && !error && (
            <div className="rounded-xl border border-dashed border-teal-100 bg-teal-50/40 p-8 text-center font-bold text-slate-500">
              جارٍ تحميل ملف الطالب...
            </div>
          )}

          {profile && <ProfileBody profile={profile} />}
        </div>
      </aside>
    </div>
  );
}

function ProfileBody({ profile }: { profile: StudentProfile }) {
  const { summary, priorities, skills, tests } = profile;
  const judgedSkills = skills.filter((s) => s.status !== "أدلة غير كافية");
  const earlySkills = skills.filter((s) => s.status === "أدلة غير كافية");

  if (!summary.testsCount) {
    return (
      <div className="rounded-[1.25rem] border border-dashed border-slate-200 bg-white p-8 text-center">
        <h3 className="text-lg font-black text-brand-navy">لا توجد نتائج محفوظة بعد</h3>
        <p className="mt-2 text-sm font-bold leading-7 text-slate-400">سيتكوّن ملف الطالب تلقائيًا بعد تصحيح أول اختبار له.</p>
      </div>
    );
  }

  return (
    <>
      {/* Summary */}
      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-100 bg-white p-4">
          <div className="text-xs font-bold text-slate-400">الاختبارات المكتملة</div>
          <div className="mt-1 text-2xl font-black text-brand-navy">{toEnglishDigits(summary.testsCount)}</div>
        </div>
        <div className="rounded-xl border border-slate-100 bg-white p-4">
          <div className="text-xs font-bold text-slate-400">متوسط النتائج</div>
          <div className="mt-1 text-2xl font-black" style={{ color: summary.averagePercentage === null ? undefined : levelColor(summary.averagePercentage) }}>
            {summary.averagePercentage === null ? "—" : `${toEnglishDigits(summary.averagePercentage)}%`}
          </div>
        </div>
        {summary.lastTest && (
          <div className="rounded-xl border border-slate-100 bg-white p-4">
            <div className="text-xs font-bold text-slate-400">آخر نتيجة</div>
            <div className="mt-1 text-2xl font-black" style={{ color: levelColorByName(summary.lastTest.level) }}>
              {toEnglishDigits(summary.lastTest.percentage)}%
            </div>
            <div className="mt-1 truncate text-xs font-bold text-slate-400">
              {summary.lastTest.level} · {formatShortDate(summary.lastTest.date)}
            </div>
          </div>
        )}
      </section>

      {/* Priorities */}
      <section className="rounded-[1.25rem] border border-slate-100 bg-white p-5">
        <h3 className="flex items-center gap-2 font-black text-brand-navy">
          <Target className="h-5 w-5 text-brand" />
          أولويات المتابعة
        </h3>
        {priorities.length ? (
          <div className="mt-4 space-y-3">
            {priorities.map((p) => (
              <article key={p.skill} className="rounded-xl border border-red-100 bg-red-50/40 p-4">
                <div className="font-black text-brand-navy">{p.skill}</div>
                <p className="mt-1 text-sm font-bold leading-7 text-slate-600">
                  <span className="text-slate-400">الدليل: </span>
                  {toEnglishDigits(p.evidence)}
                </p>
                {p.likelyCause && <p className="mt-1 text-sm font-bold leading-7 text-amber-700">{p.likelyCause}</p>}
                <p className="mt-2 flex items-start gap-2 text-sm font-bold leading-7 text-brand">
                  <Lightbulb className="mt-1 h-4 w-4 shrink-0" />
                  {p.suggestedAction}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm font-bold leading-7 text-slate-400">
            {judgedSkills.length
              ? "لا توجد مهارة تحت مستوى الإتقان بأدلة كافية حاليًا."
              : "لا توجد أدلة كافية بعد للحكم على المهارات. نحكم على المهارة بعد 3 إجابات على الأقل، وستظهر الأولويات عندما تتكرر المهارات في الاختبارات القادمة."}
          </p>
        )}
      </section>

      {/* Skills */}
      <section className="rounded-[1.25rem] border border-slate-100 bg-white p-5">
        <h3 className="font-black text-brand-navy">متابعة المهارات</h3>
        <p className="mt-1 text-xs font-bold leading-6 text-slate-400">
          كل مهارة محسوبة من إجابات الطالب عن أسئلتها فقط، ولا تُجمع المهارات المختلفة في نسبة واحدة.
        </p>
        {judgedSkills.length > 0 && (
          <div className="mt-4 space-y-3">
            {judgedSkills.map((s) => (
              <div key={s.skill} className="rounded-xl border border-slate-100 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="text-sm font-extrabold leading-6 text-brand-navy">{s.skill}</div>
                  <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-extrabold ${STATUS_STYLE[s.status]}`}>{s.status}</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-slate-100">
                  <div className="h-2 rounded-full" style={{ width: `${s.mastery}%`, background: levelColor(s.mastery) }} />
                </div>
                <div className="mt-2 text-xs font-bold text-slate-400">
                  {toEnglishDigits(`${s.correct} من ${s.total} صحيحة`)} · {toEnglishDigits(s.testsCount)} اختبار · آخر قياس {formatShortDate(s.lastMeasuredAt)}
                </div>
              </div>
            ))}
          </div>
        )}
        {earlySkills.length > 0 && (
          <div className="mt-4">
            <div className="text-xs font-extrabold text-slate-500">
              قيست بأقل من 3 أسئلة ({toEnglishDigits(earlySkills.length)}) — مؤشر أولي فقط
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {earlySkills.map((s) => (
                <span
                  key={s.skill}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${
                    s.correct === s.total ? "border-emerald-100 bg-emerald-50/60 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-600"
                  }`}
                >
                  {s.correct === s.total ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5 text-red-400" />}
                  {s.skill}
                  <span className="text-slate-400">{toEnglishDigits(`${s.correct}/${s.total}`)}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Test history */}
      <section className="rounded-[1.25rem] border border-slate-100 bg-white p-5">
        <h3 className="font-black text-brand-navy">سجل الاختبارات</h3>
        <div className="mt-4 space-y-3">
          {tests.map((t) => (
            <details key={t.resultId} className="group rounded-xl border border-slate-100">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-extrabold text-brand-navy">{t.title}</div>
                  <div className="mt-0.5 text-xs font-bold text-slate-400">
                    {t.typeLabel}
                    {t.weekNumber ? ` · الأسبوع ${toEnglishDigits(t.weekNumber)}` : ""} · {formatShortDate(t.date)}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <div className="text-left">
                    <div className="text-lg font-black" style={{ color: levelColorByName(t.level) }}>
                      {toEnglishDigits(t.percentage)}%
                    </div>
                    <div className="text-xs font-bold text-slate-400">{toEnglishDigits(`${t.score}/${t.total}`)}</div>
                  </div>
                  <ChevronDown className="h-4 w-4 text-slate-400 transition group-open:rotate-180" />
                </div>
              </summary>
              {t.questions.length ? (
                <div className="border-t border-slate-100 p-3">
                  <div className="grid gap-2">
                    {t.questions.map((q, index) => (
                      <div key={`${q.number ?? index}`} className="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-2 text-xs font-bold">
                        {q.isCorrect ? (
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                        ) : (
                          <XCircle className="h-4 w-4 shrink-0 text-red-500" />
                        )}
                        <span className="w-10 shrink-0 text-slate-400">س{toEnglishDigits(q.number ?? index + 1)}</span>
                        <span className="min-w-0 flex-1 truncate text-slate-600">{q.skill}</span>
                        {!q.isCorrect && (
                          <span className="shrink-0 text-slate-500">
                            أجاب {optionLabel(q.selected)} · الصحيحة {q.correct ?? "—"}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="border-t border-slate-100 p-3 text-xs font-bold text-slate-400">لا توجد تفاصيل أسئلة محفوظة لهذا الاختبار.</p>
              )}
            </details>
          ))}
        </div>
      </section>
    </>
  );
}
