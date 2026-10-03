"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatSchoolDateRange, toEnglishDigits, formatNumber } from "@/lib/format";
import { COLORS } from "@/lib/theme";
import { difficultyLabel } from "@/lib/labels";
import { EmptyState, KpiCard, formatPct } from "./ui";
import type { PrincipalDashboardState } from "../_lib/use-principal-dashboard";

export function DashboardTab({ d }: { d: PrincipalDashboardState }) {
  const {
    report,
    packageSummaries,
    packagesLoading,
    packagesError,
    parentStats,
    parentStatsLoading,
    parentStatsError,
    chartData,
    loadPackageSummaries,
    loadParentStats,
    executedClassesCount,
    measuredStudentsCount,
    criticalSkillsCount,
  } = d;
  if (!report) return null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        <KpiCard label="جاهزية دالا" value={report.readinessIndex.value === null ? "—" : `${toEnglishDigits(report.readinessIndex.value)}%`} sub="مؤشر عام" icon="📊" />
        <KpiCard label="الفصول المنفذة" value={formatNumber(executedClassesCount)} sub="اختبارات مصححة" icon="✅" />
        <KpiCard label="الطلاب المقاسون" value={formatNumber(measuredStudentsCount)} sub="نتائج محفوظة" icon="👥" />
        <KpiCard label="المهارات الحرجة" value={formatNumber(criticalSkillsCount)} sub="تحتاج متابعة" icon="⚠️" color={COLORS.danger} />
        <KpiCard label="تفاعل أولياء الأمور" value={parentStats ? formatNumber(parentStats.openedReports) : "—"} sub="تقارير مفتوحة" icon="💬" />
      </div>

      <div className="rounded-[1.5rem] border border-teal-100 bg-white p-6 shadow-[0_10px_34px_rgba(15,35,55,0.035)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-extrabold text-brand">خطة دالا</p>
            <h3 className="mt-1 text-xl font-black text-brand-navy">
              {report.weeklyPlanSummary.source === "current_week" ? "خطة هذا الأسبوع" : report.weeklyPlanSummary.source === "upcoming" ? "أقرب خطة قادمة" : "لا توجد خطة مفعّلة"}
            </h3>
            {report.weeklyPlanSummary.weekNumber ? (
              <p className="mt-2 text-sm font-bold leading-7 text-slate-500">
                الأسبوع {toEnglishDigits(report.weeklyPlanSummary.weekNumber)}: {formatSchoolDateRange({
                  startDate: report.weeklyPlanSummary.startDate,
                  endDate: report.weeklyPlanSummary.endDate,
                  startHijri: report.weeklyPlanSummary.startHijri,
                  endHijri: report.weeklyPlanSummary.endHijri,
                })}
              </p>
            ) : (
              <p className="mt-2 text-sm font-bold text-slate-400">أضف الخطط الأسبوعية من إدارة النظام لتظهر هنا.</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-teal-50 px-3 py-1 text-sm font-bold text-brand">
              الصفوف {report.weeklyPlanSummary.targetGrades.map((grade) => toEnglishDigits(grade)).join("، ")}
            </span>
            <span className="rounded-full bg-slate-50 px-3 py-1 text-sm font-bold text-slate-500">
              {report.weeklyPlanSummary.targetSubjects.join("، ")}
            </span>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-4">
          <div className="rounded-xl bg-slate-50 p-4">
            <div className="text-2xl font-black text-brand-navy">{toEnglishDigits(report.weeklyPlanSummary.activePlansCount)}</div>
            <div className="mt-1 text-xs font-bold text-slate-400">خطط نشطة</div>
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <div className="text-2xl font-black text-brand">{toEnglishDigits(report.weeklyPlanSummary.matchingClassesCount)}</div>
            <div className="mt-1 text-xs font-bold text-slate-400">فصول مطابقة</div>
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <div className="text-2xl font-black text-warning">{toEnglishDigits(report.weeklyPlanSummary.classesWithoutPlans)}</div>
            <div className="mt-1 text-xs font-bold text-slate-400">فصول بلا خطة</div>
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <div className="text-2xl font-black text-slate-600">{formatPct(report.kpis.implementationRate)}</div>
            <div className="mt-1 text-xs font-bold text-slate-400">نسبة التنفيذ</div>
          </div>
        </div>

        {report.weeklyPlanSummary.plans.length ? (
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {report.weeklyPlanSummary.plans.slice(0, 8).map((plan) => (
              <div key={plan.id} className="rounded-xl border border-slate-100 bg-white p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-sm font-black text-brand-navy">{plan.gradeLabel}</span>
                  <span className="rounded-full bg-teal-50 px-2 py-1 text-xs font-bold text-brand">{plan.subject}</span>
                </div>
                <p className="text-sm font-bold leading-6 text-slate-500">{plan.skill}</p>
                <p className="mt-2 text-xs font-bold text-slate-400">{difficultyLabel(plan.difficultyLevel)}</p>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="rounded-[1.5rem] border border-slate-100 bg-white p-6 shadow-[0_10px_34px_rgba(15,35,55,0.035)]">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-extrabold text-brand">اختبارات دالا</p>
            <h3 className="mt-1 text-xl font-black text-brand-navy">تنفيذ الحزم ونتائجها</h3>
          </div>
          <button onClick={loadPackageSummaries} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-extrabold text-slate-500">
            تحديث
          </button>
        </div>
        {packagesLoading ? (
          <EmptyState>جارٍ تحميل اختبارات دالا...</EmptyState>
        ) : packagesError ? (
          <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm font-bold text-red-700">{packagesError}</div>
        ) : packageSummaries.length ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {packageSummaries.map((item) => (
              <div key={item.packageId} className="rounded-[1.25rem] border border-slate-100 bg-slate-50/50 p-5">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-extrabold text-brand">
                      {item.subject} | الصف {toEnglishDigits(item.grade ?? "—")} | الأسبوع {toEnglishDigits(item.weekNumber ?? "—")}
                    </div>
                    <h4 className="mt-1 text-lg font-black text-brand-navy">{item.title}</h4>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-500">
                    {formatPct(item.averagePercentage)}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-white p-3">
                    <div className="text-xl font-black text-brand-navy">{toEnglishDigits(item.classesAssigned)}</div>
                    <div className="text-xs font-bold text-slate-400">فصول مطبقة</div>
                  </div>
                  <div className="rounded-xl bg-white p-3">
                    <div className="text-xl font-black text-brand">{toEnglishDigits(item.classesScanned)}</div>
                    <div className="text-xs font-bold text-slate-400">فصول مصححة</div>
                  </div>
                  <div className="rounded-xl bg-white p-3">
                    <div className="text-xl font-black text-brand-navy">{toEnglishDigits(item.studentsTested)}</div>
                    <div className="text-xs font-bold text-slate-400">طلاب مختبرون</div>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div>
                    <div className="mb-2 text-xs font-black text-slate-500">أضعف المجالات</div>
                    {item.weakestDomains.length ? item.weakestDomains.slice(0, 3).map((domain) => (
                      <div key={domain.name} className="mb-1 rounded-lg bg-white px-3 py-2 text-xs font-bold text-slate-600">
                        {domain.name} · {toEnglishDigits(`${domain.wrong}/${domain.total}`)}
                      </div>
                    )) : <p className="text-xs font-bold text-slate-400">لا توجد بيانات كافية</p>}
                  </div>
                  <div>
                    <div className="mb-2 text-xs font-black text-slate-500">أضعف المهارات</div>
                    {item.weakestSkills.length ? item.weakestSkills.slice(0, 3).map((skill) => (
                      <div key={skill.name} className="mb-1 rounded-lg bg-white px-3 py-2 text-xs font-bold text-slate-600">
                        {skill.name} · {toEnglishDigits(`${skill.wrong}/${skill.total}`)}
                      </div>
                    )) : <p className="text-xs font-bold text-slate-400">لا توجد بيانات كافية</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState>لا توجد اختبارات دالا مطبقة على فصول المدرسة بعد.</EmptyState>
        )}
      </div>

      <div className="rounded-[1.5rem] border border-slate-100 bg-white p-6 shadow-[0_10px_34px_rgba(15,35,55,0.035)]">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-extrabold text-brand">تفاعل أولياء الأمور</p>
            <h3 className="mt-1 text-xl font-black text-brand-navy">مؤشرات عامة على مستوى المدرسة</h3>
            <p className="mt-1 text-sm font-bold text-slate-400">لا تعرض هذه البطاقة أسماء الطلاب أو بيانات التواصل.</p>
          </div>
          <button onClick={loadParentStats} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-extrabold text-slate-500">
            تحديث
          </button>
        </div>
        {parentStatsLoading ? (
          <EmptyState>جارٍ تحميل تفاعل أولياء الأمور...</EmptyState>
        ) : parentStatsError ? (
          <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm font-bold text-red-700">{parentStatsError}</div>
        ) : parentStats ? (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
              <div className="rounded-xl bg-slate-50 p-4 text-center">
                <div className="text-2xl font-black text-brand-navy">{toEnglishDigits(parentStats.totalLinks)}</div>
                <div className="mt-1 text-xs font-bold text-slate-400">روابط ولي الأمر</div>
              </div>
              <div className="rounded-xl bg-teal-50 p-4 text-center">
                <div className="text-2xl font-black text-brand">{toEnglishDigits(parentStats.openedReports)}</div>
                <div className="mt-1 text-xs font-bold text-slate-400">تقارير مفتوحة</div>
              </div>
              <div className="rounded-xl bg-slate-50 p-4 text-center">
                <div className="text-2xl font-black text-brand-navy">{formatPct(parentStats.openRate)}</div>
                <div className="mt-1 text-xs font-bold text-slate-400">نسبة الفتح</div>
              </div>
              <div className="rounded-xl bg-slate-50 p-4 text-center">
                <div className="text-2xl font-black text-brand-navy">{toEnglishDigits(parentStats.missionClicks)}</div>
                <div className="mt-1 text-xs font-bold text-slate-400">ضغطات التدريب</div>
              </div>
              <div className="rounded-xl bg-emerald-50 p-4 text-center">
                <div className="text-2xl font-black text-emerald-700">{toEnglishDigits(parentStats.completedMissions)}</div>
                <div className="mt-1 text-xs font-bold text-slate-400">تدريبات مكتملة</div>
              </div>
              <div className="rounded-xl bg-amber-50 p-4 text-center">
                <div className="text-2xl font-black text-warning">{toEnglishDigits(parentStats.subscriptionInterestCount)}</div>
                <div className="mt-1 text-xs font-bold text-slate-400">مهتمون بالتدريب</div>
              </div>
            </div>
            {parentStats.totalLinks === 0 ? (
              <EmptyState>لم يتم إنشاء روابط ولي أمر بعد.</EmptyState>
            ) : parentStats.openedReports === 0 ? (
              <div className="rounded-xl bg-slate-50 p-4 text-sm font-bold text-slate-500">
                تم إنشاء روابط، لكن لم يفتح أولياء الأمور التقارير بعد.
              </div>
            ) : (
              <div className="rounded-xl bg-slate-50 p-4 text-sm font-bold text-slate-500">
                أكثر مهارة ظهر عليها اهتمام: {parentStats.topInterestedSkill ? `${parentStats.topInterestedSkill.skillName} (${toEnglishDigits(parentStats.topInterestedSkill.count)})` : "لا توجد بيانات كافية بعد"}
              </div>
            )}
          </div>
        ) : (
          <EmptyState>لا توجد بيانات تفاعل بعد.</EmptyState>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[1.5rem] border border-slate-100 bg-white p-6 shadow-[0_10px_34px_rgba(15,35,55,0.035)]">
          <h3 className="mb-5 font-black text-brand-navy">الفصول ومتوسط الأداء</h3>
          {chartData.length ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} domain={[0, 100]} />
                <Tooltip />
                <Bar dataKey="avg" fill={COLORS.brand} name="متوسط الأداء" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyState>لا توجد فصول كافية للرسم بعد</EmptyState>}
        </div>

        <div className="rounded-[1.5rem] border border-slate-100 bg-white p-6 shadow-[0_10px_34px_rgba(15,35,55,0.035)]">
          <h3 className="font-black text-brand-navy">جاهزية نافس</h3>
          <p className="mt-1 text-sm font-bold text-slate-400">{report.readinessIndex.label}</p>
          <div className="my-6 text-center text-6xl font-black text-brand">
            {report.readinessIndex.value === null ? "—" : `${toEnglishDigits(report.readinessIndex.value)}%`}
          </div>
          <p className="rounded-xl bg-slate-50 p-3 text-xs font-bold leading-6 text-slate-500">
            {toEnglishDigits(report.readinessIndex.formula)}
          </p>
        </div>
      </div>
    </div>
  );
}
