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
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/50 sm:items-center sm:p-4" dir="rtl">
      <div className="h-full w-full overflow-y-auto bg-white shadow-2xl sm:h-auto sm:max-h-[92vh] sm:max-w-2xl sm:rounded-[1.5rem]">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-100 bg-white px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <h2 className="truncate text-base font-black text-brand-navy sm:text-lg">{activePackageAssignment.packageTitle}</h2>
            <p className="truncate text-xs font-bold text-slate-400">
              تصحيح · {activePackageAssignment.className} · {toEnglishDigits(activePackageStudents.length)} طالب
            </p>
          </div>
          <button
            onClick={() => setActivePackageAssignment(null)}
            aria-label="إغلاق"
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-slate-200 text-xl text-slate-500 transition hover:border-brand/40 hover:text-brand"
          >
            ×
          </button>
        </div>
        <div className="p-4 sm:p-5">
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
