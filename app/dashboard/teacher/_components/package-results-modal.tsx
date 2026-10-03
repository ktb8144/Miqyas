"use client";

import { toEnglishDigits } from "@/lib/format";
import type { TeacherDashboardState } from "../_lib/use-teacher-dashboard";
import { StudentProfileLink } from "@/components/student-profile/student-profile-link";

export function PackageResultsModal({ d }: { d: TeacherDashboardState }) {
  const {
    packageResultsAssignment,
    setPackageResultsAssignment,
    packageResults,
    skillDiagnosis,
    packageResultsLoading,
    packageResultsError,
    skillDiagnosisError,
  } = d;
  if (!packageResultsAssignment) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/50 sm:items-center sm:p-4" dir="rtl">
      <div className="h-full w-full overflow-y-auto bg-white shadow-2xl sm:h-auto sm:max-h-[92vh] sm:max-w-5xl sm:rounded-[1.5rem]">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white p-5">
          <div>
            <p className="text-sm font-extrabold text-brand">نتائج اختبار دالة</p>
            <h2 className="mt-1 text-xl font-black text-brand-navy">{packageResultsAssignment.packageTitle}</h2>
            <p className="mt-1 text-sm font-bold text-slate-400">{packageResultsAssignment.className}</p>
          </div>
          <button
            onClick={() => setPackageResultsAssignment(null)}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-extrabold text-slate-500 transition hover:border-brand/40 hover:text-brand"
          >
            إغلاق
          </button>
        </div>
        <div className="p-5">
          {packageResultsLoading && (
            <div className="rounded-[1.25rem] border border-dashed border-teal-100 bg-teal-50/40 p-8 text-center font-bold text-slate-500">
              جارٍ تحميل النتائج...
            </div>
          )}
          {packageResultsError && (
            <div className="rounded-[1.25rem] border border-red-100 bg-red-50 p-4 text-sm font-bold text-red-700">
              {packageResultsError}
            </div>
          )}
          {!packageResultsLoading && !packageResultsError && packageResults && (
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-slate-50 p-4">
                  <div className="text-2xl font-black text-brand-navy">{toEnglishDigits(packageResults.summary.studentsTestedCount)}</div>
                  <div className="mt-1 text-xs font-bold text-slate-400">طلاب تم اختبارهم</div>
                </div>
                <div className="rounded-xl bg-slate-50 p-4">
                  <div className="text-2xl font-black text-brand">
                    {packageResults.summary.averagePercentage === null ? "—" : `${toEnglishDigits(packageResults.summary.averagePercentage)}٪`}
                  </div>
                  <div className="mt-1 text-xs font-bold text-slate-400">متوسط النسبة</div>
                </div>
              </div>

              <div className="rounded-[1.25rem] border border-teal-100 bg-teal-50/40 p-4">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-black text-brand-navy">مهارات تحتاج تدخل</h3>
                    <p className="mt-1 text-xs font-bold text-slate-500">
                      الأرقام محسوبة من إجابات الطلاب، والتفسير مبني على الدليل المتاح.
                    </p>
                  </div>
                  {skillDiagnosis && (
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-brand">
                      ثقة التحليل: {skillDiagnosis.confidence.label}
                    </span>
                  )}
                </div>
                {skillDiagnosisError && (
                  <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-700">
                    {skillDiagnosisError}
                  </div>
                )}
                {skillDiagnosis?.weakestSkills.length ? (
                  <div className="grid gap-3">
                    {skillDiagnosis.weakestSkills.slice(0, 3).map((skill) => (
                      <div key={`${skill.domainText}-${skill.skillText}`} className="rounded-2xl bg-white p-4 shadow-[0_8px_24px_rgba(15,35,55,0.03)]">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h4 className="font-black text-brand-navy">{skill.skillText}</h4>
                            <p className="mt-1 text-xs font-bold text-slate-400">{skill.domainText}</p>
                          </div>
                          <div className="text-left">
                            <div className="text-2xl font-black text-brand">{toEnglishDigits(skill.masteryRate)}٪</div>
                            <div className="text-xs font-bold text-slate-400">نسبة الإتقان</div>
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
                          <span className="rounded-full bg-slate-50 px-3 py-1 text-slate-500">
                            {toEnglishDigits(skill.affectedStudentsCount)} طالب يحتاج دعمًا
                          </span>
                          <span className="rounded-full bg-slate-50 px-3 py-1 text-slate-500">
                            {toEnglishDigits(skill.linkedQuestionCount)} سؤال مرتبط
                          </span>
                          {skill.warning && (
                            <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-700">
                              {skill.warning}
                            </span>
                          )}
                        </div>
                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                          <div className="rounded-xl bg-slate-50 p-3">
                            <div className="text-xs font-black text-slate-400">السبب المحتمل</div>
                            <p className="mt-1 text-sm font-bold leading-7 text-slate-600">{skill.likelyCause}</p>
                          </div>
                          <div className="rounded-xl bg-slate-50 p-3">
                            <div className="text-xs font-black text-slate-400">خطوة الحصة القادمة</div>
                            <p className="mt-1 text-sm font-bold leading-7 text-slate-600">
                              {skill.recommendation.nextLessonAction} · {skill.recommendation.duration}
                            </p>
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                          <p className="text-xs font-bold text-slate-400">
                            القياس: {skill.recommendation.impactMeasure}
                          </p>
                          <button
                            onClick={() => alert("سيتم ربط إنشاء التدريب العلاجي في خطوة لاحقة.")}
                            className="rounded-xl bg-brand-navy px-4 py-2 text-xs font-extrabold text-white"
                          >
                            إنشاء تدريب علاجي
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-xl bg-white px-4 py-3 text-sm font-bold text-slate-400">
                    لا توجد مهارات تحتاج تدخلًا بناءً على النتائج الحالية.
                  </p>
                )}
              </div>

              {packageResults.students.length ? (
                <div className="overflow-x-auto rounded-xl border border-slate-100">
                  <table className="w-full">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-4 py-3 text-right text-xs font-bold text-slate-500">رقم الطالب</th>
                        <th className="px-4 py-3 text-right text-xs font-bold text-slate-500">اسم الطالب</th>
                        <th className="px-4 py-3 text-right text-xs font-bold text-slate-500">الدرجة</th>
                        <th className="px-4 py-3 text-right text-xs font-bold text-slate-500">النسبة</th>
                        <th className="px-4 py-3 text-right text-xs font-bold text-slate-500">المستوى</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {packageResults.students.map((student) => (
                        <tr key={student.id}>
                          <td className="px-4 py-3 text-sm font-black text-brand">{toEnglishDigits(student.studentCode ?? "—")}</td>
                          <td className="px-4 py-3 text-sm font-bold text-brand-navy"><StudentProfileLink studentId={student.studentId} name={student.studentName} /></td>
                          <td className="px-4 py-3 text-sm font-bold text-slate-600">{toEnglishDigits(`${student.score}/${student.total}`)}</td>
                          <td className="px-4 py-3 text-sm font-bold text-slate-600">{toEnglishDigits(student.percentage)}٪</td>
                          <td className="px-4 py-3 text-sm font-bold text-slate-600">{student.level || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="rounded-[1.25rem] border border-dashed border-teal-100 bg-teal-50/40 p-8 text-center font-bold text-slate-500">
                  لم يتم حفظ نتائج لهذا الاختبار بعد.
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-slate-100 bg-slate-50/40 p-4">
                  <h3 className="font-black text-brand-navy">أضعف المهارات</h3>
                  <div className="mt-3 space-y-2">
                    {packageResults.weakestSkills.length ? packageResults.weakestSkills.map((item) => (
                      <div key={item.name} className="flex justify-between rounded-lg bg-white px-3 py-2 text-sm font-bold text-slate-600">
                        <span>{item.name}</span>
                        <span>{toEnglishDigits(`${item.wrong}/${item.total}`)}</span>
                      </div>
                    )) : <p className="text-sm font-bold text-slate-400">لا توجد مهارات ضعيفة محفوظة بعد.</p>}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50/40 p-4">
                  <h3 className="font-black text-brand-navy">أضعف مجالات نافس</h3>
                  <div className="mt-3 space-y-2">
                    {packageResults.weakestDomains.length ? packageResults.weakestDomains.map((item) => (
                      <div key={item.name} className="flex justify-between rounded-lg bg-white px-3 py-2 text-sm font-bold text-slate-600">
                        <span>{item.name}</span>
                        <span>{toEnglishDigits(`${item.wrong}/${item.total}`)}</span>
                      </div>
                    )) : <p className="text-sm font-bold text-slate-400">لا توجد مجالات ضعيفة محفوظة بعد.</p>}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
