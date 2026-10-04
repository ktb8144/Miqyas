"use client";

import { History } from "lucide-react";
import { toEnglishDigits } from "@/lib/format";
import { levelColor } from "@/lib/levels";
import type { TeacherDashboardState } from "../_lib/use-teacher-dashboard";
import { TestCard, formatTestDay } from "./test-card";

/** Teacher home: this week's test first, then the classes, then a link to older grades. */
export function ClassesView({ d }: { d: TeacherDashboardState }) {
  const {
    setView,
    classes,
    classStudents,
    setShowAddClass,
    packageAssignments,
    packagesLoading,
    setActivePackageAssignment,
    openPackageResults,
    markPackagePrinted,
    handleViewStudents,
  } = d;

  const byStart = (a: { startDate: string | null }, b: { startDate: string | null }) =>
    String(a.startDate ?? "").localeCompare(String(b.startDate ?? ""));
  const thisWeek = packageAssignments.filter((item) => item.phase === "current").sort(byStart);
  const upcoming = packageAssignments.filter((item) => item.phase === "upcoming").sort(byStart);
  // Show what can be acted on now; tests starting in the next few days appear so they can be printed.
  const visible = [...thisWeek, ...upcoming];
  const pastCount = packageAssignments.filter((item) => item.phase === "past").length;

  const latestTested = (classId: string) =>
    packageAssignments
      .filter((item) => item.classId === classId && (item.testedCount ?? 0) > 0 && item.phase !== "upcoming")
      .sort((a, b) => byStart(b, a))[0];

  return (
    <>
      <section>
        <h2 className="mb-3 text-xl font-black tracking-normal text-brand-navy sm:text-2xl">اختبار هذا الأسبوع</h2>
        {packagesLoading ? (
          <div className="rounded-[1.25rem] border border-dashed border-teal-100 bg-teal-50/40 p-6 text-center font-bold text-slate-500">
            جارٍ التحميل...
          </div>
        ) : visible.length ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {visible.map((item) => (
              <TestCard
                key={item.id}
                item={item}
                studentCount={classStudents[item.classId]?.length ?? 0}
                onScan={() => setActivePackageAssignment(item)}
                onResults={() => void openPackageResults(item)}
                onPrint={() => void markPackagePrinted(item.id)}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-[1.25rem] border border-dashed border-teal-100 bg-teal-50/40 p-6 text-center">
            <p className="font-black text-brand-navy">
              {classes.length ? "لا يوجد اختبار لفصولك هذا الأسبوع." : "أضف فصلك الأول لتظهر هنا اختبارات الأسبوع."}
            </p>
            {classes.length > 0 && (
              <p className="mt-1 text-sm font-bold text-slate-400">يظهر الاختبار هنا قبل بدايته بثلاثة أيام لتتمكن من طباعته.</p>
            )}
          </div>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-xl font-black tracking-normal text-brand-navy sm:text-2xl">فصولي</h2>
          <button
            onClick={() => setView("packages")}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-extrabold text-slate-600 transition hover:border-brand/40 hover:text-brand"
          >
            <History className="h-4 w-4" />
            الاختبارات السابقة{pastCount ? ` (${toEnglishDigits(pastCount)})` : ""}
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {classes.length === 0 && (
            <div className="rounded-[1.25rem] border border-slate-100 bg-white p-8 text-center text-slate-400">
              <p className="font-bold">لا توجد فصول محفوظة بعد</p>
            </div>
          )}
          {classes.map((cls) => {
            const students = classStudents[cls.id] ?? [];
            const last = latestTested(cls.id);
            return (
              <button
                key={cls.id}
                onClick={() => handleViewStudents(cls.id)}
                className="flex items-center gap-4 rounded-[1.25rem] border border-slate-100 bg-white p-4 text-right shadow-[0_10px_34px_rgba(15,35,55,0.035)] transition hover:border-brand/30"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-lg font-black text-brand-navy">{cls.name}</div>
                  <div className="mt-0.5 truncate text-xs font-bold text-slate-400">
                    {cls.subject} · {toEnglishDigits(students.length)} طالب
                    {last ? ` · آخر اختبار ${formatTestDay(last.startDate)}` : ""}
                  </div>
                </div>
                {last && last.average !== null && last.average !== undefined ? (
                  <div className="flex-shrink-0 text-center">
                    <div className="text-xl font-black" style={{ color: levelColor(last.average) }}>{toEnglishDigits(last.average)}%</div>
                    <div className="text-[11px] font-bold text-slate-400">آخر متوسط</div>
                  </div>
                ) : null}
                <span className="flex-shrink-0 text-slate-300">←</span>
              </button>
            );
          })}
        </div>

        <button
          onClick={() => setShowAddClass(true)}
          className="mt-4 w-full rounded-[1.25rem] border border-dashed border-brand/40 bg-white py-3.5 text-sm font-extrabold text-brand transition hover:bg-teal-50/50"
        >
          + إضافة فصل جديد
        </button>
      </section>
    </>
  );
}
