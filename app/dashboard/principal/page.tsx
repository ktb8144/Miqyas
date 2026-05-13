"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";
import { supabase } from "@/lib/supabase";
import { formatSchoolDateRange, toEnglishDigits } from "@/lib/format";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const TABS = ["لوحة القيادة", "أثر مقياس", "أداء المعلمين", "التنبيهات", "التحسن"];

type PrincipalReport = {
  school: { id: string; name: string; city?: string | null };
  kpis: {
    teachersCount: number;
    classesCount: number;
    studentsCount: number;
    assessmentsCount: number;
    performanceAverage: number | null;
    atRiskCount: number;
    implementationRate: number | null;
  };
  improvement: { value: number | null; label: string; note?: string };
  readinessIndex: { value: number | null; label: string; formula: string };
  weakSkills: { skill: string; average: number; count: number }[];
  atRiskStudents: { id: string; name: string; className: string; percentage: number }[];
  teacherEngagement: { activeTeachers: number; totalTeachers: number; rate: number | null };
  weeklyPlanSummary: {
    source: "current_week" | "upcoming" | "none";
    weekNumber: number | null;
    startDate: string | null;
    endDate: string | null;
    startHijri: string | null;
    endHijri: string | null;
    targetGrades: number[];
    targetSubjects: string[];
    activePlansCount: number;
    matchingClassesCount: number;
    classesWithoutPlans: number;
    unsupportedClassesCount: number;
    plans: {
      id: string;
      weekNumber: number;
      grade: number;
      gradeLabel: string;
      subject: string;
      skill: string;
      difficultyLevel: string;
    }[];
  };
  teachers: { id: string; name: string; email: string; phone?: string | null; subject: string; status: string; classNames?: string[]; classesCount: number; studentsCount: number; average: number | null; active: boolean }[];
  classes: { id: string; name: string; grade: number | null; subject: string; studentsCount: number; average: number | null }[];
  alerts: { type: string; title: string; detail: string }[];
  notes: string[];
};

type PrincipalPackageSummary = {
  packageId: string;
  title: string;
  subject: string;
  grade: number | null;
  weekNumber: number | null;
  classesAssigned: number;
  classesScanned: number;
  studentsTested: number;
  averagePercentage: number | null;
  weakestDomains: Array<{ name: string; wrong: number; total: number }>;
  weakestSkills: Array<{ name: string; wrong: number; total: number }>;
};

type PrincipalParentStats = {
  totalLinks: number;
  openedReports: number;
  openRate: number | null;
  missionClicks: number;
  completedMissions: number;
  subscriptionInterestCount: number;
  unopenedLinks: number;
  topInterestedSkill: { skillName: string; count: number } | null;
};

function formatNumber(value: number) {
  return toEnglishDigits(new Intl.NumberFormat("en-US").format(value));
}

function formatPct(value: number | null) {
  return value === null ? "لا توجد بيانات" : `${toEnglishDigits(value)}%`;
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-6 text-center text-sm font-bold text-slate-400">
      {children}
    </div>
  );
}

function KpiCard({ label, value, sub, icon, color = "#159f91" }: { label: string; value: string; sub: string; icon: string; color?: string }) {
  return (
    <div className="rounded-[1.5rem] border border-slate-100 bg-white p-5 shadow-[0_10px_34px_rgba(15,35,55,0.035)]">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-2xl">{icon}</span>
        <span className="text-xs font-bold text-slate-400">{sub}</span>
      </div>
      <div className="mb-1 text-3xl font-black" style={{ color }}>{value}</div>
      <div className="text-sm font-bold text-slate-500">{label}</div>
    </div>
  );
}

function difficultyLabel(value: string) {
  const labels: Record<string, string> = {
    easy: "سهل",
    medium: "متوسط",
    hard: "متقدم",
    nafs_simulation: "محاكاة نافس",
  };
  return labels[value] ?? value;
}

