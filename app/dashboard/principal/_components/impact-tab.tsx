"use client";

import { toEnglishDigits } from "@/lib/format";
import { EmptyState } from "./ui";
import type { PrincipalDashboardState } from "../_lib/use-principal-dashboard";
import { StudentProfileLink } from "@/components/student-profile/student-profile-link";

export function ImpactTab({ d }: { d: PrincipalDashboardState }) {
  const { report } = d;
  if (!report) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-black text-brand-navy">الطلاب والمهارات</h3>
          <p className="mt-1 text-sm font-bold text-slate-400">اضغط اسم الطالب لعرض ملفه الكامل.</p>
        </div>
        <button onClick={() => window.print()} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-extrabold text-slate-500">طباعة</button>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-[1.5rem] border border-slate-100 bg-white p-6 shadow-[0_10px_34px_rgba(15,35,55,0.035)]">
          <h3 className="mb-4 font-black text-brand-navy">المهارات الأضعف</h3>
          {report.weakSkills.length ? report.weakSkills.map((item) => (
            <div key={item.skill} className="mb-4">
              <div className="mb-1 flex justify-between text-sm font-bold">
                <span>{item.skill}</span>
                <span className="text-warning">{toEnglishDigits(item.average)}%</span>
              </div>
              <div className="h-2.5 rounded-full bg-slate-100"><div className="h-2.5 rounded-full bg-warning" style={{ width: `${item.average}%` }} /></div>
            </div>
          )) : <EmptyState>لا توجد نتائج كافية لاستخراج المهارات الأضعف</EmptyState>}
        </div>

        <div className="rounded-[1.5rem] border border-slate-100 bg-white p-6 shadow-[0_10px_34px_rgba(15,35,55,0.035)]">
          <h3 className="mb-4 font-black text-brand-navy">طلاب يحتاجون دعمًا (دون 50%)</h3>
          {report.atRiskStudents.length ? report.atRiskStudents.map((student) => (
            <div key={student.id} className="mb-3 rounded-xl border border-red-100 bg-red-50/60 p-3">
              <div className="font-bold text-brand-navy"><StudentProfileLink studentId={student.id} name={student.name} /></div>
              <div className="mt-1 text-xs font-bold text-red-500">{student.className} — {toEnglishDigits(student.percentage)}%</div>
            </div>
          )) : <EmptyState>لا يوجد طلاب متعثرون حسب البيانات الحالية</EmptyState>}
        </div>
      </div>
    </div>
  );
}
