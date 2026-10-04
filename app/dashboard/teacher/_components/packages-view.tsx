"use client";

import { toEnglishDigits } from "@/lib/format";
import { levelColor } from "@/lib/levels";
import type { TeacherDashboardState } from "../_lib/use-teacher-dashboard";
import { formatTestDay } from "./test-card";

/**
 * "الاختبارات السابقة": every test the teacher's classes took, newest first, with grades.
 * The home screen only shows this week's test; this is where older grades live.
 */
export function PackagesView({ d }: { d: TeacherDashboardState }) {
  const {
    setView,
    classes,
    classStudents,
    packageAssignments,
    packagesLoading,
    packagesError,
    setActivePackageAssignment,
    openPackageResults,
  } = d;

  const [classFilter, setClassFilter] = [d.historyClassFilter, d.setHistoryClassFilter];
  const items = packageAssignments
    .filter((item) => item.phase === "past" || item.phase === "current")
    .filter((item) => !classFilter || item.classId === classFilter)
    .sort((a, b) => String(b.startDate ?? "").localeCompare(String(a.startDate ?? "")));

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black tracking-normal text-brand-navy">الاختبارات السابقة</h2>
          <p className="mt-1 text-sm font-bold text-slate-400">درجات كل اختبار طبّقته فصولك.</p>
        </div>
        <button
          onClick={() => setView("classes")}
          className="flex-shrink-0 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-extrabold text-slate-500 transition hover:border-brand/40 hover:text-brand"
        >
          ← الرئيسية
        </button>
      </div>

      {classes.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {[{ id: "", name: "كل الفصول" }, ...classes].map((cls) => (
            <button
              key={cls.id || "all"}
              onClick={() => setClassFilter(cls.id)}
              className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-bold transition ${
                classFilter === cls.id ? "bg-brand text-white" : "bg-white text-slate-500 hover:text-brand-navy"
              }`}
            >
              {cls.name}
            </button>
          ))}
        </div>
      )}

      {packagesError && (
        <div className="rounded-[1.25rem] border border-red-100 bg-red-50 p-4 text-sm font-bold text-red-700">{packagesError}</div>
      )}

      {packagesLoading ? (
        <div className="rounded-[1.25rem] border border-dashed border-teal-100 bg-teal-50/40 p-8 text-center font-bold text-slate-500">
          جارٍ التحميل...
        </div>
      ) : items.length ? (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-[1.25rem] border border-slate-100 bg-white">
          {items.map((item) => {
            const studentCount = classStudents[item.classId]?.length ?? 0;
            const tested = item.testedCount ?? 0;
            return (
              <li key={item.id} className="p-4">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-black leading-snug text-brand-navy">{item.packageTitle}</p>
                    <p className="mt-0.5 text-xs font-bold text-slate-400">
                      {item.className} · {formatTestDay(item.startDate)} · {toEnglishDigits(tested)}/{toEnglishDigits(studentCount)} طالب
                      {item.phase === "current" ? " · هذا الأسبوع" : ""}
                    </p>
                  </div>
                  {tested > 0 && item.average !== null && item.average !== undefined ? (
                    <span className="flex-shrink-0 text-xl font-black" style={{ color: levelColor(item.average) }}>
                      {toEnglishDigits(item.average)}%
                    </span>
                  ) : null}
                </div>
                {(tested > 0 || (studentCount > 0 && tested < studentCount)) && (
                  <div className="mt-3 flex gap-2">
                    {tested > 0 ? (
                      <button
                        onClick={() => void openPackageResults(item)}
                        className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-extrabold text-slate-600 transition hover:border-brand/40 hover:text-brand"
                      >
                        الدرجات
                      </button>
                    ) : null}
                    {studentCount > 0 && tested < studentCount ? (
                      <button
                        onClick={() => setActivePackageAssignment(item)}
                        className="rounded-xl px-3 py-2 text-xs font-extrabold text-brand hover:bg-teal-50"
                      >
                        {tested ? "أكمل التصحيح" : item.phase === "current" ? "تصحيح" : "تصحيح متأخر"}
                      </button>
                    ) : null}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="rounded-[1.25rem] border border-dashed border-teal-100 bg-teal-50/40 p-8 text-center">
          <p className="font-black text-brand-navy">لا توجد اختبارات سابقة بعد.</p>
          <p className="mt-1 text-sm font-bold text-slate-400">بعد انتهاء اختبار الأسبوع يظهر هنا مع درجاته.</p>
        </div>
      )}
    </section>
  );
}
