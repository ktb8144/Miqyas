"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { formatNumber, toEnglishDigits } from "@/lib/format";
import { EmptyState, ErrorState, PageHeader, PrimaryButton, SearchBar } from "./ui";
import type { AdminSchool } from "../_lib/types";

export type SchoolStatus = "trial" | "active" | "suspended";

export function schoolStatusOf(school: AdminSchool): SchoolStatus {
  if (school.active === false) return "suspended";
  return school.trial ? "trial" : "active";
}

const STATUS_OPTIONS: { value: SchoolStatus; label: string; tone: string }[] = [
  { value: "trial", label: "تجريبية", tone: "border-amber-200 bg-amber-50 text-amber-800" },
  { value: "active", label: "مشتركة (نشطة)", tone: "border-emerald-200 bg-emerald-50 text-emerald-800" },
  { value: "suspended", label: "موقوفة", tone: "border-rose-200 bg-rose-50 text-rose-700" },
];

export function SchoolsTab({
  schools,
  loading,
  error,
  search,
  onSearchChange,
  onRetry,
  onAddSchool,
  onEditSchool,
  onChangeStatus,
  busySchoolId,
}: {
  schools: AdminSchool[];
  loading: boolean;
  error: string | null;
  search: string;
  onSearchChange: (value: string) => void;
  onRetry: () => void;
  onAddSchool: () => void;
  onEditSchool: (school: AdminSchool) => void;
  onChangeStatus: (school: AdminSchool, status: SchoolStatus) => void;
  busySchoolId: string | null;
}) {
  const [statusFilter, setStatusFilter] = useState<SchoolStatus | "all">("all");
  const today = new Date().toISOString().slice(0, 10);
  const visible = statusFilter === "all" ? schools : schools.filter((school) => schoolStatusOf(school) === statusFilter);
  const countOf = (status: SchoolStatus) => schools.filter((school) => schoolStatusOf(school) === status).length;

  return (
    <div className="space-y-8">
      <PageHeader
        title="إدارة المدارس"
        description="عرض المدارس، إضافة مدرسة جديدة، وتفعيل أو تعطيل الوصول حسب حالة الاشتراك والتجربة."
        action={<PrimaryButton onClick={onAddSchool} disabled={Boolean(busySchoolId)}>إضافة مدرسة</PrimaryButton>}
      />
      {error && <ErrorState message={error} onRetry={onRetry} />}
      <div className="rounded-[1.5rem] border border-slate-100 bg-white shadow-[0_10px_34px_rgba(15,35,55,0.035)]">
        <div className="flex flex-col gap-4 border-b border-slate-100 p-5 md:flex-row md:items-center md:justify-between">
          <SearchBar placeholder="ابحث باسم المدرسة أو المدينة" value={search} onChange={onSearchChange} />
          <div className="flex flex-wrap gap-2">
            {([{ value: "all", label: "الكل", count: schools.length }, ...STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label, count: countOf(o.value) }))] as const).map((option) => (
              <button
                key={option.value}
                onClick={() => setStatusFilter(option.value)}
                className={`rounded-full px-3 py-1.5 text-xs font-extrabold transition ${
                  statusFilter === option.value ? "bg-brand text-white" : "bg-slate-50 text-slate-500 hover:text-brand-navy"
                }`}
              >
                {option.label} ({toEnglishDigits(option.count)})
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-400">
                <th className="px-5 py-4 text-right font-extrabold">المدرسة</th>
                <th className="px-5 py-4 text-right font-extrabold">المدينة</th>
                <th className="px-5 py-4 text-right font-extrabold">المدير</th>
                <th className="px-5 py-4 text-right font-extrabold">المعلمون</th>
                <th className="px-5 py-4 text-right font-extrabold">الطلاب</th>
                <th className="px-5 py-4 text-right font-extrabold">الأداء</th>
                <th className="px-5 py-4 text-right font-extrabold">الحالة</th>
                <th className="px-5 py-4 text-right font-extrabold">إجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.map((school) => {
                const status = schoolStatusOf(school);
                const tone = STATUS_OPTIONS.find((o) => o.value === status)?.tone ?? "";
                const expired = status !== "suspended" && Boolean(school.subscriptionEnd) && school.subscriptionEnd! < today;
                return (
                <tr key={school.id} className="transition hover:bg-slate-50/70">
                  <td className="px-5 py-4 font-extrabold text-brand-navy">{school.name}</td>
                  <td className="px-5 py-4 font-bold text-slate-500">{school.city}</td>
                  <td className="px-5 py-4 font-bold text-slate-500">{school.principal}</td>
                  <td className="px-5 py-4 font-bold text-slate-500">{school.teachers}</td>
                  <td className="px-5 py-4 font-bold text-slate-500">{formatNumber(school.students)}</td>
                  <td className="px-5 py-4 font-extrabold text-brand">{school.score}</td>
                  <td className="px-5 py-4">
                    <select
                      value={status}
                      disabled={busySchoolId === school.id}
                      onChange={(event) => onChangeStatus(school, event.target.value as SchoolStatus)}
                      aria-label={`حالة ${school.name}`}
                      className={`rounded-full border px-3 py-1 text-xs font-bold outline-none disabled:opacity-50 ${tone}`}
                    >
                      {STATUS_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                    {school.subscriptionEnd && status !== "suspended" && (
                      <div className={`mt-1 text-[11px] font-bold ${expired ? "text-danger" : "text-slate-400"}`}>
                        {expired ? "انتهت في " : "حتى "}{toEnglishDigits(school.subscriptionEnd)}
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <button
                      onClick={() => onEditSchool(school)}
                      disabled={busySchoolId === school.id}
                      aria-label={`تعديل ${school.name}`}
                      className="inline-flex items-center gap-1 rounded-xl border border-slate-100 px-3 py-2 text-xs font-bold text-slate-500 transition hover:text-brand disabled:opacity-50"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      تعديل
                    </button>
                  </td>
                </tr>
                );
              })}
              {!loading && visible.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-10">
                    <EmptyState message={search ? "لا توجد مدارس مطابقة للبحث." : "لا توجد مدارس فعلية حتى الآن."} />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
