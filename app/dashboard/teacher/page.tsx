"use client";

import Link from "next/link";
import { FolderCheck } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { supabase } from "@/lib/supabase";
import { AddClassModal } from "./_components/add-class-modal";
import { ClassesView } from "./_components/classes-view";
import { PackageResultsModal } from "./_components/package-results-modal";
import { PackageScanModal } from "./_components/package-scan-modal";
import { PackagesView } from "./_components/packages-view";
import { ReportModal } from "./_components/report-modal";
import { StudentsView } from "./_components/students-view";
import { WeeklyPlansView } from "./_components/weekly-plans-view";
import { useTeacherDashboard } from "./_lib/use-teacher-dashboard";
import { PlanBanner, useAccountPlan } from "@/components/plan/plan-banner";

export default function TeacherDashboard() {
  const d = useTeacherDashboard();
  const account = useAccountPlan();
  const {
    router,
    view,
    showAddClass,
    setShowAddClass,
    pageLoading,
    pageError,
    activePackageAssignment,
    packageResultsAssignment,
    reportOpen,
    setReportOpen,
    report,
    reportLoading,
    reportError,
    activeClass,
    teacherSubtitle,
    loadTeacherData,
    handleAddClass,
  } = d;

  return (
    <div className="min-h-screen bg-[#f7fafc] text-brand-navy" dir="rtl">
      {reportOpen && (
        <ReportModal report={report} loading={reportLoading} error={reportError} onClose={() => setReportOpen(false)} />
      )}

      {activePackageAssignment && <PackageScanModal d={d} />}

      {packageResultsAssignment && <PackageResultsModal d={d} />}

      {showAddClass && (
        <AddClassModal
          onClose={() => setShowAddClass(false)}
          onAdd={handleAddClass}
        />
      )}

      {/* ── Header ─────────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-5 sm:py-4 lg:px-8">
          <BrandLogo
            size="sm"
            contextTitle="لوحة المعلم"
            contextSubtitle={teacherSubtitle}
          />
          <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/dashboard/teacher/evidence"
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-3 py-2 text-xs font-extrabold sm:px-4 sm:text-sm text-white transition hover:bg-brand-dark"
          >
            <FolderCheck className="h-4 w-4" />
            ملف الشواهد
          </Link>
          <button
            onClick={async () => { await supabase.auth.signOut(); router.push("/login"); }}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-extrabold sm:px-4 sm:text-sm text-slate-500 transition hover:border-brand/40 hover:text-brand"
          >
            خروج
          </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-5 sm:space-y-8 sm:px-5 sm:py-8 lg:px-8">
        <PlanBanner plan={account?.plan} />
        {pageLoading && (
          <div className="rounded-[1.5rem] border border-slate-100 bg-white p-8 text-center font-bold text-slate-500 shadow-[0_10px_34px_rgba(15,35,55,0.035)]">
            جارٍ تحميل الفصول والطلاب...
          </div>
        )}

        {pageError && !pageLoading && (
          <div className="rounded-[1.5rem] border border-red-100 bg-red-50 p-5 text-red-700">
            <p className="font-black">تعذر تحميل البيانات</p>
            <p className="mt-1 text-sm font-bold">{pageError}</p>
            <button
              onClick={loadTeacherData}
              className="mt-4 rounded-xl bg-brand px-3 py-2 text-xs font-extrabold sm:px-4 sm:text-sm text-white"
            >
              إعادة المحاولة
            </button>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            VIEW: CLASSES LIST
        ══════════════════════════════════════════════════════════════════════ */}
        {view === "classes" && !pageLoading && !pageError && <ClassesView d={d} />}

        {/* ══════════════════════════════════════════════════════════════════════
            VIEW: MIQYAS PACKAGES
        ══════════════════════════════════════════════════════════════════════ */}
        {view === "packages" && !pageLoading && !pageError && <PackagesView d={d} />}

        {/* ══════════════════════════════════════════════════════════════════════
            VIEW: WEEKLY PLANS
        ══════════════════════════════════════════════════════════════════════ */}
        {view === "weeklyPlans" && !pageLoading && !pageError && <WeeklyPlansView d={d} />}

        {/* ══════════════════════════════════════════════════════════════════════
            VIEW: STUDENT LIST
        ══════════════════════════════════════════════════════════════════════ */}
        {view === "students" && activeClass && !pageLoading && !pageError && <StudentsView d={d} />}
      </main>
    </div>
  );
}