function TeacherCard({ teacher }: { teacher: PrincipalReport["teachers"][number] }) {
  const badge = teacher.average === null
    ? { label: "لا توجد نتائج", color: "#64748b", bg: "#f8fafc" }
    : teacher.average >= 85
      ? { label: "ممتاز", color: "#1D9E75", bg: "#f0fdf8" }
      : teacher.average >= 70
        ? { label: "جيد", color: "#BA7517", bg: "#fffbeb" }
        : { label: "يحتاج دعم", color: "#E24B4A", bg: "#fff5f5" };

  const kpis = [
    { label: "الحالة", value: teacher.status === "invited" ? "دعوة" : "نشط", good: teacher.status !== "disabled" },
    { label: "الفصول", value: formatNumber(teacher.classesCount), good: teacher.classesCount > 0 },
    { label: "الطلاب", value: formatNumber(teacher.studentsCount), good: teacher.studentsCount > 0 },
    { label: "المتوسط", value: formatPct(teacher.average), good: (teacher.average ?? 0) >= 70 },
    { label: "النشاط", value: teacher.active ? "نشط" : "بحاجة تفعيل", good: teacher.active },
  ];

  return (
    <div className="rounded-[1.5rem] border border-slate-100 bg-white p-5 shadow-[0_10px_34px_rgba(15,35,55,0.035)]">
      <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="font-black text-[#0b2447]">{teacher.name}</div>
          <div className="text-sm font-bold text-slate-400">{teacher.subject} · {teacher.phone ?? "لا يوجد جوال"}</div>
          {teacher.classNames?.length ? (
            <div className="mt-1 text-xs font-bold text-slate-400">{teacher.classNames.join("، ")}</div>
          ) : null}
        </div>
        <span className="rounded-full px-3 py-1 text-sm font-bold" style={{ color: badge.color, background: badge.bg }}>
          {badge.label}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="rounded-xl bg-slate-50/80 p-2 text-center">
            <div className={`text-sm font-bold ${kpi.good ? "text-green-600" : "text-red-500"}`}>{kpi.value}</div>
            <div className="mt-0.5 text-xs font-bold text-slate-400">{kpi.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PrincipalDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<PrincipalReport | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [invitePhone, setInvitePhone] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteSubject, setInviteSubject] = useState("");
  const [inviteGrades, setInviteGrades] = useState<string[]>([]);
  const [inviteClassIds, setInviteClassIds] = useState<string[]>([]);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteMessage, setInviteMessage] = useState<string | null>(null);
  const [packageSummaries, setPackageSummaries] = useState<PrincipalPackageSummary[]>([]);
  const [packagesLoading, setPackagesLoading] = useState(false);
  const [packagesError, setPackagesError] = useState<string | null>(null);
  const [parentStats, setParentStats] = useState<PrincipalParentStats | null>(null);
  const [parentStatsLoading, setParentStatsLoading] = useState(false);
  const [parentStatsError, setParentStatsError] = useState<string | null>(null);

  const chartData = useMemo(() => {
    if (!report) return [];
    return report.classes.map((classItem) => ({
      name: classItem.name,
      avg: classItem.average ?? 0,
      students: classItem.studentsCount,
    }));
  }, [report]);

  const loadReport = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.replace("/login");
      return;
    }

    try {
      const res = await fetch("/api/principal/school-report", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "تعذر تحميل لوحة المدرسة");
      setReport(json.data);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "تعذر تحميل لوحة المدرسة");
    } finally {
      setLoading(false);
    }
  }, [router]);

  const loadPackageSummaries = useCallback(async () => {
    setPackagesLoading(true);
    setPackagesError(null);
    try {
      const res = await fetch("/api/principal/package-results", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "تعذر تحميل اختبارات مقياس");
      setPackageSummaries(json.data ?? []);
    } catch (err) {
      setPackagesError(err instanceof Error ? err.message : "تعذر تحميل اختبارات مقياس");
    } finally {
      setPackagesLoading(false);
    }
  }, []);

  const loadParentStats = useCallback(async () => {
    setParentStatsLoading(true);
    setParentStatsError(null);
    try {
      const res = await fetch(`/api/principal/parent-report-stats?t=${Date.now()}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-store" },
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "تعذر تحميل تفاعل أولياء الأمور");
      setParentStats(json.data);
    } catch (err) {
      setParentStatsError(err instanceof Error ? err.message : "تعذر تحميل تفاعل أولياء الأمور");
    } finally {
      setParentStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  useEffect(() => {
    void loadPackageSummaries();
    void loadParentStats();
  }, [loadPackageSummaries, loadParentStats]);

  const normalizeSaudiMobile = (value: string) => {
    const digits = toEnglishDigits(value).replace(/\D/g, "");
    if (digits.startsWith("9665") && digits.length === 12) return `0${digits.slice(3)}`;
    if (digits.startsWith("5") && digits.length === 9) return `0${digits}`;
    return digits;
  };

  const inviteTeacher = async (event: React.FormEvent) => {
    event.preventDefault();
    setInviteLoading(true);
    setInviteMessage(null);
    try {
      const normalizedPhone = normalizeSaudiMobile(invitePhone);
      if (!/^05\d{8}$/.test(normalizedPhone)) {
        throw new Error("يرجى إدخال رقم الجوال بصيغة 05xxxxxxxx");
      }
      if (!inviteEmail.trim()) {
        throw new Error("البريد مطلوب مؤقتًا لإنشاء حساب الدخول عبر Supabase Auth.");
      }
      const res = await fetch("/api/users/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: inviteName,
          email: inviteEmail,
          role: "teacher",
          subject: inviteSubject || null,
          phone: normalizedPhone,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "تعذر إرسال الدعوة");
      if (inviteClassIds.length && json.user?.id) {
        const { error: assignError } = await supabase
          .from("classes")
          .update({ teacher_id: json.user.id })
          .in("id", inviteClassIds);
        if (assignError) throw assignError;
      }
      setInviteMessage("تم إرسال الدعوة بنجاح");
      setInviteName("");
      setInvitePhone("");
      setInviteEmail("");
      setInviteSubject("");
      setInviteGrades([]);
      setInviteClassIds([]);
      setInviteOpen(false);
      await loadReport();
    } catch (err) {
      setInviteMessage(err instanceof Error ? err.message : "تعذر إرسال الدعوة");
    } finally {
      setInviteLoading(false);
    }
  };

  const executedClassesCount = packageSummaries.reduce((sum, item) => sum + item.classesScanned, 0);
  const measuredStudentsCount = packageSummaries.reduce((sum, item) => sum + item.studentsTested, 0);
  const criticalSkillsCount = report?.weakSkills.length ?? 0;

  return (
    <div className="min-h-screen bg-[#f7fafc] text-[#0b2447]" dir="rtl">
      <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
          <BrandLogo
            size="sm"
            contextTitle="لوحة مدير المدرسة"
            contextSubtitle={report?.school?.name ?? "جارٍ تحميل المدرسة"}
          />
          <div className="flex items-center gap-3">
            <button
              onClick={() => setInviteOpen(true)}
              className="rounded-xl bg-[#159f91] px-4 py-2 text-sm font-extrabold text-white transition hover:bg-[#10877b]"
            >
              إضافة معلم
            </button>
            <button
              onClick={async () => { await supabase.auth.signOut(); router.push("/login"); }}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-extrabold text-slate-500 transition hover:border-[#159f91]/40 hover:text-[#159f91]"
            >
              خروج
            </button>
          </div>
        </div>

        <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-5 pb-3 lg:px-8">
          {TABS.map((tab, i) => (
            <button
              key={tab}
              onClick={() => setActiveTab(i)}
              className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-extrabold transition-all ${
                activeTab === i
                  ? "bg-[#159f91] text-white shadow-[0_10px_24px_rgba(21,159,145,0.12)]"
                  : "bg-slate-50 text-slate-500 hover:text-[#0b2447]"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </header>

      {inviteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form onSubmit={inviteTeacher} className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-[1.5rem] bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-black text-[#0b2447]">إضافة معلم</h2>
              <button type="button" onClick={() => setInviteOpen(false)} className="text-2xl text-slate-300">×</button>
            </div>
            {inviteMessage && (
              <div className="mb-4 rounded-xl border border-teal-100 bg-teal-50 px-4 py-3 text-sm font-bold text-[#159f91]">
                {inviteMessage}
              </div>
            )}
            <div className="space-y-3">
              <input required value={inviteName} onChange={(event) => setInviteName(event.target.value)} placeholder="اسم المعلم" className="w-full rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:bg-white" />
              <input required value={invitePhone} onChange={(event) => setInvitePhone(event.target.value)} placeholder="رقم الجوال/واتساب 05xxxxxxxx" className="w-full rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:bg-white" />
              <select value={inviteSubject} onChange={(event) => setInviteSubject(event.target.value)} className="w-full rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:bg-white">
                <option value="">اختر المادة</option>
                <option value="رياضيات">رياضيات</option>
                <option value="قراءة">قراءة</option>
                <option value="علوم">علوم</option>
                <option value="أخرى">أخرى</option>
              </select>
              <div className="rounded-xl bg-slate-50 p-3">
                <div className="mb-2 text-xs font-black text-slate-500">الصفوف التي يدرسها</div>
                <div className="grid grid-cols-2 gap-2">
                  {["الثالث", "الرابع", "الخامس", "السادس"].map((grade) => (
                    <label key={grade} className="flex items-center gap-2 text-sm font-bold text-slate-600">
                      <input
                        type="checkbox"
                        checked={inviteGrades.includes(grade)}
                        onChange={() => setInviteGrades((prev) => prev.includes(grade) ? prev.filter((item) => item !== grade) : [...prev, grade])}
                        className="accent-[#159f91]"
                      />
                      {grade}
                    </label>
                  ))}
                </div>
              </div>
              {report?.classes.length ? (
                <div className="rounded-xl bg-slate-50 p-3">
                  <div className="mb-2 text-xs font-black text-slate-500">الفصول المسندة</div>
                  <div className="max-h-36 space-y-2 overflow-y-auto">
                    {report.classes.map((classItem) => (
                      <label key={classItem.id} className="flex items-center gap-2 text-sm font-bold text-slate-600">
                        <input
                          type="checkbox"
                          checked={inviteClassIds.includes(classItem.id)}
                          onChange={() => setInviteClassIds((prev) => prev.includes(classItem.id) ? prev.filter((item) => item !== classItem.id) : [...prev, classItem.id])}
                          className="accent-[#159f91]"
                        />
                        {classItem.name} · {classItem.subject}
                      </label>
                    ))}
                  </div>
                </div>
              ) : null}
              <input type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="البريد الإلكتروني لإنشاء حساب الدخول" className="w-full rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:bg-white" />
              <p className="rounded-xl bg-amber-50 px-4 py-3 text-xs font-bold leading-6 text-amber-700">
                البريد مطلوب مؤقتًا لإنشاء حساب الدخول عبر Supabase Auth، والجوال هو المعلومة الأساسية للمدرسة.
              </p>
              <button disabled={inviteLoading} className="w-full rounded-xl bg-[#159f91] py-3 text-sm font-extrabold text-white disabled:opacity-60">
                {inviteLoading ? "جارٍ إرسال الدعوة..." : "إرسال دعوة"}
              </button>
            </div>
          </form>
        </div>
      )}

      <main className="mx-auto max-w-7xl px-5 py-8 lg:px-8">
        {loading && (
          <div className="mb-6 rounded-[1.5rem] border border-slate-100 bg-white p-6 text-center text-sm font-extrabold text-slate-500 shadow-[0_10px_34px_rgba(15,35,55,0.035)]">
            جارٍ تحميل لوحة المدرسة...
          </div>
        )}

        {loadError && !loading && (
          <div className="rounded-[1.5rem] border border-red-100 bg-red-50 p-5 text-red-700">
            <p className="font-black">تعذر تحميل البيانات</p>
            <p className="mt-1 text-sm font-bold">{loadError}</p>
            <button onClick={loadReport} className="mt-4 rounded-xl bg-[#159f91] px-4 py-2 text-sm font-extrabold text-white">إعادة المحاولة</button>
          </div>
        )}

        {!loading && !loadError && report && activeTab === 0 && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
              <KpiCard label="جاهزية مقياس" value={report.readinessIndex.value === null ? "—" : `${toEnglishDigits(report.readinessIndex.value)}%`} sub="مؤشر عام" icon="📊" />
              <KpiCard label="الفصول المنفذة" value={formatNumber(executedClassesCount)} sub="اختبارات مصححة" icon="✅" />
              <KpiCard label="الطلاب المقاسون" value={formatNumber(measuredStudentsCount)} sub="نتائج محفوظة" icon="👥" />
              <KpiCard label="المهارات الحرجة" value={formatNumber(criticalSkillsCount)} sub="تحتاج متابعة" icon="⚠️" color="#E24B4A" />
              <KpiCard label="تفاعل أولياء الأمور" value={parentStats ? formatNumber(parentStats.openedReports) : "—"} sub="تقارير مفتوحة" icon="💬" />
            </div>

            <div className="rounded-[1.5rem] border border-teal-100 bg-white p-6 shadow-[0_10px_34px_rgba(15,35,55,0.035)]">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-extrabold text-[#159f91]">خطة مقياس</p>
                  <h3 className="mt-1 text-xl font-black text-[#0b2447]">
                    {report.weeklyPlanSummary.source === "current_week" ? "خطة هذا الأسبوع" : report.weeklyPlanSummary.source === "upcoming" ? "أقرب خطة قادمة" : "لا توجد خطة مفعّلة"}
                  </h3>
                  {report.weeklyPlanSummary.weekNumber ? (
                    <p className="mt-2 text-sm font-bold leading-7 text-slate-500">
                      الأسبوع {toEnglishDigits(report.weeklyPlanSummary.weekNumber)}: {formatSchoolDateRange({
                        startDate: report.weeklyPlanSummary.startDate,
                        endDate: report.weeklyPlanSummary.endDate,
                        startHijri: report.weeklyPlanSummary.startHijri,
                        endHijri: report.weeklyPlanSummary.endHijri,
                      })}
                    </p>
                  ) : (
                    <p className="mt-2 text-sm font-bold text-slate-400">أضف الخطط الأسبوعية من إدارة النظام لتظهر هنا.</p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-teal-50 px-3 py-1 text-sm font-bold text-[#159f91]">
                    الصفوف {report.weeklyPlanSummary.targetGrades.map((grade) => toEnglishDigits(grade)).join("، ")}
                  </span>
                  <span className="rounded-full bg-slate-50 px-3 py-1 text-sm font-bold text-slate-500">
                    {report.weeklyPlanSummary.targetSubjects.join("، ")}
                  </span>
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-4">
                <div className="rounded-xl bg-slate-50 p-4">
                  <div className="text-2xl font-black text-[#0b2447]">{toEnglishDigits(report.weeklyPlanSummary.activePlansCount)}</div>
                  <div className="mt-1 text-xs font-bold text-slate-400">خطط نشطة</div>
                </div>
                <div className="rounded-xl bg-slate-50 p-4">
                  <div className="text-2xl font-black text-[#159f91]">{toEnglishDigits(report.weeklyPlanSummary.matchingClassesCount)}</div>
                  <div className="mt-1 text-xs font-bold text-slate-400">فصول مطابقة</div>
                </div>
                <div className="rounded-xl bg-slate-50 p-4">
                  <div className="text-2xl font-black text-[#BA7517]">{toEnglishDigits(report.weeklyPlanSummary.classesWithoutPlans)}</div>
                  <div className="mt-1 text-xs font-bold text-slate-400">فصول بلا خطة</div>
                </div>
                <div className="rounded-xl bg-slate-50 p-4">
                  <div className="text-2xl font-black text-slate-600">{formatPct(report.kpis.implementationRate)}</div>
                  <div className="mt-1 text-xs font-bold text-slate-400">نسبة التنفيذ</div>
                </div>
              </div>

              {report.weeklyPlanSummary.plans.length ? (
                <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {report.weeklyPlanSummary.plans.slice(0, 8).map((plan) => (
                    <div key={plan.id} className="rounded-xl border border-slate-100 bg-white p-4">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="text-sm font-black text-[#0b2447]">{plan.gradeLabel}</span>
                        <span className="rounded-full bg-teal-50 px-2 py-1 text-xs font-bold text-[#159f91]">{plan.subject}</span>
                      </div>
                      <p className="text-sm font-bold leading-6 text-slate-500">{plan.skill}</p>
                      <p className="mt-2 text-xs font-bold text-slate-400">{difficultyLabel(plan.difficultyLevel)}</p>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="rounded-[1.5rem] border border-slate-100 bg-white p-6 shadow-[0_10px_34px_rgba(15,35,55,0.035)]">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-extrabold text-[#159f91]">اختبارات مقياس</p>
                  <h3 className="mt-1 text-xl font-black text-[#0b2447]">تنفيذ الحزم ونتائجها</h3>
                </div>
                <button onClick={loadPackageSummaries} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-extrabold text-slate-500">
                  تحديث
                </button>
              </div>
              {packagesLoading ? (
                <EmptyState>جارٍ تحميل اختبارات مقياس...</EmptyState>
              ) : packagesError ? (
                <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm font-bold text-red-700">{packagesError}</div>
              ) : packageSummaries.length ? (
                <div className="grid gap-4 lg:grid-cols-2">
                  {packageSummaries.map((item) => (
                    <div key={item.packageId} className="rounded-[1.25rem] border border-slate-100 bg-slate-50/50 p-5">
                      <div className="mb-4 flex items-start justify-between gap-3">
                        <div>
                          <div className="text-xs font-extrabold text-[#159f91]">
                            {item.subject} | الصف {toEnglishDigits(item.grade ?? "—")} | الأسبوع {toEnglishDigits(item.weekNumber ?? "—")}
                          </div>
                          <h4 className="mt-1 text-lg font-black text-[#0b2447]">{item.title}</h4>
                        </div>
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-500">
                          {formatPct(item.averagePercentage)}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="rounded-xl bg-white p-3">
                          <div className="text-xl font-black text-[#0b2447]">{toEnglishDigits(item.classesAssigned)}</div>
                          <div className="text-xs font-bold text-slate-400">فصول مطبقة</div>
                        </div>
                        <div className="rounded-xl bg-white p-3">
                          <div className="text-xl font-black text-[#159f91]">{toEnglishDigits(item.classesScanned)}</div>
                          <div className="text-xs font-bold text-slate-400">فصول مصححة</div>
                        </div>
                        <div className="rounded-xl bg-white p-3">
                          <div className="text-xl font-black text-[#0b2447]">{toEnglishDigits(item.studentsTested)}</div>
                          <div className="text-xs font-bold text-slate-400">طلاب مختبرون</div>
                        </div>
                      </div>
                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        <div>
                          <div className="mb-2 text-xs font-black text-slate-500">أضعف المجالات</div>
                          {item.weakestDomains.length ? item.weakestDomains.slice(0, 3).map((domain) => (
                            <div key={domain.name} className="mb-1 rounded-lg bg-white px-3 py-2 text-xs font-bold text-slate-600">
                              {domain.name} · {toEnglishDigits(`${domain.wrong}/${domain.total}`)}
                            </div>
                          )) : <p className="text-xs font-bold text-slate-400">لا توجد بيانات كافية</p>}
                        </div>
                        <div>
                          <div className="mb-2 text-xs font-black text-slate-500">أضعف المهارات</div>
                          {item.weakestSkills.length ? item.weakestSkills.slice(0, 3).map((skill) => (
                            <div key={skill.name} className="mb-1 rounded-lg bg-white px-3 py-2 text-xs font-bold text-slate-600">
                              {skill.name} · {toEnglishDigits(`${skill.wrong}/${skill.total}`)}
                            </div>
                          )) : <p className="text-xs font-bold text-slate-400">لا توجد بيانات كافية</p>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState>لا توجد اختبارات مقياس مطبقة على فصول المدرسة بعد.</EmptyState>
              )}
            </div>

            <div className="rounded-[1.5rem] border border-slate-100 bg-white p-6 shadow-[0_10px_34px_rgba(15,35,55,0.035)]">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-extrabold text-[#159f91]">تفاعل أولياء الأمور</p>
                  <h3 className="mt-1 text-xl font-black text-[#0b2447]">مؤشرات عامة على مستوى المدرسة</h3>
                  <p className="mt-1 text-sm font-bold text-slate-400">لا تعرض هذه البطاقة أسماء الطلاب أو بيانات التواصل.</p>
                </div>
                <button onClick={loadParentStats} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-extrabold text-slate-500">
                  تحديث
                </button>
              </div>
              {parentStatsLoading ? (
                <EmptyState>جارٍ تحميل تفاعل أولياء الأمور...</EmptyState>
              ) : parentStatsError ? (
                <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm font-bold text-red-700">{parentStatsError}</div>
              ) : parentStats ? (
                <div className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
                    <div className="rounded-xl bg-slate-50 p-4 text-center">
                      <div className="text-2xl font-black text-[#0b2447]">{toEnglishDigits(parentStats.totalLinks)}</div>
                      <div className="mt-1 text-xs font-bold text-slate-400">روابط ولي الأمر</div>
                    </div>
                    <div className="rounded-xl bg-teal-50 p-4 text-center">
                      <div className="text-2xl font-black text-[#159f91]">{toEnglishDigits(parentStats.openedReports)}</div>
                      <div className="mt-1 text-xs font-bold text-slate-400">تقارير مفتوحة</div>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-4 text-center">
                      <div className="text-2xl font-black text-[#0b2447]">{formatPct(parentStats.openRate)}</div>
                      <div className="mt-1 text-xs font-bold text-slate-400">نسبة الفتح</div>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-4 text-center">
                      <div className="text-2xl font-black text-[#0b2447]">{toEnglishDigits(parentStats.missionClicks)}</div>
                      <div className="mt-1 text-xs font-bold text-slate-400">ضغطات التدريب</div>
                    </div>
                    <div className="rounded-xl bg-emerald-50 p-4 text-center">
                      <div className="text-2xl font-black text-emerald-700">{toEnglishDigits(parentStats.completedMissions)}</div>
                      <div className="mt-1 text-xs font-bold text-slate-400">تدريبات مكتملة</div>
                    </div>
                    <div className="rounded-xl bg-amber-50 p-4 text-center">
                      <div className="text-2xl font-black text-[#BA7517]">{toEnglishDigits(parentStats.subscriptionInterestCount)}</div>
                      <div className="mt-1 text-xs font-bold text-slate-400">مهتمون بالتدريب</div>
                    </div>
                  </div>
                  {parentStats.totalLinks === 0 ? (
                    <EmptyState>لم يتم إنشاء روابط ولي أمر بعد.</EmptyState>
                  ) : parentStats.openedReports === 0 ? (
                    <div className="rounded-xl bg-slate-50 p-4 text-sm font-bold text-slate-500">
                      تم إنشاء روابط، لكن لم يفتح أولياء الأمور التقارير بعد.
                    </div>
                  ) : (
                    <div className="rounded-xl bg-slate-50 p-4 text-sm font-bold text-slate-500">
                      أكثر مهارة ظهر عليها اهتمام: {parentStats.topInterestedSkill ? `${parentStats.topInterestedSkill.skillName} (${toEnglishDigits(parentStats.topInterestedSkill.count)})` : "لا توجد بيانات كافية بعد"}
                    </div>
                  )}
                </div>
              ) : (
                <EmptyState>لا توجد بيانات تفاعل بعد.</EmptyState>
              )}
            </div>

            <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-[1.5rem] border border-slate-100 bg-white p-6 shadow-[0_10px_34px_rgba(15,35,55,0.035)]">
                <h3 className="mb-5 font-black text-[#0b2447]">الفصول ومتوسط الأداء</h3>
                {chartData.length ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} domain={[0, 100]} />
                      <Tooltip />
                      <Bar dataKey="avg" fill="#159f91" name="متوسط الأداء" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <EmptyState>لا توجد فصول كافية للرسم بعد</EmptyState>}
              </div>

              <div className="rounded-[1.5rem] border border-slate-100 bg-white p-6 shadow-[0_10px_34px_rgba(15,35,55,0.035)]">
                <h3 className="font-black text-[#0b2447]">جاهزية نافس</h3>
                <p className="mt-1 text-sm font-bold text-slate-400">{report.readinessIndex.label}</p>
                <div className="my-6 text-center text-6xl font-black text-[#159f91]">
                  {report.readinessIndex.value === null ? "—" : `${toEnglishDigits(report.readinessIndex.value)}%`}
                </div>
                <p className="rounded-xl bg-slate-50 p-3 text-xs font-bold leading-6 text-slate-500">
                  {toEnglishDigits(report.readinessIndex.formula)}
                </p>
              </div>
            </div>
          </div>
        )}

        {!loading && !loadError && report && activeTab === 1 && (
          <div className="space-y-6">
            <div className="rounded-[1.5rem] border border-slate-100 bg-white p-6 shadow-[0_10px_34px_rgba(15,35,55,0.035)]">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="text-xl font-black text-[#0b2447]">أثر مقياس</h3>
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
                <h3 className="mb-4 font-black text-[#0b2447]">المهارات الأضعف</h3>
                {report.weakSkills.length ? report.weakSkills.map((item) => (
                  <div key={item.skill} className="mb-4">
                    <div className="mb-1 flex justify-between text-sm font-bold">
                      <span>{item.skill}</span>
                      <span className="text-[#BA7517]">{toEnglishDigits(item.average)}%</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-slate-100"><div className="h-2.5 rounded-full bg-[#BA7517]" style={{ width: `${item.average}%` }} /></div>
                  </div>
                )) : <EmptyState>لا توجد نتائج كافية لاستخراج المهارات الأضعف</EmptyState>}
              </div>

              <div className="rounded-[1.5rem] border border-slate-100 bg-white p-6 shadow-[0_10px_34px_rgba(15,35,55,0.035)]">
                <h3 className="mb-4 font-black text-[#0b2447]">الطلاب الذين يحتاجون تدخلًا</h3>
                {report.atRiskStudents.length ? report.atRiskStudents.map((student) => (
                  <div key={student.id} className="mb-3 rounded-xl border border-red-100 bg-red-50/60 p-3">
                    <div className="font-bold text-[#0b2447]">{student.name}</div>
                    <div className="mt-1 text-xs font-bold text-red-500">{student.className} — {toEnglishDigits(student.percentage)}%</div>
                  </div>
                )) : <EmptyState>لا يوجد طلاب متعثرون حسب البيانات الحالية</EmptyState>}
              </div>
            </div>
          </div>
        )}

        {!loading && !loadError && report && activeTab === 2 && (
          <div className="space-y-4">
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <h3 className="font-bold text-gray-900">تقرير أداء المعلمين</h3>
              <p className="text-sm text-gray-500">مبني على الفصول والطلاب والنتائج المحفوظة</p>
            </div>
            {report.teachers.length ? report.teachers.map((teacher) => <TeacherCard key={teacher.id} teacher={teacher} />) : <EmptyState>لم تتم إضافة معلمين بعد</EmptyState>}
          </div>
        )}

        {!loading && !loadError && report && activeTab === 3 && (
          <div className="space-y-4">
            {report.alerts.length ? report.alerts.map((alert) => (
              <div key={`${alert.type}-${alert.title}`} className="rounded-xl border p-5" style={{ background: alert.type === "risk" ? "#fff5f5" : "#f8fafc", borderColor: alert.type === "risk" ? "#fecaca" : "#e2e8f0" }}>
                <h3 className="font-bold text-[#0b2447]">{alert.title}</h3>
                <p className="mt-1 text-sm font-bold text-slate-500">{toEnglishDigits(alert.detail)}</p>
              </div>
            )) : <EmptyState>لا توجد تنبيهات إدارية حالية</EmptyState>}
          </div>
        )}

        {!loading && !loadError && report && activeTab === 4 && (
          <div className="space-y-6">
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="mb-6 font-bold text-gray-900">مؤشر التحسن</h3>
              {report.improvement.value === null ? (
                <EmptyState>{report.improvement.label}</EmptyState>
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={[{ label: "البداية", avg: report.kpis.performanceAverage ?? 0 }, { label: "الحالي", avg: report.improvement.value }]}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="avg" stroke="#1D9E75" strokeWidth={3} dot={{ fill: "#1D9E75", r: 5 }} name="المتوسط %" />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
