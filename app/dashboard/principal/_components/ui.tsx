"use client";

import { toEnglishDigits, formatNumber } from "@/lib/format";
import { COLORS } from "@/lib/theme";
import { LEVEL_THRESHOLDS, MASTERY_THRESHOLD } from "@/lib/levels";
import type { PrincipalReport } from "../_lib/types";

export function formatPct(value: number | null) {
  return value === null ? "لا توجد بيانات" : `${toEnglishDigits(value)}%`;
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-6 text-center text-sm font-bold text-slate-400">
      {children}
    </div>
  );
}

export function KpiCard({ label, value, sub, icon, color = COLORS.brand }: { label: string; value: string; sub: string; icon: string; color?: string }) {
  return (
    <div className="rounded-[1.5rem] border border-slate-100 bg-white p-5 shadow-[0_10px_34px_rgba(15,35,55,0.035)]">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-2xl">{icon}</span>
        <span className="text-xs font-bold text-slate-400">{sub}</span>
      </div>
      <div className="mb-1 text-3xl font-black" style={{ color }}>{value}</div>
      <div className="text-sm font-bold text-slate-500">{label}</div>
    </div>
  );
}

export function TeacherCard({ teacher }: { teacher: PrincipalReport["teachers"][number] }) {
  const badge = teacher.average === null
    ? { label: "لا توجد نتائج", color: "#64748b", bg: "#f8fafc" }
    : teacher.average >= LEVEL_THRESHOLDS.advanced
      ? { label: "ممتاز", color: COLORS.success, bg: "#f0fdf8" }
      : teacher.average >= LEVEL_THRESHOLDS.proficient
        ? { label: "جيد", color: COLORS.warning, bg: "#fffbeb" }
        : { label: "يحتاج دعم", color: COLORS.danger, bg: "#fff5f5" };

  const kpis = [
    { label: "الحالة", value: teacher.status === "invited" ? "دعوة" : "نشط", good: teacher.status !== "disabled" },
    { label: "الفصول", value: formatNumber(teacher.classesCount), good: teacher.classesCount > 0 },
    { label: "الطلاب", value: formatNumber(teacher.studentsCount), good: teacher.studentsCount > 0 },
    { label: "المتوسط", value: formatPct(teacher.average), good: (teacher.average ?? 0) >= MASTERY_THRESHOLD },
    { label: "النشاط", value: teacher.active ? "نشط" : "بحاجة تفعيل", good: teacher.active },
  ];

  return (
    <div className="rounded-[1.5rem] border border-slate-100 bg-white p-5 shadow-[0_10px_34px_rgba(15,35,55,0.035)]">
      <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="font-black text-brand-navy">{teacher.name}</div>
          <div className="text-sm font-bold text-slate-400">{teacher.subject} · {teacher.phone ?? "لا يوجد جوال"}</div>
          {teacher.classNames?.length ? (
            <div className="mt-1 text-xs font-bold text-slate-400">{teacher.classNames.join("، ")}</div>
          ) : null}
        </div>
        <span className="rounded-full px-3 py-1 text-sm font-bold" style={{ color: badge.color, background: badge.bg }}>
          {badge.label}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="rounded-xl bg-slate-50/80 p-2 text-center">
            <div className={`text-sm font-bold ${kpi.good ? "text-green-600" : "text-red-500"}`}>{kpi.value}</div>
            <div className="mt-0.5 text-xs font-bold text-slate-400">{kpi.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
