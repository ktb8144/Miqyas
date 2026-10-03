"use client";

import { Settings } from "lucide-react";
import { formatNumber } from "@/lib/format";
import {
  ActionDropdown,
  EmptyState,
  ErrorState,
  PageHeader,
  PrimaryButton,
  SearchBar,
  SoftButton,
  StatusBadge,
} from "./ui";
import type { AdminSchool } from "../_lib/types";

export function SchoolsTab({
  schools,
  loading,
  error,
  search,
  onSearchChange,
  onRetry,
  onAddSchool,
  onEditSchool,
  onDisableSchool,
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
  onDisableSchool: (school: AdminSchool) => void;
  busySchoolId: string | null;
}) {
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
          <SoftButton disabled title="قريبًا">
            <Settings className="h-4 w-4" />
            {loading ? "جارٍ تحميل المدارس..." : "إعدادات المدارس · قريبًا"}
          </SoftButton>
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
              {schools.map((school) => (
                <tr key={school.id} className="transition hover:bg-slate-50/70">
                  <td className="px-5 py-4 font-extrabold text-brand-navy">{school.name}</td>
                  <td className="px-5 py-4 font-bold text-slate-500">{school.city}</td>
                  <td className="px-5 py-4 font-bold text-slate-500">{school.principal}</td>
                  <td className="px-5 py-4 font-bold text-slate-500">{school.teachers}</td>
                  <td className="px-5 py-4 font-bold text-slate-500">{formatNumber(school.students)}</td>
                  <td className="px-5 py-4 font-extrabold text-brand">{school.score}</td>
                  <td className="px-5 py-4"><StatusBadge status={school.status} /></td>
                  <td className="px-5 py-4">
                    <ActionDropdown
                      label={school.name}
                      onEdit={() => onEditSchool(school)}
                      onDisable={() => onDisableSchool(school)}
                      disabled={busySchoolId === school.id}
                      actionLabel="إيقاف المدرسة"
                    />
                  </td>
                </tr>
              ))}
              {!loading && schools.length === 0 && (
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
