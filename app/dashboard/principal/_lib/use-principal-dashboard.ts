import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { normalizeSaudiMobile } from "@/lib/format";
import type {
  PeriodicReportPreview,
  PeriodicReportWeek,
  PrincipalPackageSummary,
  PrincipalParentStats,
  PrincipalReport,
} from "./types";

export function usePrincipalDashboard() {
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
  const [periodicForm, setPeriodicForm] = useState({
    reportType: "learning_outcomes_followup",
    weekNumber: "",
    subject: "",
    grade: "",
    educationRegion: "المنطقة الشرقية",
    principalName: "",
    showStudentNames: "false",
    includeImprovementPlan: "true",
    includeRecommendations: "true",
  });
  const [periodicPreview, setPeriodicPreview] = useState<PeriodicReportPreview | null>(null);
  const [periodicWeeks, setPeriodicWeeks] = useState<PeriodicReportWeek[]>([]);
  const [periodicLoading, setPeriodicLoading] = useState(false);
  const [periodicWeeksLoading, setPeriodicWeeksLoading] = useState(false);
  const [periodicError, setPeriodicError] = useState<string | null>(null);

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
      const { data: profile } = await supabase
        .from("users")
        .select("name")
        .eq("auth_id", session.user.id)
        .maybeSingle();
      if (profile?.name) {
        setPeriodicForm((prev) => prev.principalName ? prev : { ...prev, principalName: profile.name });
      }
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
      if (!res.ok || !json.success) throw new Error(json.error || "تعذر تحميل اختبارات دالا");
      setPackageSummaries(json.data ?? []);
    } catch (err) {
      setPackagesError(err instanceof Error ? err.message : "تعذر تحميل اختبارات دالا");
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

  const loadPeriodicWeeks = useCallback(async () => {
    setPeriodicWeeksLoading(true);
    try {
      const res = await fetch("/api/principal/periodic-reports/preview?mode=weeks", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "تعذر تحميل الأسابيع المتاحة");
      const weeks = (json.weeks ?? []) as PeriodicReportWeek[];
      setPeriodicWeeks(weeks);
      setPeriodicForm((prev) => prev.weekNumber || !weeks.length ? prev : { ...prev, weekNumber: String(weeks[0].weekNumber) });
    } catch (err) {
      setPeriodicError(err instanceof Error ? err.message : "تعذر تحميل الأسابيع المتاحة");
    } finally {
      setPeriodicWeeksLoading(false);
    }
  }, []);

  const periodicPayload = useCallback(() => ({
    reportType: periodicForm.reportType,
    weekNumber: periodicForm.weekNumber ? Number(periodicForm.weekNumber) : null,
    subject: periodicForm.subject || null,
    grade: periodicForm.grade ? Number(periodicForm.grade) : null,
    educationRegion: periodicForm.educationRegion || null,
    principalName: periodicForm.principalName || null,
    showStudentNames: periodicForm.showStudentNames === "true",
    includeImprovementPlan: periodicForm.includeImprovementPlan === "true",
    includeRecommendations: periodicForm.includeRecommendations === "true",
  }), [periodicForm]);

  const previewPeriodicReport = useCallback(async () => {
    setPeriodicLoading(true);
    setPeriodicError(null);
    try {
      const params = new URLSearchParams();
      const payload = periodicPayload();
      if (!payload.weekNumber) throw new Error("اختر الأسبوع أولًا");
      Object.entries(payload).forEach(([key, value]) => {
        if (value !== null && value !== undefined) params.set(key, String(value));
      });
      const res = await fetch(`/api/principal/periodic-reports/preview?${params.toString()}`, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) throw new Error(json.error || "تعذر إنشاء معاينة التقرير");
      setPeriodicPreview(json.data);
    } catch (err) {
      setPeriodicError(err instanceof Error ? err.message : "تعذر إنشاء معاينة التقرير");
    } finally {
      setPeriodicLoading(false);
    }
  }, [periodicPayload]);

  const exportPeriodicReport = useCallback(async () => {
    setPeriodicLoading(true);
    setPeriodicError(null);
    try {
      const payload = periodicPayload();
      if (!payload.weekNumber) throw new Error("اختر الأسبوع أولًا");
      const res = await fetch("/api/principal/periodic-reports/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "تعذر تصدير التقرير");
      }
      const html = await res.text();
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      setPeriodicError(err instanceof Error ? err.message : "تعذر تصدير التقرير");
    } finally {
      setPeriodicLoading(false);
    }
  }, [periodicPayload]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  useEffect(() => {
    void loadPackageSummaries();
    void loadParentStats();
  }, [loadPackageSummaries, loadParentStats]);

  useEffect(() => {
    if (activeTab === 5 && !periodicWeeks.length) {
      void loadPeriodicWeeks();
    }
  }, [activeTab, loadPeriodicWeeks, periodicWeeks.length]);

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

  return {
    router,
    activeTab,
    setActiveTab,
    loading,
    setLoading,
    report,
    setReport,
    loadError,
    setLoadError,
    inviteOpen,
    setInviteOpen,
    inviteName,
    setInviteName,
    invitePhone,
    setInvitePhone,
    inviteEmail,
    setInviteEmail,
    inviteSubject,
    setInviteSubject,
    inviteGrades,
    setInviteGrades,
    inviteClassIds,
    setInviteClassIds,
    inviteLoading,
    setInviteLoading,
    inviteMessage,
    setInviteMessage,
    packageSummaries,
    setPackageSummaries,
    packagesLoading,
    setPackagesLoading,
    packagesError,
    setPackagesError,
    parentStats,
    setParentStats,
    parentStatsLoading,
    setParentStatsLoading,
    parentStatsError,
    setParentStatsError,
    periodicForm,
    setPeriodicForm,
    periodicPreview,
    setPeriodicPreview,
    periodicWeeks,
    setPeriodicWeeks,
    periodicLoading,
    setPeriodicLoading,
    periodicWeeksLoading,
    setPeriodicWeeksLoading,
    periodicError,
    setPeriodicError,
    chartData,
    loadReport,
    loadPackageSummaries,
    loadParentStats,
    loadPeriodicWeeks,
    periodicPayload,
    previewPeriodicReport,
    exportPeriodicReport,
    inviteTeacher,
    executedClassesCount,
    measuredStudentsCount,
    criticalSkillsCount,
  };
}

export type PrincipalDashboardState = ReturnType<typeof usePrincipalDashboard>;
