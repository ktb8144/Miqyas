"use client";

import { formatSchoolDateRange, toEnglishDigits } from "@/lib/format";
import { difficultyLabel } from "@/lib/labels";
import type { TeacherDashboardState } from "../_lib/use-teacher-dashboard";

export function WeeklyPlansView({ d }: { d: TeacherDashboardState }) {
  const { setView, planLoading, allPlanItems, handleViewStudents } = d;
  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-extrabold text-brand">الخطة الأسبوعية</p>
          <h2 className="mt-1 text-2xl font-black tracking-normal text-brand-navy">خطة الأسابيع لفصولي</h2>
        </div>
        <button
          onClick={() => setView("classes")}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-extrabold text-slate-500 transition hover:border-brand/40 hover:text-brand"
        >
          ← العودة للفصول
        </button>
      </div>

      {planLoading ? (
        <div className="rounded-[1.5rem] border border-slate-100 bg-white p-8 text-center font-bold text-slate-500 shadow-[0_10px_34px_rgba(15,35,55,0.035)]">
          جارٍ تحميل خطة الأسابيع...
        </div>
      ) : allPlanItems.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {allPlanItems.map((item) => (
            <div key={`${item.class.id}-${item.plan.id}`} className="rounded-[1.5rem] border border-slate-100 bg-white p-5 shadow-[0_10px_34px_rgba(15,35,55,0.035)]">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-bold text-slate-400">الأسبوع {toEnglishDigits(item.plan.week_number)}</div>
                  <h3 className="mt-1 text-xl font-black text-brand-navy">{item.plan.skill}</h3>
                </div>
                <span className="rounded-full bg-teal-50 px-3 py-1 text-sm font-bold text-brand">
                  {difficultyLabel(item.plan.difficulty_level)}
                </span>
              </div>
              <p className="text-sm font-bold leading-7 text-slate-500">
                {item.plan.learning_goal ?? "هدف التعلم قابل للتحديث من الإدارة."}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-bold text-slate-500">{item.class.name}</span>
                <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-bold text-slate-500">{item.plan.grade_label}</span>
                <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-bold text-slate-500">{item.plan.subject}</span>
                <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-bold text-slate-500">
                  {formatSchoolDateRange({
                    startDate: item.plan.start_date,
                    endDate: item.plan.end_date,
                    startHijri: item.plan.start_hijri,
                    endHijri: item.plan.end_hijri,
                  })}
                </span>
                <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-bold text-slate-500">
                  {toEnglishDigits(item.plan.question_count)} أسئلة
                </span>
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  onClick={() => handleViewStudents(item.class.id)}
                  className="rounded-xl bg-brand px-4 py-2 text-sm font-extrabold text-white transition hover:bg-brand-dark"
                >
                  بدء التقييم
                </button>
                <button
                  onClick={() => window.print()}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-extrabold text-slate-500 transition hover:border-brand/40 hover:text-brand"
                >
                  طباعة ورقة الاختبار
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-[1.5rem] border border-dashed border-teal-100 bg-white p-8 text-center shadow-[0_10px_34px_rgba(15,35,55,0.035)]">
          <h3 className="text-xl font-black text-brand-navy">لا توجد خطة مفعّلة لهذا الأسبوع.</h3>
          <p className="mt-2 text-sm font-bold text-slate-400">
            يمكنك التواصل مع مدير النظام لتفعيل خطة الصفوف 3-6 في مواد مقياس الحالية.
          </p>
        </div>
      )}
    </section>
  );
}
