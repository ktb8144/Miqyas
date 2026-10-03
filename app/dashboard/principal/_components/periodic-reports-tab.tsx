"use client";

import { toEnglishDigits, formatNumber } from "@/lib/format";
import { EmptyState, KpiCard, formatPct } from "./ui";
import type { PrincipalDashboardState } from "../_lib/use-principal-dashboard";

export function PeriodicReportsTab({ d }: { d: PrincipalDashboardState }) {
  const {
    periodicForm,
    setPeriodicForm,
    periodicPreview,
    periodicWeeks,
    periodicLoading,
    periodicWeeksLoading,
    periodicError,
    loadPeriodicWeeks,
    previewPeriodicReport,
    exportPeriodicReport,
  } = d;
  return (
    <div className="space-y-6">
      <div className="rounded-[1.5rem] border border-slate-100 bg-white p-6 shadow-[0_10px_34px_rgba(15,35,55,0.035)]">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-extrabold text-brand">التقارير الدورية</p>
            <h3 className="mt-1 text-xl font-black text-brand-navy">تقرير رسمي قابل للطباعة</h3>
            <p className="mt-1 text-sm font-bold text-slate-400">تُسحب الأرقام من نتائج الاختبارات المحفوظة فقط.</p>
          </div>
          <button
            onClick={exportPeriodicReport}
            disabled={periodicLoading}
            className="rounded-xl bg-brand px-4 py-2 text-sm font-extrabold text-white disabled:opacity-60"
          >
            فتح نسخة الطباعة
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <label className="text-sm font-bold text-slate-500">
            نوع التقرير
            <select value={periodicForm.reportType} onChange={(event) => setPeriodicForm((prev) => ({ ...prev, reportType: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 font-bold text-brand-navy outline-none">
              <option value="learning_outcomes_followup">بطاقة متابعة نواتج التعلم</option>
              <option value="nafs_readiness">تقرير الاستعداد لاختبارات نافس</option>
              <option value="learning_outcomes_improvement">خطة تحسين نواتج التعلم</option>
              <option value="subject_results_analysis">بطاقة تحليل نتائج المادة</option>
            </select>
          </label>
          <label className="text-sm font-bold text-slate-500">
            اختر الأسبوع
            <select
              value={periodicForm.weekNumber}
              onChange={(event) => setPeriodicForm((prev) => ({ ...prev, weekNumber: event.target.value }))}
              disabled={periodicWeeksLoading || !periodicWeeks.length}
              className="mt-1 w-full rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 font-bold text-brand-navy outline-none disabled:opacity-60"
            >
              {periodicWeeks.length ? periodicWeeks.map((week) => (
                <option key={week.weekNumber} value={week.weekNumber}>
                  {week.label}
                </option>
              )) : (
                <option value="">لا توجد أسابيع متاحة</option>
              )}
            </select>
          </label>
          <label className="text-sm font-bold text-slate-500">
            المادة
            <select value={periodicForm.subject} onChange={(event) => setPeriodicForm((prev) => ({ ...prev, subject: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 font-bold text-brand-navy outline-none">
              <option value="">جميع المواد</option>
              <option value="رياضيات">رياضيات</option>
              <option value="لغة عربية">لغة عربية</option>
              <option value="علوم">علوم</option>
            </select>
          </label>
          <label className="text-sm font-bold text-slate-500">
            الصف
            <select value={periodicForm.grade} onChange={(event) => setPeriodicForm((prev) => ({ ...prev, grade: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 font-bold text-brand-navy outline-none">
              <option value="">جميع الصفوف</option>
              {[3, 4, 5, 6].map((grade) => <option key={grade} value={grade}>{toEnglishDigits(grade)}</option>)}
            </select>
          </label>
          <label className="text-sm font-bold text-slate-500">
            اسم قائد المدرسة
            <input value={periodicForm.principalName} onChange={(event) => setPeriodicForm((prev) => ({ ...prev, principalName: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 font-bold text-brand-navy outline-none" />
          </label>
          <label className="text-sm font-bold text-slate-500">
            المنطقة التعليمية
            <input value={periodicForm.educationRegion} onChange={(event) => setPeriodicForm((prev) => ({ ...prev, educationRegion: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 font-bold text-brand-navy outline-none" />
          </label>
        </div>

        {!periodicWeeksLoading && !periodicWeeks.length && (
          <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-bold text-warning">
            لا توجد أسابيع متاحة بناءً على الاختبارات المنشورة.
          </div>
        )}

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {[
            ["showStudentNames", "إظهار أسماء الطلاب"],
            ["includeImprovementPlan", "تضمين خطة تحسين"],
            ["includeRecommendations", "تضمين توصيات"],
          ].map(([key, label]) => (
            <label key={key} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-sm font-bold text-slate-600">
              {label}
              <select value={periodicForm[key as keyof typeof periodicForm]} onChange={(event) => setPeriodicForm((prev) => ({ ...prev, [key]: event.target.value }))} className="rounded-lg border border-slate-100 bg-white px-3 py-1 font-bold">
                <option value="true">نعم</option>
                <option value="false">لا</option>
              </select>
            </label>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button onClick={previewPeriodicReport} disabled={periodicLoading} className="rounded-xl border border-brand/20 bg-teal-50 px-5 py-3 text-sm font-extrabold text-brand disabled:opacity-60">
            {periodicLoading ? "جارٍ التحميل..." : "معاينة التقرير"}
          </button>
          <button onClick={loadPeriodicWeeks} disabled={periodicWeeksLoading} className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-extrabold text-slate-500 disabled:opacity-60">
            تحديث الأسابيع
          </button>
          {periodicError && <span className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{periodicError}</span>}
        </div>
      </div>

      {periodicPreview && (
        <div className="space-y-5 rounded-[1.5rem] border border-slate-100 bg-white p-6 shadow-[0_10px_34px_rgba(15,35,55,0.035)]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-xl font-black text-brand-navy">{periodicPreview.title}</h3>
              <p className="mt-1 text-sm font-bold text-slate-400">معاينة مختصرة قبل الطباعة</p>
            </div>
            {!periodicPreview.hasEnoughData && (
              <span className="rounded-full bg-amber-50 px-3 py-1 text-sm font-bold text-warning">لا توجد نتائج كافية</span>
            )}
          </div>
          {!periodicPreview.hasEnoughData && <EmptyState>لا توجد نتائج كافية لإنشاء التقرير في الفترة المحددة.</EmptyState>}
          <div className="grid gap-3 md:grid-cols-4">
            <KpiCard label="عدد الطلاب" value={formatNumber(periodicPreview.generalData.studentsCount)} sub="حسب الفلتر" icon="👥" />
            <KpiCard label="الطلاب المختبرون" value={formatNumber(periodicPreview.generalData.testedStudentsCount)} sub="نتائج محفوظة" icon="✅" />
            <KpiCard label="متوسط الأداء" value={formatPct(periodicPreview.generalData.performanceAverage)} sub="من قاعدة البيانات" icon="🎯" />
            <KpiCard label="نسبة الإتقان" value={formatPct(periodicPreview.generalData.masteryPercentage)} sub="70% فأعلى" icon="📈" />
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="rounded-2xl bg-slate-50 p-4">
              <h4 className="mb-3 font-black text-brand-navy">أضعف المهارات</h4>
              {periodicPreview.skillAnalysis.length ? periodicPreview.skillAnalysis.slice(0, 6).map((item) => (
                <div key={item.name} className="mb-2 rounded-xl bg-white px-3 py-2 text-sm font-bold text-slate-600">
                  {item.name} · {toEnglishDigits(item.masteryPercentage)}% · {item.needLevel}
                </div>
              )) : <EmptyState>لا توجد مهارات كافية للتحليل</EmptyState>}
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <h4 className="mb-3 font-black text-brand-navy">توزيع مستويات الأداء</h4>
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="rounded-xl bg-white p-3"><div className="font-black text-brand">{toEnglishDigits(periodicPreview.levelDistribution.high)}</div><div className="text-xs font-bold text-slate-400">مرتفع</div></div>
                <div className="rounded-xl bg-white p-3"><div className="font-black text-brand-navy">{toEnglishDigits(periodicPreview.levelDistribution.medium)}</div><div className="text-xs font-bold text-slate-400">متوسط</div></div>
                <div className="rounded-xl bg-white p-3"><div className="font-black text-warning">{toEnglishDigits(periodicPreview.levelDistribution.low)}</div><div className="text-xs font-bold text-slate-400">منخفض</div></div>
                <div className="rounded-xl bg-white p-3"><div className="font-black text-danger">{toEnglishDigits(periodicPreview.levelDistribution.veryLow)}</div><div className="text-xs font-bold text-slate-400">منخفض جدًا</div></div>
              </div>
            </div>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <h4 className="mb-3 font-black text-brand-navy">مرئيات وتوصيات</h4>
            <div className="space-y-2 text-sm font-bold leading-7 text-slate-600">
              {periodicPreview.recommendations.map((item) => <p key={item}>• {toEnglishDigits(item)}</p>)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
