"use client";

import { toEnglishDigits } from "@/lib/format";
import { EmptyState, KpiCard, formatPct } from "./ui";
import type { PrincipalDashboardState } from "../_lib/use-principal-dashboard";
import { StudentProfileLink } from "@/components/student-profile/student-profile-link";

export function ImpactTab({ d }: { d: PrincipalDashboardState }) {
  const { report } = d;
  if (!report) return null;

  return (
    <div className="space-y-6">
      <div className="rounded-[1.5rem] border border-slate-100 bg-white p-6 shadow-[0_10px_34px_rgba(15,35,55,0.035)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-black text-brand-navy">أثر دالة</h3>
            <p className="mt-1 text-sm font-bold text-slate-400">تقرير مبدئي مبني على بيانات المدرسة الحالية</p>
          </div>
          <button onClick={() => window.print()} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-extrabold text-slate-500">طباعة التقرير</button>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <KpiCard label="مؤشر التحسن" value={report.improvement.value === null ? "—" : `${toEnglishDigits(report.improvement.value)}%`} sub={toEnglishDigits(report.improvement.label)} icon="📈" />
          <KpiCard label="تفاعل المعلمين" value={formatPct(report.teacherEngagement.rate)} sub={toEnglishDigits(`${report.teacherEngagement.activeTeachers}/${report.teacherEngagement.totalTeachers}`)} icon="🧭" />
          <KpiCard label="متوسط المدرسة" value={formatPct(report.kpis.performanceAverage)} sub="نتائج محفوظة" icon="🎯" />
        </div>
        {report.notes.length > 0 && (
          <div className="mt-5 rounded-xl bg-slate-50 p-4 text-sm font-bold leading-7 text-slate-500">
            {report.notes.map((note) => <p key={note}>• {toEnglishDigits(note)}</p>)}
          </div>
        )}
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
          <h3 className="mb-4 font-black text-brand-navy">الطلاب الذين يحتاجون تدخلًا</h3>
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
