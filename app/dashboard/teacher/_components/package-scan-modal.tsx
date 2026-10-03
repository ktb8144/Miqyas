"use client";

import { BatchOMRScanner } from "@/components/batch-omr-scanner";
import { toEnglishDigits } from "@/lib/format";
import type { TeacherDashboardState } from "../_lib/use-teacher-dashboard";

export function PackageScanModal({ d }: { d: TeacherDashboardState }) {
  const {
    activePackageAssignment,
    setActivePackageAssignment,
    activePackageStudents,
    handlePackageScanComplete,
  } = d;
  if (!activePackageAssignment) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" dir="rtl">
      <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-[1.5rem] bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white p-5">
          <div>
            <p className="text-sm font-extrabold text-brand">تصحيح اختبار دالا</p>
            <h2 className="mt-1 text-xl font-black text-brand-navy">{activePackageAssignment.packageTitle}</h2>
            <p className="mt-1 text-sm font-bold text-slate-400">
              {activePackageAssignment.className} | {toEnglishDigits(activePackageStudents.length)} طالب
            </p>
          </div>
          <button
            onClick={() => setActivePackageAssignment(null)}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-extrabold text-slate-500 transition hover:border-brand/40 hover:text-brand"
          >
            إغلاق
          </button>
        </div>
        <div className="p-5">
          {activePackageStudents.length ? (
            <BatchOMRScanner
              classPackageAssignmentId={activePackageAssignment.id}
              totalStudents={activePackageStudents.length}
              onComplete={handlePackageScanComplete}
              students={activePackageStudents.map((student) => ({ id: student.id, name: student.name, studentCode: student.studentCode }))}
            />
          ) : (
            <div className="rounded-[1.25rem] border border-dashed border-teal-100 bg-teal-50/40 p-8 text-center">
              <h3 className="text-xl font-black text-brand-navy">أضف طلابًا لهذا الفصل قبل بدء التصحيح.</h3>
              <p className="mt-2 text-sm font-bold text-slate-400">يعتمد حفظ النتائج على ربط كل ورقة بطالب محفوظ في الفصل.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
