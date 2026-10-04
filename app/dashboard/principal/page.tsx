"use client";

import { BrandLogo } from "@/components/brand-logo";
import { supabase } from "@/lib/supabase";
import { DashboardTab } from "./_components/dashboard-tab";
import { ImpactTab } from "./_components/impact-tab";
import { InviteTeacherModal } from "./_components/invite-teacher-modal";
import { PeriodicReportsTab } from "./_components/periodic-reports-tab";
import { TABS } from "./_lib/tabs";
import { TeachersTab } from "./_components/teachers-tab";
import { usePrincipalDashboard } from "./_lib/use-principal-dashboard";

export default function PrincipalDashboard() {
  const d = usePrincipalDashboard();
  const {
    router,
    activeTab,
    setActiveTab,
    loading,
    report,
    loadError,
    inviteOpen,
    setInviteOpen,
    loadReport,
  } = d;

  return (
    <div className="min-h-screen bg-[#f7fafc] text-brand-navy" dir="rtl">
      <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-5 sm:py-4 lg:px-8">
          <BrandLogo
            size="sm"
            contextTitle="لوحة مدير المدرسة"
            contextSubtitle={report?.school?.name ?? "جارٍ تحميل المدرسة"}
          />
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <button
              onClick={() => setInviteOpen(true)}
              className="rounded-xl bg-brand px-3 py-2 text-xs font-extrabold sm:px-4 sm:text-sm text-white transition hover:bg-brand-dark"
            >
              إضافة معلم
            </button>
            <button
              onClick={async () => { await supabase.auth.signOut(); router.push("/login"); }}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-extrabold sm:px-4 sm:text-sm text-slate-500 transition hover:border-brand/40 hover:text-brand"
            >
              خروج
            </button>
          </div>
        </div>

        <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-4 pb-3 sm:px-5 lg:px-8">
          {TABS.map((tab, i) => (
            <button
              key={tab}
              onClick={() => setActiveTab(i)}
              className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-extrabold transition-all ${
                activeTab === i
                  ? "bg-brand text-white shadow-[0_10px_24px_rgba(21,159,145,0.12)]"
                  : "bg-slate-50 text-slate-500 hover:text-brand-navy"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </header>

      {inviteOpen && <InviteTeacherModal d={d} />}

      <main className="mx-auto max-w-7xl px-4 py-5 sm:px-5 sm:py-8 lg:px-8">
        {loading && (
          <div className="mb-6 rounded-[1.5rem] border border-slate-100 bg-white p-6 text-center text-sm font-extrabold text-slate-500 shadow-[0_10px_34px_rgba(15,35,55,0.035)]">
            جارٍ تحميل لوحة المدرسة...
          </div>
        )}

        {loadError && !loading && (
          <div className="rounded-[1.5rem] border border-red-100 bg-red-50 p-5 text-red-700">
            <p className="font-black">تعذر تحميل البيانات</p>
            <p className="mt-1 text-sm font-bold">{loadError}</p>
            <button onClick={loadReport} className="mt-4 rounded-xl bg-brand px-3 py-2 text-xs font-extrabold sm:px-4 sm:text-sm text-white">إعادة المحاولة</button>
          </div>
        )}

        {!loading && !loadError && report && activeTab === 0 && <DashboardTab d={d} />}

        {!loading && !loadError && report && activeTab === 1 && <TeachersTab d={d} />}

        {!loading && !loadError && report && activeTab === 2 && <ImpactTab d={d} />}

        {!loading && !loadError && report && activeTab === 3 && <PeriodicReportsTab d={d} />}
      </main>
    </div>
  );
}
