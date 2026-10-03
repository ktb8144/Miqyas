"use client";

import { EmptyState, TeacherCard } from "./ui";
import type { PrincipalDashboardState } from "../_lib/use-principal-dashboard";

export function TeachersTab({ d }: { d: PrincipalDashboardState }) {
  const { report, resendInvite } = d;
  if (!report) return null;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h3 className="font-bold text-gray-900">تقرير أداء المعلمين</h3>
        <p className="text-sm text-gray-500">مبني على الفصول والطلاب والنتائج المحفوظة</p>
      </div>
      {report.teachers.length ? report.teachers.map((teacher) => <TeacherCard key={teacher.id} teacher={teacher} onResendInvite={resendInvite} />) : <EmptyState>لم تتم إضافة معلمين بعد</EmptyState>}
    </div>
  );
}
