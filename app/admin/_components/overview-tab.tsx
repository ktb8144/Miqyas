"use client";

import {
  Activity,
  Building2,
  ClipboardList,
  Download,
  GraduationCap,
  TrendingDown,
  UsersRound,
} from "lucide-react";
import { formatNumber } from "@/lib/format";
import { COLORS } from "@/lib/theme";
import type { ApiState, OverviewData } from "../_lib/types";
import { EmptyState, ErrorState, PageHeader, PrimaryButton, SoftButton, StatCard } from "./ui";

export function OverviewTab({
  overview,
  state,
  error,
  onAddSchool,
  onRetry,
}: {
  overview: OverviewData;
  state: ApiState;
  error: string | null;
  onAddSchool: () => void;
  onRetry: () => void;
}) {
  const stats = [
    {
      title: "المدارس",
      value: formatNumber(overview.schools.total),
      hint: "عدد المدارس المسجلة في المنصة",
      icon: Building2,
      accent: COLORS.brand,
    },
    {
      title: "المستخدمون",
      value: formatNumber(overview.users.total),
      hint: `admin ${overview.users.byRole.admin} · principal ${overview.users.byRole.principal} · teacher ${overview.users.byRole.teacher}`,
      icon: UsersRound,
      accent: COLORS.navy,
    },
    {
      title: "الطلاب",
      value: formatNumber(overview.students.total),
      hint: "طلاب مرتبطون بمدارس وفصول",
      icon: GraduationCap,
      accent: "#14b8a6",
    },
    {
      title: "الأسئلة",
      value: formatNumber(overview.questions.total),
      hint: "أسئلة أسبوعية جاهزة أو منشورة",
      icon: ClipboardList,
      accent: "#f59e0b",
    },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title="لوحة مدير النظام"
        description="نظرة مركزية على المدارس والمستخدمين والطلاب والأسئلة، مع مؤشرات تساعدك على متابعة تشغيل المنصة."
        action={
          <div className="flex gap-3">
            <SoftButton disabled title="قريبًا">
              <Download className="h-4 w-4" />
              تصدير ملخص · قريبًا
            </SoftButton>
            <PrimaryButton onClick={onAddSchool}>إضافة مدرسة</PrimaryButton>
          </div>
        }
      />

      {state === "error" && (
        <ErrorState message={`${error ?? "تعذر تحميل الإحصاءات الحية"}. لا يتم عرض بيانات تجريبية بدل البيانات الفعلية.`} onRetry={onRetry} />
      )}

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.title} {...stat} />
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[1.5rem] border border-slate-100 bg-white p-6 shadow-[0_10px_34px_rgba(15,35,55,0.035)]">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black text-brand-navy">آخر النشاطات</h2>
              <p className="mt-1 text-sm text-slate-400">سيتم ربطها بسجل نشاط فعلي في مرحلة لاحقة</p>
            </div>
            <Activity className="h-5 w-5 text-brand" />
          </div>
          <EmptyState message="لا توجد نشاطات فعلية مرتبطة بعد." />
        </div>

        <div className="rounded-[1.5rem] border border-slate-100 bg-white p-6 shadow-[0_10px_34px_rgba(15,35,55,0.035)]">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black text-brand-navy">المهارات الأضعف</h2>
              <p className="mt-1 text-sm text-slate-400">ستظهر بعد ربط نتائج الحزم والتصحيح</p>
            </div>
            <TrendingDown className="h-5 w-5 text-rose-500" />
          </div>
          <EmptyState message="لا توجد نتائج فعلية كافية لحساب المهارات الأضعف." />
        </div>
      </div>
    </div>
  );
}
