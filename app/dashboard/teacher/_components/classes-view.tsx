"use client";

import { toEnglishDigits } from "@/lib/format";
import { levelColor } from "@/lib/levels";
import type { TeacherDashboardState } from "../_lib/use-teacher-dashboard";

export function ClassesView({ d }: { d: TeacherDashboardState }) {
  const {
    setView,
    classes,
    classStudents,
    setShowAddClass,
    planLoading,
    setActivePackageAssignment,
    selectedClassAssignment,
    setSelectedClassAssignment,
    weeklyPlanItem,
    packageAssignmentsByClass,
    calcPackageAvg,
    handleViewStudents,
  } = d;
  return (
    <>
      {/* ── SECTION 1: هذا الأسبوع ──────────────────────────────────────── */}
      <section>
        <div className="mb-4">
          <p className="text-sm font-extrabold text-brand">هذا الأسبوع</p>
          <h2 className="mt-2 text-2xl font-black tracking-normal text-brand-navy">مهمة التقييم الحالية</h2>
        </div>
        <div className="rounded-[1.5rem] border border-teal-100 bg-white p-6 shadow-[0_10px_34px_rgba(15,35,55,0.035)]">
          {planLoading ? (
            <div className="rounded-[1.25rem] border border-dashed border-teal-100 bg-teal-50/40 p-6 text-center">
              <h3 className="text-xl font-black text-brand-navy">جارٍ تحميل خطة هذا الأسبوع...</h3>
            </div>
          ) : weeklyPlanItem ? (
            <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
              <div className="min-w-0">
                <div className="mb-2 text-sm font-black text-brand">هذا الأسبوع</div>
                <h3 className="text-3xl font-black leading-tight text-brand-navy">
                  تدريب {weeklyPlanItem.plan.subject}
                </h3>
                <div className="mt-4 flex flex-wrap items-center gap-2 text-sm font-black text-slate-500">
                  <span>{weeklyPlanItem.plan.grade_label}</span>
                  <span className="h-1 w-1 rounded-full bg-slate-300" />
                  <span>الأسبوع {toEnglishDigits(weeklyPlanItem.plan.week_number)}</span>
                  <span className="h-1 w-1 rounded-full bg-slate-300" />
                  <span>{toEnglishDigits(weeklyPlanItem.plan.question_count)} أسئلة · تصحيح آلي</span>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-3 lg:w-[420px]">
                <button
                  onClick={() => setView("packages")}
                  className="rounded-full bg-brand-navy px-4 py-3 text-sm font-extrabold text-white transition hover:bg-brand-navy-light"
                >
                  بدء التقييم
                </button>
                <button className="rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-extrabold text-slate-500 transition hover:border-brand/40 hover:text-brand" onClick={() => window.print()}>
                  طباعة الورقة
                </button>
                <button className="rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-extrabold text-slate-500 transition hover:border-brand/40 hover:text-brand" onClick={() => setView("packages")}>
                  عرض النتائج
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-[1.25rem] border border-dashed border-teal-100 bg-teal-50/40 p-6 text-center">
              <h3 className="text-xl font-black text-brand-navy">
                {classes.length ? "لا توجد خطة مفعّلة لهذا الأسبوع." : "أضف فصلًا للبدء في تنفيذ التقييمات."}
              </h3>
              <p className="mt-2 text-sm font-bold text-slate-400">
                {classes.length ? "يمكنك عرض الخطة القادمة أو التواصل مع مدير النظام." : "بعد إضافة الفصل والطلاب ستظهر هنا مهام التقييم والتقارير."}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* تقارير ولي الأمر انتقلت إلى حساب قائد المدرسة في checkpoint الحالي. */}

      {/* ── SECTION 3: فصولي ──────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-4 text-2xl font-black tracking-normal text-brand-navy">فصولي</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {classes.length === 0 && (
            <div className="rounded-[1.5rem] border border-slate-100 bg-white p-8 text-center text-slate-400 shadow-[0_10px_34px_rgba(15,35,55,0.035)]">
              <div className="text-4xl mb-3">🏫</div>
              <p className="font-bold">لا توجد فصول محفوظة بعد</p>
            </div>
          )}
          {classes.map((cls) => {
            const students = classStudents[cls.id] ?? [];
            const avg = calcPackageAvg(cls.id, students);
            const classAssignments = packageAssignmentsByClass[cls.id] ?? [];
            const selectedAssignmentId = selectedClassAssignment[cls.id] ?? classAssignments[0]?.id ?? "";
            const selectedAssignment = classAssignments.find((item) => item.id === selectedAssignmentId);
            return (
              <div
                key={cls.id}
                className="flex flex-col gap-5 rounded-[1.5rem] border border-slate-100 bg-white p-6 shadow-[0_10px_34px_rgba(15,35,55,0.035)]"
              >
                {/* Class header */}
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-xl font-black text-brand-navy">{cls.name}</div>
                    <div className="mt-1 text-sm font-bold text-slate-400">{cls.subject}</div>
                  </div>
                  <button
                    title="إعدادات الفصل"
                    className="rounded-xl p-2 text-slate-300 transition hover:bg-slate-50 hover:text-brand"
                  >
                    ⚙️
                  </button>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-black text-brand-navy">{toEnglishDigits(students.length)}</div>
                    <div className="text-xs font-bold text-slate-400">طالب</div>
                  </div>
                  <div className="h-10 w-px bg-slate-100" />
                  <div className="text-center">
                    {avg !== null ? (
                      <>
                        <div className="text-2xl font-bold" style={{ color: levelColor(avg) }}>
                          {toEnglishDigits(avg)}٪
                        </div>
                        <div className="text-xs font-bold text-slate-400">متوسط هذا الأسبوع</div>
                      </>
                    ) : (
                      <>
                        <div className="text-2xl font-black text-slate-300">—</div>
                        <div className="text-xs font-bold text-slate-400">لا توجد درجات</div>
                      </>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <button
                  onClick={() => handleViewStudents(cls.id)}
                  className="w-full rounded-xl bg-brand py-3 text-sm font-extrabold text-white shadow-[0_10px_24px_rgba(21,159,145,0.12)] transition hover:bg-brand-dark"
                >
                  عرض الطلاب
                </button>
                {classAssignments.length ? (
                  <div className="space-y-2 rounded-xl border border-teal-100 bg-teal-50/50 p-3">
                    <div className="text-xs font-extrabold text-brand">حزمة دالا مطبقة</div>
                    {classAssignments.length > 1 && (
                      <select
                        value={selectedAssignmentId}
                        onChange={(event) => setSelectedClassAssignment((prev) => ({ ...prev, [cls.id]: event.target.value }))}
                        className="w-full rounded-xl border border-teal-100 bg-white px-3 py-2 text-sm font-bold text-brand-navy outline-none"
                      >
                        {classAssignments.map((assignment) => (
                          <option key={assignment.id} value={assignment.id}>{assignment.packageTitle}</option>
                        ))}
                      </select>
                    )}
                    <button
                      onClick={() => selectedAssignment && setActivePackageAssignment(selectedAssignment)}
                      className="w-full rounded-xl bg-brand-navy py-2.5 text-sm font-extrabold text-white transition hover:bg-brand-navy-light"
                    >
                      بدء تصحيح حزمة دالا
                    </button>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-3 text-xs font-bold leading-6 text-slate-400">
                    لا توجد حزمة دالا مطبقة على هذا الفصل. انتقل إلى التصحيح والنتائج لتطبيق حزمة.
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Add class button */}
        <button
          onClick={() => setShowAddClass(true)}
          className="mt-5 w-full rounded-[1.25rem] border border-dashed border-brand/40 bg-white py-4 text-sm font-extrabold text-brand transition hover:bg-teal-50/50"
        >
          + إضافة فصل جديد
        </button>
      </section>
    </>
  );
}
