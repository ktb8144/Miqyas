"use client";

import { useEffect, useState } from "react";
import { BatchOMRScanner, type ClassSheetInfo } from "@/components/batch-omr-scanner";
import { toEnglishDigits } from "@/lib/format";
import { fetchSheetMaster } from "@/lib/omr/sheet-master";
import type { TeacherDashboardState } from "../_lib/use-teacher-dashboard";

type SheetState = { status: "loading" } | { status: "ready"; sheet: ClassSheetInfo | null } | { status: "error"; message: string };

/**
 * Which sheet the scanner should read: a Dala master question sheet (its own layout + class QR check),
 * or, for ordinary question PDFs, the standard answer sheet (sheet = null).
 */
function useClassSheet(assignmentId: string | null, pdfUrl: string | null) {
  const [state, setState] = useState<SheetState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!assignmentId) return;
    let active = true;
    setState({ status: "loading" });
    (async () => {
      try {
        const res = await fetch(`/api/teacher/class-package-assignments/${assignmentId}/answer-sheet`, { cache: "no-store" });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json.success) throw new Error(json.error || "تعذّر تجهيز التصحيح");
        const data = json.data as {
          questionsPdfUrl: string | null;
          sheetCode: string | null;
          classCodes?: Array<{ code: string; className: string }>;
        };
        const hasPdf = Boolean(data.questionsPdfUrl ?? pdfUrl);
        const master = hasPdf ? (await fetchSheetMaster(`/api/teacher/class-package-assignments/${assignmentId}/questions-pdf`)).master : null;
        if (!active) return;
        setState({
          status: "ready",
          sheet: master
            ? { template: master.template, printedQr: master.template.printedQr, expectedCode: data.sheetCode, classes: data.classCodes ?? [] }
            : null,
        });
      } catch (err) {
        if (active) setState({ status: "error", message: err instanceof Error ? err.message : "تعذّر تحميل ورقة الأسئلة" });
      }
    })();
    return () => { active = false; };
  }, [assignmentId, pdfUrl, attempt]);

  return { state, retry: () => setAttempt((n) => n + 1) };
}

export function PackageScanModal({ d }: { d: TeacherDashboardState }) {
  const {
    activePackageAssignment,
    setActivePackageAssignment,
    activePackageStudents,
    handlePackageScanComplete,
  } = d;
  const { state: sheetState, retry } = useClassSheet(activePackageAssignment?.id ?? null, activePackageAssignment?.studentPdfUrl ?? null);
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
          {!activePackageStudents.length ? (
            <div className="rounded-[1.25rem] border border-dashed border-teal-100 bg-teal-50/40 p-8 text-center">
              <h3 className="text-xl font-black text-brand-navy">أضف طلابًا لهذا الفصل قبل بدء التصحيح.</h3>
              <p className="mt-2 text-sm font-bold text-slate-400">يعتمد حفظ النتائج على ربط كل ورقة بطالب محفوظ في الفصل.</p>
            </div>
          ) : sheetState.status === "loading" ? (
            <p className="py-10 text-center text-sm font-bold text-slate-400">جارٍ تجهيز التصحيح...</p>
          ) : sheetState.status === "error" ? (
            <div className="rounded-[1.25rem] border border-red-100 bg-red-50 p-6 text-center">
              <p className="text-sm font-bold text-red-700">{sheetState.message}</p>
              <button onClick={retry} className="mt-3 rounded-xl bg-brand px-4 py-2 text-xs font-extrabold text-white">
                إعادة المحاولة
              </button>
            </div>
          ) : (
            <BatchOMRScanner
              classPackageAssignmentId={activePackageAssignment.id}
              questionCount={activePackageAssignment.questionCount}
              sheetSeed={activePackageAssignment.packageId}
              sheet={sheetState.sheet}
              totalStudents={activePackageStudents.length}
              onComplete={handlePackageScanComplete}
              students={activePackageStudents.map((student) => ({ id: student.id, name: student.name, studentCode: student.studentCode }))}
            />
          )}
        </div>
      </div>
    </div>
  );
}
