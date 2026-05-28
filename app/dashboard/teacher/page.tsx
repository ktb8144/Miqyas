"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";
import { LevelBadge } from "@/components/level-badge";
import { StudentImportFlow } from "@/components/student-import-flow";
import { BatchOMRScanner } from "@/components/batch-omr-scanner";
import { supabase } from "@/lib/supabase";
import { formatSchoolDateRange, toEnglishDigits } from "@/lib/format";
import { normalizeSubject } from "@/lib/subjects";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Student {
  id: string;
  name: string;
  studentCode: string | null;
  score: number;
  total: number;
}

interface ClassItem {
  id: string;
  name: string;
  grade: number;
  subject: string;
  teacherId: string;
  schoolId: string;
}

interface WeeklyPlan {
  id: string;
  week_number: number;
  start_date: string;
  end_date: string;
  start_hijri: string;
  end_hijri: string;
  grade: number;
  grade_label: string;
  subject: string;
  domain: string | null;
  skill: string;
  learning_goal: string | null;
  assessment_title: string;
  question_count: number;
  difficulty_level: string;
}

type WeeklyPlanItem = {
  plan: WeeklyPlan;
  class: {
    id: string;
    name: string;
    grade: number | null;
    subject: string | null;
  };
};

interface ClassReport {
  summary: string;
  strengths: string;
  weaknesses: string;
  interventionPlan: string;
  recommendations: string;
}

type ClassStudentsMap = Record<string, Student[]>;
type AssignmentStudentScores = Record<string, Record<string, { score: number; total: number; percentage: number; level: string; scannedAt: string | null }>>;

interface TeacherProfile {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  school_id: string | null;
  subject: string | null;
  schoolName: string | null;
}

interface TeacherPackage {
  id: string;
  title: string;
  description: string | null;
  subject: string;
  grade: number;
  week_number: number | null;
  duration_minutes: number | null;
  package_type: string;
  start_date: string | null;
  end_date: string | null;
  student_pdf_url: string | null;
  questions_pdf_url?: string | null;
  answer_sheet_pdf_url: string | null;
  question_count: number;
  schoolAssignmentStatus: string;
  matchingClasses: Array<{ id: string; name: string }>;
}

interface TeacherPackageAssignment {
  id: string;
  packageId: string;
  packageTitle: string;
  subject: string;
  grade: number | null;
  weekNumber: number | null;
  startDate: string | null;
  endDate: string | null;
  classId: string;
  className: string;
  status: string;
  printedAt: string | null;
  scannedAt: string | null;
  completedAt: string | null;
  studentPdfUrl: string | null;
  answerSheetPdfUrl: string | null;
  questionCount: number;
}

type PackageResultDetails = {
  assignment: {
    id: string;
    packageTitle: string;
    className: string;
    subject: string;
    grade: number | null;
    weekNumber: number | null;
  };
  summary: {
    studentsTestedCount: number;
    averagePercentage: number | null;
  };
  students: Array<{
    id: string;
    studentId: string;
    studentCode: string | null;
    studentName: string;
    score: number;
    total: number;
    percentage: number;
    level: string;
  }>;
  weakestSkills: Array<{ name: string; wrong: number; total: number }>;
  weakestDomains: Array<{ name: string; wrong: number; total: number }>;
};

// ─── Report Modal ─────────────────────────────────────────────────────────────

function ReportModal({
  report, loading, error, onClose,
}: {
  report: ClassReport | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" dir="rtl">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 p-5 flex items-center justify-between rounded-t-2xl">
          <h2 className="font-bold text-gray-900 text-lg">تقرير الفصل — الذكاء الاصطناعي</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>
        <div className="p-6">
          {loading && (
            <div className="text-center py-12">
              <div className="relative w-16 h-16 mx-auto mb-4">
                <div className="w-16 h-16 rounded-full border-4 border-gray-200" />
                <div className="absolute top-0 left-0 w-16 h-16 rounded-full border-4 border-t-transparent animate-spin" style={{ borderColor: "#1D9E75", borderTopColor: "transparent" }} />
              </div>
              <p className="text-gray-600 font-medium">الذكاء الاصطناعي يحلل نتائج الفصل...</p>
              <p className="text-gray-400 text-sm mt-1">قد يستغرق ذلك بضع ثوانٍ</p>
            </div>
          )}
          {error && !loading && (
            <div className="rounded-xl p-4 text-center" style={{ background: "#fff5f5", border: "1px solid #fecaca" }}>
              <p className="text-red-700 font-medium mb-1">⚠️ تعذّر توليد التقرير</p>
              <p className="text-red-500 text-sm">{error}</p>
            </div>
          )}
          {report && !loading && (
            <div className="space-y-5">
              {[
                { label: "الملخص", icon: "📋", content: report.summary, color: "#1D9E75", bg: "#f0fdf8" },
                { label: "نقاط القوة", icon: "💪", content: report.strengths, color: "#7F77DD", bg: "#f5f3ff" },
                { label: "نقاط التحسين", icon: "📌", content: report.weaknesses, color: "#BA7517", bg: "#fffbeb" },
                { label: "خطة التدخل", icon: "🎯", content: report.interventionPlan, color: "#E24B4A", bg: "#fff5f5" },
                { label: "توصيات للمعلم", icon: "💡", content: report.recommendations, color: "#1D9E75", bg: "#f0fdf8" },
              ].map((s) => (
                <div key={s.label} className="rounded-xl p-4" style={{ background: s.bg, border: `1px solid ${s.color}30` }}>
                  <div className="flex items-center gap-2 mb-2">
                    <span>{s.icon}</span>
                    <span className="font-bold text-sm" style={{ color: s.color }}>{s.label}</span>
                  </div>
                  <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-line">{s.content}</p>
                </div>
              ))}
              <div className="flex gap-3 pt-2">
                <button className="flex-1 py-2.5 rounded-xl text-white font-bold text-sm" style={{ background: "#1D9E75" }} onClick={() => window.print()}>
                  🖨️ طباعة التقرير
                </button>
                <button className="flex-1 py-2.5 rounded-xl border-2 font-bold text-sm" style={{ borderColor: "#1D9E75", color: "#1D9E75" }} onClick={onClose}>
                  إغلاق
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Add Class Modal ──────────────────────────────────────────────────────────

function AddClassModal({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (input: { name: string; grade: number; subject: string }) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [grade, setGrade] = useState(3);
  const [subject, setSubject] = useState("رياضيات");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const gradeLabels: Record<number, string> = {
    3: "الثالث", 4: "الرابع", 5: "الخامس", 6: "السادس",
  };

  const handleCreate = async () => {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await onAdd({ name: name.trim(), grade, subject });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر إنشاء الفصل");
    } finally {
      setSaving(false);
    }
  };

  const handleGradeChange = (nextGrade: number) => {
    setGrade(nextGrade);
    if (nextGrade === 3 && subject === "علوم") {
      setSubject("رياضيات");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" dir="rtl">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="sticky top-0 bg-white border-b border-gray-100 p-5 flex items-center justify-between rounded-t-2xl">
          <h2 className="font-bold text-gray-900 text-lg">إضافة فصل جديد</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>
        <div className="p-6 space-y-4">
          {error && (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">اسم الفصل</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="الثالث أ"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2"
              style={{ direction: "rtl" }}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">الصف الدراسي</label>
            <select
              value={grade}
              onChange={(e) => handleGradeChange(Number(e.target.value))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2"
              style={{ direction: "rtl" }}
            >
              {[3, 4, 5, 6].map((g) => (
                <option key={g} value={g}>{gradeLabels[g]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">المادة</label>
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2"
              style={{ direction: "rtl" }}
            >
              <option value="رياضيات">رياضيات</option>
              <option value="لغة عربية">لغة عربية</option>
              {grade !== 3 && <option value="علوم">علوم</option>}
            </select>
          </div>
          <button
            onClick={handleCreate}
            disabled={!name.trim() || saving}
            className="w-full py-3 rounded-xl text-white font-bold text-sm disabled:opacity-50 hover:opacity-90"
            style={{ background: "#1D9E75" }}
          >
            {saving ? "جارٍ الإنشاء..." : "إنشاء الفصل"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function TeacherDashboard() {
  const router = useRouter();

  // ── View state ──────────────────────────────────────────────────────────────
  type View = "classes" | "students" | "weeklyPlans" | "packages";
  const [view, setView] = useState<View>("classes");
  const [activeClassId, setActiveClassId] = useState<string | null>(null);

  // ── Classes state ────────────────────────────────────────────────────────────
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [classStudents, setClassStudents] = useState<ClassStudentsMap>({});
  const [showAddClass, setShowAddClass] = useState(false);
  const [teacherProfile, setTeacherProfile] = useState<TeacherProfile | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [studentSaveError, setStudentSaveError] = useState<string | null>(null);
  const [manualSaving, setManualSaving] = useState(false);
  const [currentPlans, setCurrentPlans] = useState<WeeklyPlanItem[]>([]);
  const [upcomingPlans, setUpcomingPlans] = useState<WeeklyPlanItem[]>([]);
  const [, setPlanSource] = useState<"current_week" | "upcoming" | "none">("none");
  const [planLoading, setPlanLoading] = useState(false);

  // ── Miqyas package workflow state ───────────────────────────────────────────
  const [packages, setPackages] = useState<TeacherPackage[]>([]);
  const [packageAssignments, setPackageAssignments] = useState<TeacherPackageAssignment[]>([]);
  const [packagesLoading, setPackagesLoading] = useState(false);
  const [packagesError, setPackagesError] = useState<string | null>(null);
  const [selectedPackageClasses, setSelectedPackageClasses] = useState<Record<string, string>>({});
  const [applyingPackageId, setApplyingPackageId] = useState<string | null>(null);
  const [packageSuccess, setPackageSuccess] = useState<string | null>(null);
  const [activePackageAssignment, setActivePackageAssignment] = useState<TeacherPackageAssignment | null>(null);
  const [packageResultsAssignment, setPackageResultsAssignment] = useState<TeacherPackageAssignment | null>(null);
  const [packageResults, setPackageResults] = useState<PackageResultDetails | null>(null);
  const [assignmentStudentScores, setAssignmentStudentScores] = useState<AssignmentStudentScores>({});
  const [packageResultsLoading, setPackageResultsLoading] = useState(false);
  const [packageResultsError, setPackageResultsError] = useState<string | null>(null);
  const [selectedClassAssignment, setSelectedClassAssignment] = useState<Record<string, string>>({});
  // ── Student add (manual) state ───────────────────────────────────────────────
  const [showAddStudents, setShowAddStudents] = useState(false);
  const [addStudentMode, setAddStudentMode] = useState<"choice" | "import" | "manual">("choice");
  const [manualNames, setManualNames] = useState("");

  // ── Report state ─────────────────────────────────────────────────────────────
  const [reportOpen, setReportOpen] = useState(false);
  const [report, setReport] = useState<ClassReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  // ── Derived values ───────────────────────────────────────────────────────────
  const activeClass = classes.find((c) => c.id === activeClassId) ?? null;
  const activeStudents: Student[] = activeClassId ? (classStudents[activeClassId] ?? []) : [];
  const allPlanItems = [...currentPlans, ...upcomingPlans];
  const weeklyPlanItem = currentPlans[0] ?? upcomingPlans[0] ?? null;
  const activeClassPlanItem = activeClass
    ? allPlanItems.find((item) => item.class.id === activeClass.id) ?? null
    : null;
  const weeklyClass = activeClass ?? classes[0] ?? null;
  const teacherDisplayName = teacherProfile?.name?.trim() || "المعلم";
  const teacherSubtitle = `${teacherDisplayName}${teacherProfile?.subject ? ` — ${teacherProfile.subject}` : ""}`;
  const activePackageStudents = activePackageAssignment
    ? classStudents[activePackageAssignment.classId] ?? []
    : [];
  const packageAssignmentsByClass = packageAssignments.reduce<Record<string, TeacherPackageAssignment[]>>((acc, item) => {
    acc[item.classId] = [...(acc[item.classId] ?? []), item];
    return acc;
  }, {});

  const getSelectedAssignmentForClass = (classId: string) => {
    const classAssignments = packageAssignmentsByClass[classId] ?? [];
    const selectedAssignmentId = selectedClassAssignment[classId] ?? classAssignments[0]?.id ?? "";
    return classAssignments.find((item) => item.id === selectedAssignmentId) ?? classAssignments[0] ?? null;
  };

  const getStudentPackageScore = (classId: string, studentId: string) => {
    const assignment = getSelectedAssignmentForClass(classId);
    return assignment ? assignmentStudentScores[assignment.id]?.[studentId] ?? null : null;
  };

  const calcPackageAvg = (classId: string, students: Student[]) => {
    const scored = students
      .map((student) => getStudentPackageScore(classId, student.id))
      .filter((score): score is NonNullable<typeof score> => Boolean(score));
    if (!scored.length) return null;
    return Math.round(scored.reduce((acc, score) => acc + score.percentage, 0) / scored.length);
  };

  const getPerformanceLevel = (score: number, total: number) => {
    const pct = (score / total) * 100;
    if (pct >= 90) return "متقدم";
    if (pct >= 70) return "متمكن";
    if (pct >= 50) return "أساسي";
    return "دون الأساسي";
  };

  const getGradeLabel = (grade?: number | null) => {
    const labels: Record<number, string> = {
      1: "الأول",
      2: "الثاني",
      3: "الثالث",
      4: "الرابع",
      5: "الخامس",
      6: "السادس",
    };
    return grade ? labels[grade] ?? String(grade) : "غير محدد";
  };

  const difficultyLabel = (value?: string | null) => {
    const labels: Record<string, string> = {
      easy: "سهل",
      medium: "متوسط",
      hard: "متقدم",
      nafs_simulation: "محاكاة نافس",
    };
    return value ? labels[value] ?? value : "غير محدد";
  };

  const packageStatusLabel = (value?: string | null) => {
    const labels: Record<string, string> = {
      assigned: "مُعيّن",
      printed: "تمت الطباعة",
      in_progress: "قيد التنفيذ",
      scanned: "تم التصحيح",
      completed: "مكتمل",
      available: "متاح",
      active: "نشط",
      completed_school: "مكتمل",
    };
    return value ? labels[value] ?? value : "غير محدد";
  };

  const packageTypeLabel = (value?: string | null) => {
    const labels: Record<string, string> = {
      weekly: "اختبار أسبوعي",
      diagnostic: "اختبار تشخيصي",
      nafs_simulation: "محاكاة نافس",
    };
    return value ? labels[value] ?? value : "اختبار مقياس";
  };

  const packageDateLabel = (item: { start_date?: string | null; end_date?: string | null; startDate?: string | null; endDate?: string | null }) => {
    const start = item.start_date ?? item.startDate;
    const end = item.end_date ?? item.endDate;
    if (!start || !end) return "تاريخ غير محدد";
    return `${toEnglishDigits(start)} - ${toEnglishDigits(end)}`;
  };

  const normalizeStudentName = (name: string) => name.trim().replace(/\s+/g, " ").toLowerCase();

  const mapStudentRow = (row: {
    id: string;
    name: string;
    student_code?: string | null;
    score?: number | null;
    total?: number | null;
  }): Student => ({
    id: row.id,
    name: row.name,
    studentCode: row.student_code ?? null,
    score: row.score ?? 0,
    total: row.total ?? 10,
  });

  const loadTeacherData = useCallback(async () => {
    setPageLoading(true);
    setPageError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("users")
        .select("id, name, email, role, school_id, subject")
        .eq("auth_id", session.user.id)
        .single();

      if (profileError || !profile || profile.role !== "teacher" || !profile.school_id) {
        throw new Error("تعذر التحقق من حساب المعلم");
      }

      let schoolName: string | null = null;
      const { data: school } = await supabase
        .from("schools")
        .select("name")
        .eq("id", profile.school_id)
        .maybeSingle();

      schoolName = school?.name ?? null;

      setTeacherProfile({
        id: profile.id,
        name: profile.name ?? null,
        email: profile.email ?? null,
        role: profile.role,
        school_id: profile.school_id,
        subject: profile.subject ?? null,
        schoolName,
      });

      const { data: classRows, error: classesError } = await supabase
        .from("classes")
        .select("id, name, grade, subject, teacher_id, school_id, students(id, name, class_id, student_code, score, total)")
        .eq("teacher_id", profile.id)
        .eq("school_id", profile.school_id)
        .order("created_at", { ascending: false });

      if (classesError) throw classesError;

      const nextStudents: ClassStudentsMap = {};
      const mappedClasses: ClassItem[] = (classRows ?? []).map((row) => {
        const students = Array.isArray(row.students) ? row.students : [];
        nextStudents[row.id] = students.map(mapStudentRow);
        return {
          id: row.id,
          name: row.name,
          grade: Number(row.grade),
          subject: row.subject,
          teacherId: row.teacher_id,
          schoolId: row.school_id,
        };
      });

      setClasses(mappedClasses);
      setClassStudents(nextStudents);
    } catch (err) {
      console.error("teacher dashboard load failed", err);
      setPageError(err instanceof Error ? err.message : "تعذر تحميل بيانات الفصول والطلاب");
    } finally {
      setPageLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadTeacherData();
  }, [loadTeacherData]);

  const loadCurrentPlan = useCallback(async () => {
    setPlanLoading(true);
    try {
      const res = await fetch("/api/teacher/current-plan", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "تعذر تحميل خطة الأسبوع");
      setCurrentPlans(json.currentPlans ?? []);
      setUpcomingPlans(json.upcomingPlans ?? []);
      setPlanSource(json.source ?? "none");
    } catch (err) {
      console.error("teacher current plan load failed", err);
      setCurrentPlans([]);
      setUpcomingPlans([]);
      setPlanSource("none");
    } finally {
      setPlanLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCurrentPlan();
  }, [loadCurrentPlan]);

  const loadPackageWorkflow = useCallback(async () => {
    setPackagesLoading(true);
    setPackagesError(null);
    try {
      const [packagesRes, assignmentsRes] = await Promise.all([
        fetch("/api/teacher/assessment-packages", { cache: "no-store" }),
        fetch("/api/teacher/class-package-assignments", { cache: "no-store" }),
      ]);

      const [packagesJson, assignmentsJson] = await Promise.all([
        packagesRes.json().catch(() => ({})),
        assignmentsRes.json().catch(() => ({})),
      ]);

      if (!packagesRes.ok || !packagesJson.success) {
        throw new Error(packagesJson.error || "تعذر تحميل اختبارات مقياس");
      }

      if (!assignmentsRes.ok || !assignmentsJson.success) {
        throw new Error(assignmentsJson.error || "تعذر تحميل اختبارات الفصول");
      }

      const nextPackages = (packagesJson.packages ?? []) as TeacherPackage[];
      const nextAssignments = (assignmentsJson.assignments ?? []) as TeacherPackageAssignment[];
      setPackages(nextPackages);
      setPackageAssignments(nextAssignments);
      const scoreEntries = await Promise.all(
        nextAssignments.map(async (assignment) => {
          const res = await fetch(`/api/teacher/class-package-assignments/${assignment.id}/results`, { cache: "no-store" });
          const json = await res.json().catch(() => ({}));
          if (!res.ok || !json.success) {
            console.warn("teacher package result load failed", {
              classPackageAssignmentId: assignment.id,
              error: json.error ?? "unknown",
            });
            return [assignment.id, {}] as const;
          }
          const scores = ((json.data?.students ?? []) as PackageResultDetails["students"]).reduce<AssignmentStudentScores[string]>((acc, student) => {
            acc[student.studentId] = {
              score: student.score,
              total: student.total,
              percentage: student.percentage,
              level: student.level,
              scannedAt: null,
            };
            return acc;
          }, {});
          console.info("teacher loaded assignment results", {
            classPackageAssignmentId: assignment.id,
            loadedResults: Object.keys(scores).length,
            studentIds: Object.keys(scores),
          });
          return [assignment.id, scores] as const;
        })
      );
      setAssignmentStudentScores(Object.fromEntries(scoreEntries));
      setSelectedPackageClasses((prev) => {
        const next = { ...prev };
        nextPackages.forEach((item) => {
          if (!next[item.id] && item.matchingClasses[0]) {
            next[item.id] = item.matchingClasses[0].id;
          }
        });
        return next;
      });
    } catch (err) {
      setPackagesError(err instanceof Error ? err.message : "تعذر تحميل اختبارات مقياس");
    } finally {
      setPackagesLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPackageWorkflow();
  }, [loadPackageWorkflow]);

  // ── Report generation ────────────────────────────────────────────────────────
  const generateReport = async () => {
    setReportOpen(true);
    setReport(null);
    setReportError(null);
    setReportLoading(true);
    try {
      const reportClass = activeClass ?? weeklyClass;
      if (!reportClass) {
        throw new Error("أضف فصلًا أولًا لتوليد التقرير");
      }

      const res = await fetch("/api/generate-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacherName: teacherProfile?.name?.trim() || "المعلم",
          skill: `متابعة ${reportClass.subject}`,
          grade: getGradeLabel(reportClass.grade),
          subject: reportClass.subject || teacherProfile?.subject || "غير محدد",
          results: activeStudents
            .filter((s) => s.score > 0)
            .map((s) => ({ name: s.name, score: s.score, total: s.total, level: getPerformanceLevel(s.score, s.total) })),
        }),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error);
      setReport(json.report);
    } catch (err) {
      setReportError(err instanceof Error ? err.message : "خطأ غير معروف");
    } finally {
      setReportLoading(false);
    }
  };

  // ── Student handlers ─────────────────────────────────────────────────────────
  const saveStudents = async (names: string[]) => {
    if (!activeClassId) return;
    setStudentSaveError(null);

    const existing = classStudents[activeClassId] ?? [];
    const existingNames = new Set(existing.map((student) => normalizeStudentName(student.name)));
    const newNames = names
      .map((name) => name.trim().replace(/\s+/g, " "))
      .filter(Boolean)
      .filter((name) => !existingNames.has(normalizeStudentName(name)));

    if (newNames.length === 0) return { savedCount: 0 };

    const res = await fetch("/api/save-students", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ classId: activeClassId, names: newNames }),
    });
    const json = await res.json().catch(() => ({}));

    if (!res.ok || json.error) {
      throw new Error(json.error || "تعذر حفظ الطلاب");
    }

    const savedStudents: Student[] = (json.students ?? []).map(mapStudentRow);
    setClassStudents((prev) => ({
      ...prev,
      [activeClassId]: [...(prev[activeClassId] ?? []), ...savedStudents],
    }));
    return { savedCount: savedStudents.length };
  };

  const handleImportSave = async (names: string[]) => {
    const result = await saveStudents(names);
    setShowAddStudents(false);
    setAddStudentMode("choice");
    return result;
  };

  const handleManualSave = async () => {
    if (!activeClassId) return;
    const names = manualNames
      .split("\n")
      .map((n) => n.trim())
      .filter((n) => n.length > 0);
    if (!names.length) return;
    setManualSaving(true);
    setStudentSaveError(null);
    try {
      await saveStudents(names);
      setManualNames("");
      setShowAddStudents(false);
      setAddStudentMode("choice");
    } catch (err) {
      setStudentSaveError(err instanceof Error ? err.message : "تعذر حفظ الطلاب");
    } finally {
      setManualSaving(false);
    }
  };

  const handleApplyPackage = async (assessmentPackage: TeacherPackage) => {
    const classId = selectedPackageClasses[assessmentPackage.id] ?? assessmentPackage.matchingClasses[0]?.id;
    if (!classId) {
      setPackagesError("أضف فصلًا مطابقًا للصف والمادة لتطبيق هذا الاختبار.");
      return;
    }

    setApplyingPackageId(assessmentPackage.id);
    setPackagesError(null);
    setPackageSuccess(null);
    try {
      const res = await fetch("/api/teacher/class-package-assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageId: assessmentPackage.id, classId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) throw new Error(json.error || "تعذر تطبيق الاختبار على الفصل");

      setPackageSuccess(json.alreadyExists ? "هذا الاختبار مطبق على الفصل مسبقًا." : "تم تطبيق الاختبار على الفصل بنجاح.");
      await loadPackageWorkflow();
    } catch (err) {
      setPackagesError(err instanceof Error ? err.message : "تعذر تطبيق الاختبار على الفصل");
    } finally {
      setApplyingPackageId(null);
    }
  };

  const handlePackageScanComplete = async (
    results: { editedName: string; studentName: string; answers: Record<string, string>; score: number; total: number; matchedStudentId?: string | null }[]
  ) => {
    if (!activePackageAssignment) return;

    const students = classStudents[activePackageAssignment.classId] ?? [];
    if (!students.length) {
      throw new Error("لا يوجد طلاب في الفصل لحفظ نتائج التصحيح");
    }

    const updates: Array<{ student: Student; result: { answers: Record<string, string>; score: number; total: number } }> = [];

    results.forEach((result) => {
      const student = result.matchedStudentId
        ? students.find((item) => item.id === result.matchedStudentId)
        : null;
      if (student) {
        updates.push({ student, result });
      }
    });

    if (!updates.length) {
      throw new Error("لم يتم العثور على طلاب مطابقين لحفظ نتائج اختبار مقياس");
    }

    const failures: string[] = [];
    await Promise.all(
      updates.map(async ({ student, result }) => {
        const res = await fetch("/api/scan-package-omr", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            classPackageAssignmentId: activePackageAssignment.id,
            studentId: student.id,
            save: true,
            studentAnswers: result.answers,
          }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json.success) failures.push(student.name);
      })
    );

    if (failures.length) {
      throw new Error(`تعذر حفظ نتائج ${toEnglishDigits(failures.length)} طالب`);
    }

    setPackageSuccess("تم حفظ نتائج اختبار مقياس بنجاح.");
    await openPackageResults(activePackageAssignment);
    setActivePackageAssignment(null);
    await loadPackageWorkflow();
  };

  const openPackageResults = async (assignment: TeacherPackageAssignment) => {
    setPackageResultsAssignment(assignment);
    setPackageResults(null);
    setPackageResultsError(null);
    setPackageResultsLoading(true);
    try {
      const res = await fetch(`/api/teacher/class-package-assignments/${assignment.id}/results`, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) throw new Error(json.error || "تعذر تحميل نتائج الاختبار");
      setPackageResults(json.data as PackageResultDetails);
    } catch (err) {
      setPackageResultsError(err instanceof Error ? err.message : "تعذر تحميل نتائج الاختبار");
    } finally {
      setPackageResultsLoading(false);
    }
  };

  const markPackagePrinted = async (assignmentId: string) => {
    try {
      const res = await fetch("/api/teacher/class-package-assignments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignmentId, action: "mark_printed" }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) throw new Error(json.error || "تعذر تحديث حالة الطباعة");
      setPackageAssignments((prev) =>
        prev.map((item) =>
          item.id === assignmentId
            ? { ...item, status: "printed", printedAt: new Date().toISOString() }
            : item
        )
      );
    } catch (err) {
      console.error("mark package printed failed", err);
    }
  };

  const handleAddClass = async (input: { name: string; grade: number; subject: string }) => {
    if (!teacherProfile) throw new Error("تعذر تحديد حساب المعلم");

    const { data, error } = await supabase
      .from("classes")
      .insert({
        name: input.name,
        grade: input.grade,
        subject: input.subject,
        teacher_id: teacherProfile.id,
        school_id: teacherProfile.school_id,
      })
      .select("id, name, grade, subject, teacher_id, school_id")
      .single();

    if (error || !data) {
      console.error("create class failed", error);
      throw new Error(error?.message || "تعذر حفظ الفصل");
    }

    const cls: ClassItem = {
      id: data.id,
      name: data.name,
      grade: Number(data.grade),
      subject: data.subject,
      teacherId: data.teacher_id,
      schoolId: data.school_id,
    };

    setClasses((prev) => [cls, ...prev]);
    setClassStudents((prev) => ({ ...prev, [cls.id]: [] }));
    const matchingPackages = packages.filter(
      (item) => item.grade === cls.grade && normalizeSubject(item.subject) === normalizeSubject(cls.subject) && item.question_count > 0
    );
    if (matchingPackages.length > 0) {
      await Promise.allSettled(
        matchingPackages.map((item) =>
          fetch("/api/teacher/class-package-assignments", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ packageId: item.id, classId: cls.id }),
          })
        )
      );
      await loadPackageWorkflow();
    }
  };

  const handleViewStudents = (classId: string) => {
    setActiveClassId(classId);
    setView("students");
    setShowAddStudents(false);
    setAddStudentMode("choice");
  };

  const handleBackToClasses = () => {
    setView("classes");
    setActiveClassId(null);
    setShowAddStudents(false);
    setAddStudentMode("choice");
    setManualNames("");
  };

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#f7fafc] text-[#0b2447]" dir="rtl">
      {reportOpen && (
        <ReportModal report={report} loading={reportLoading} error={reportError} onClose={() => setReportOpen(false)} />
      )}

      {activePackageAssignment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" dir="rtl">
          <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-[1.5rem] bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white p-5">
              <div>
                <p className="text-sm font-extrabold text-[#159f91]">تصحيح اختبار مقياس</p>
                <h2 className="mt-1 text-xl font-black text-[#0b2447]">{activePackageAssignment.packageTitle}</h2>
                <p className="mt-1 text-sm font-bold text-slate-400">
                  {activePackageAssignment.className} | {toEnglishDigits(activePackageStudents.length)} طالب
                </p>
              </div>
              <button
                onClick={() => setActivePackageAssignment(null)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-extrabold text-slate-500 transition hover:border-[#159f91]/40 hover:text-[#159f91]"
              >
                إغلاق
              </button>
            </div>
            <div className="p-5">
              {activePackageStudents.length ? (
                <BatchOMRScanner
                  mode="package"
                  classPackageAssignmentId={activePackageAssignment.id}
                  totalStudents={activePackageStudents.length}
                  subject={activePackageAssignment.subject}
                  grade={activePackageAssignment.grade ?? ""}
                  weekNumber={activePackageAssignment.weekNumber ?? 0}
                  onComplete={handlePackageScanComplete}
                  students={activePackageStudents.map((student) => ({ id: student.id, name: student.name, studentCode: student.studentCode }))}
                />
              ) : (
                <div className="rounded-[1.25rem] border border-dashed border-teal-100 bg-teal-50/40 p-8 text-center">
                  <h3 className="text-xl font-black text-[#0b2447]">أضف طلابًا لهذا الفصل قبل بدء التصحيح.</h3>
                  <p className="mt-2 text-sm font-bold text-slate-400">يعتمد حفظ النتائج على ربط كل ورقة بطالب محفوظ في الفصل.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {packageResultsAssignment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" dir="rtl">
          <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-[1.5rem] bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white p-5">
              <div>
                <p className="text-sm font-extrabold text-[#159f91]">نتائج اختبار مقياس</p>
                <h2 className="mt-1 text-xl font-black text-[#0b2447]">{packageResultsAssignment.packageTitle}</h2>
                <p className="mt-1 text-sm font-bold text-slate-400">{packageResultsAssignment.className}</p>
              </div>
              <button
                onClick={() => setPackageResultsAssignment(null)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-extrabold text-slate-500 transition hover:border-[#159f91]/40 hover:text-[#159f91]"
              >
                إغلاق
              </button>
            </div>
            <div className="p-5">
              {packageResultsLoading && (
                <div className="rounded-[1.25rem] border border-dashed border-teal-100 bg-teal-50/40 p-8 text-center font-bold text-slate-500">
                  جارٍ تحميل النتائج...
                </div>
              )}
              {packageResultsError && (
                <div className="rounded-[1.25rem] border border-red-100 bg-red-50 p-4 text-sm font-bold text-red-700">
                  {packageResultsError}
                </div>
              )}
              {!packageResultsLoading && !packageResultsError && packageResults && (
                <div className="space-y-5">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl bg-slate-50 p-4">
                      <div className="text-2xl font-black text-[#0b2447]">{toEnglishDigits(packageResults.summary.studentsTestedCount)}</div>
                      <div className="mt-1 text-xs font-bold text-slate-400">طلاب تم اختبارهم</div>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-4">
                      <div className="text-2xl font-black text-[#159f91]">
                        {packageResults.summary.averagePercentage === null ? "—" : `${toEnglishDigits(packageResults.summary.averagePercentage)}٪`}
                      </div>
                      <div className="mt-1 text-xs font-bold text-slate-400">متوسط النسبة</div>
                    </div>
                  </div>

                  {packageResults.students.length ? (
                    <div className="overflow-x-auto rounded-xl border border-slate-100">
                      <table className="w-full">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="px-4 py-3 text-right text-xs font-bold text-slate-500">رقم الطالب</th>
                            <th className="px-4 py-3 text-right text-xs font-bold text-slate-500">اسم الطالب</th>
                            <th className="px-4 py-3 text-right text-xs font-bold text-slate-500">الدرجة</th>
                            <th className="px-4 py-3 text-right text-xs font-bold text-slate-500">النسبة</th>
                            <th className="px-4 py-3 text-right text-xs font-bold text-slate-500">المستوى</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {packageResults.students.map((student) => (
                            <tr key={student.id}>
                              <td className="px-4 py-3 text-sm font-black text-[#159f91]">{toEnglishDigits(student.studentCode ?? "—")}</td>
                              <td className="px-4 py-3 text-sm font-bold text-[#0b2447]">{student.studentName}</td>
                              <td className="px-4 py-3 text-sm font-bold text-slate-600">{toEnglishDigits(`${student.score}/${student.total}`)}</td>
                              <td className="px-4 py-3 text-sm font-bold text-slate-600">{toEnglishDigits(student.percentage)}٪</td>
                              <td className="px-4 py-3 text-sm font-bold text-slate-600">{student.level || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="rounded-[1.25rem] border border-dashed border-teal-100 bg-teal-50/40 p-8 text-center font-bold text-slate-500">
                      لم يتم حفظ نتائج لهذا الاختبار بعد.
                    </div>
                  )}

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-xl border border-slate-100 bg-slate-50/40 p-4">
                      <h3 className="font-black text-[#0b2447]">أضعف المهارات</h3>
                      <div className="mt-3 space-y-2">
                        {packageResults.weakestSkills.length ? packageResults.weakestSkills.map((item) => (
                          <div key={item.name} className="flex justify-between rounded-lg bg-white px-3 py-2 text-sm font-bold text-slate-600">
                            <span>{item.name}</span>
                            <span>{toEnglishDigits(`${item.wrong}/${item.total}`)}</span>
                          </div>
                        )) : <p className="text-sm font-bold text-slate-400">لا توجد مهارات ضعيفة محفوظة بعد.</p>}
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-100 bg-slate-50/40 p-4">
                      <h3 className="font-black text-[#0b2447]">أضعف مجالات نافس</h3>
                      <div className="mt-3 space-y-2">
                        {packageResults.weakestDomains.length ? packageResults.weakestDomains.map((item) => (
                          <div key={item.name} className="flex justify-between rounded-lg bg-white px-3 py-2 text-sm font-bold text-slate-600">
                            <span>{item.name}</span>
                            <span>{toEnglishDigits(`${item.wrong}/${item.total}`)}</span>
                          </div>
                        )) : <p className="text-sm font-bold text-slate-400">لا توجد مجالات ضعيفة محفوظة بعد.</p>}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showAddClass && (
        <AddClassModal
          onClose={() => setShowAddClass(false)}
          onAdd={handleAddClass}
        />
      )}

      {/* ── Header ─────────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 lg:px-8">
          <BrandLogo
            size="sm"
            contextTitle="لوحة المعلم"
            contextSubtitle={teacherSubtitle}
          />
          <button
            onClick={async () => { await supabase.auth.signOut(); router.push("/login"); }}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-extrabold text-slate-500 transition hover:border-[#159f91]/40 hover:text-[#159f91]"
          >
            خروج
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-8 px-5 py-8 lg:px-8">
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
              className="mt-4 rounded-xl bg-[#159f91] px-4 py-2 text-sm font-extrabold text-white"
            >
              إعادة المحاولة
            </button>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            VIEW: CLASSES LIST
        ══════════════════════════════════════════════════════════════════════ */}
        {view === "classes" && !pageLoading && !pageError && (
          <>
            {/* ── SECTION 1: هذا الأسبوع ──────────────────────────────────────── */}
            <section>
              <div className="mb-4">
                <p className="text-sm font-extrabold text-[#159f91]">هذا الأسبوع</p>
                <h2 className="mt-2 text-2xl font-black tracking-normal text-[#0b2447]">مهمة التقييم الحالية</h2>
              </div>
              <div className="rounded-[1.5rem] border border-teal-100 bg-white p-6 shadow-[0_10px_34px_rgba(15,35,55,0.035)]">
                {planLoading ? (
                  <div className="rounded-[1.25rem] border border-dashed border-teal-100 bg-teal-50/40 p-6 text-center">
                    <h3 className="text-xl font-black text-[#0b2447]">جارٍ تحميل خطة هذا الأسبوع...</h3>
                  </div>
                ) : weeklyPlanItem ? (
                  <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
                    <div className="min-w-0">
                      <div className="mb-2 text-sm font-black text-[#159f91]">هذا الأسبوع</div>
                      <h3 className="text-3xl font-black leading-tight text-[#0b2447]">
                        تدريب {weeklyPlanItem.plan.subject}
                      </h3>
                      <div className="mt-4 flex flex-wrap items-center gap-2 text-sm font-black text-slate-500">
                        <span>{weeklyPlanItem.plan.grade_label}</span>
                        <span className="h-1 w-1 rounded-full bg-slate-300" />
                        <span>الأسبوع {toEnglishDigits(weeklyPlanItem.plan.week_number)}</span>
                        <span className="h-1 w-1 rounded-full bg-slate-300" />
                        <span>{toEnglishDigits(weeklyPlanItem.plan.question_count)} أسئلة · تصحيح آلي</span>
                      </div>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-3 lg:w-[420px]">
                      <button
                        onClick={() => setView("packages")}
                        className="rounded-full bg-[#0b2447] px-4 py-3 text-sm font-extrabold text-white transition hover:bg-[#12345f]"
                      >
                        بدء التقييم
                      </button>
                      <button className="rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-extrabold text-slate-500 transition hover:border-[#159f91]/40 hover:text-[#159f91]" onClick={() => window.print()}>
                        طباعة الورقة
                      </button>
                      <button className="rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-extrabold text-slate-500 transition hover:border-[#159f91]/40 hover:text-[#159f91]" onClick={() => setView("packages")}>
                        عرض النتائج
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-[1.25rem] border border-dashed border-teal-100 bg-teal-50/40 p-6 text-center">
                    <h3 className="text-xl font-black text-[#0b2447]">
                      {classes.length ? "لا توجد خطة مفعّلة لهذا الأسبوع." : "أضف فصلًا للبدء في تنفيذ التقييمات."}
                    </h3>
                    <p className="mt-2 text-sm font-bold text-slate-400">
                      {classes.length ? "يمكنك عرض الخطة القادمة أو التواصل مع مدير النظام." : "بعد إضافة الفصل والطلاب ستظهر هنا مهام التقييم والتقارير."}
                    </p>
                  </div>
                )}
              </div>
            </section>

            {/* تقارير ولي الأمر انتقلت إلى حساب قائد المدرسة في checkpoint الحالي. */}

            {/* ── SECTION 3: فصولي ──────────────────────────────────────────────── */}
            <section>
              <h2 className="mb-4 text-2xl font-black tracking-normal text-[#0b2447]">فصولي</h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {classes.length === 0 && (
                  <div className="rounded-[1.5rem] border border-slate-100 bg-white p-8 text-center text-slate-400 shadow-[0_10px_34px_rgba(15,35,55,0.035)]">
                    <div className="text-4xl mb-3">🏫</div>
                    <p className="font-bold">لا توجد فصول محفوظة بعد</p>
                  </div>
                )}
                {classes.map((cls) => {
                  const students = classStudents[cls.id] ?? [];
                  const avg = calcPackageAvg(cls.id, students);
                  const classAssignments = packageAssignmentsByClass[cls.id] ?? [];
                  const selectedAssignmentId = selectedClassAssignment[cls.id] ?? classAssignments[0]?.id ?? "";
                  const selectedAssignment = classAssignments.find((item) => item.id === selectedAssignmentId);
                  return (
                    <div
                      key={cls.id}
                      className="flex flex-col gap-5 rounded-[1.5rem] border border-slate-100 bg-white p-6 shadow-[0_10px_34px_rgba(15,35,55,0.035)]"
                    >
                      {/* Class header */}
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="text-xl font-black text-[#0b2447]">{cls.name}</div>
                          <div className="mt-1 text-sm font-bold text-slate-400">{cls.subject}</div>
                        </div>
                        <button
                          title="إعدادات الفصل"
                          className="rounded-xl p-2 text-slate-300 transition hover:bg-slate-50 hover:text-[#159f91]"
                        >
                          ⚙️
                        </button>
                      </div>

                      {/* Stats */}
                      <div className="flex items-center gap-4">
                        <div className="text-center">
                          <div className="text-2xl font-black text-[#0b2447]">{toEnglishDigits(students.length)}</div>
                          <div className="text-xs font-bold text-slate-400">طالب</div>
                        </div>
                        <div className="h-10 w-px bg-slate-100" />
                        <div className="text-center">
                          {avg !== null ? (
                            <>
                              <div className="text-2xl font-bold" style={{ color: avg >= 70 ? "#1D9E75" : avg >= 50 ? "#BA7517" : "#E24B4A" }}>
                                {toEnglishDigits(avg)}٪
                              </div>
                              <div className="text-xs font-bold text-slate-400">متوسط هذا الأسبوع</div>
                            </>
                          ) : (
                            <>
                              <div className="text-2xl font-black text-slate-300">—</div>
                              <div className="text-xs font-bold text-slate-400">لا توجد درجات</div>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <button
                        onClick={() => handleViewStudents(cls.id)}
                        className="w-full rounded-xl bg-[#159f91] py-3 text-sm font-extrabold text-white shadow-[0_10px_24px_rgba(21,159,145,0.12)] transition hover:bg-[#10877b]"
                      >
                        عرض الطلاب
                      </button>
                      {classAssignments.length ? (
                        <div className="space-y-2 rounded-xl border border-teal-100 bg-teal-50/50 p-3">
                          <div className="text-xs font-extrabold text-[#159f91]">حزمة مقياس مطبقة</div>
                          {classAssignments.length > 1 && (
                            <select
                              value={selectedAssignmentId}
                              onChange={(event) => setSelectedClassAssignment((prev) => ({ ...prev, [cls.id]: event.target.value }))}
                              className="w-full rounded-xl border border-teal-100 bg-white px-3 py-2 text-sm font-bold text-[#0b2447] outline-none"
                            >
                              {classAssignments.map((assignment) => (
                                <option key={assignment.id} value={assignment.id}>{assignment.packageTitle}</option>
                              ))}
                            </select>
                          )}
                          <button
                            onClick={() => selectedAssignment && setActivePackageAssignment(selectedAssignment)}
                            className="w-full rounded-xl bg-[#0b2447] py-2.5 text-sm font-extrabold text-white transition hover:bg-[#12345f]"
                          >
                            بدء تصحيح حزمة مقياس
                          </button>
                        </div>
                      ) : (
                        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-3 text-xs font-bold leading-6 text-slate-400">
                          لا توجد حزمة مقياس مطبقة على هذا الفصل. انتقل إلى التصحيح والنتائج لتطبيق حزمة.
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Add class button */}
              <button
                onClick={() => setShowAddClass(true)}
                className="mt-5 w-full rounded-[1.25rem] border border-dashed border-[#159f91]/40 bg-white py-4 text-sm font-extrabold text-[#159f91] transition hover:bg-teal-50/50"
              >
                + إضافة فصل جديد
              </button>
            </section>
          </>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            VIEW: MIQYAS PACKAGES
        ══════════════════════════════════════════════════════════════════════ */}
        {view === "packages" && !pageLoading && !pageError && (
          <section className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-extrabold text-[#159f91]">التصحيح والنتائج</p>
                <h2 className="mt-1 text-2xl font-black tracking-normal text-[#0b2447]">مسار واحد لاعتماد نتائج مقياس</h2>
                <p className="mt-2 text-sm font-bold text-slate-400">طبّق الحزمة على الفصل، ثم صحّح بالكاميرا أو اعرض تقرير الفصل.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={loadPackageWorkflow}
                  disabled={packagesLoading}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-extrabold text-slate-500 transition hover:border-[#159f91]/40 hover:text-[#159f91] disabled:opacity-50"
                >
                  {packagesLoading ? "جارٍ التحديث..." : "تحديث"}
                </button>
                <button
                  onClick={() => setView("classes")}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-extrabold text-slate-500 transition hover:border-[#159f91]/40 hover:text-[#159f91]"
                >
                  ← العودة
                </button>
              </div>
            </div>

            {packagesError && (
              <div className="rounded-[1.25rem] border border-red-100 bg-red-50 p-4 text-sm font-bold text-red-700">
                {packagesError}
              </div>
            )}

            {packageSuccess && (
              <div className="rounded-[1.25rem] border border-teal-100 bg-teal-50 p-4 text-sm font-bold text-[#159f91]">
                {packageSuccess}
              </div>
            )}

            <div className="rounded-[1.5rem] border border-slate-100 bg-white p-5 shadow-[0_10px_34px_rgba(15,35,55,0.035)]">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-xl font-black text-[#0b2447]">الاختبارات المتاحة</h3>
                  <p className="mt-1 text-sm font-bold text-slate-400">اختبارات منشورة من إدارة مقياس ومفعّلة لمدرستك.</p>
                </div>
                <span className="rounded-full bg-slate-50 px-3 py-1 text-sm font-bold text-slate-500">
                  {toEnglishDigits(packages.length)} اختبار
                </span>
              </div>

              {packagesLoading ? (
                <div className="rounded-[1.25rem] border border-dashed border-teal-100 bg-teal-50/40 p-8 text-center font-bold text-slate-500">
                  جارٍ تحميل حزم مقياس...
                </div>
              ) : packages.length ? (
                <div className="grid gap-4 lg:grid-cols-2">
                  {packages.map((item) => {
                    const selectedClassId = selectedPackageClasses[item.id] ?? item.matchingClasses[0]?.id ?? "";
                    const hasMatchingClass = item.matchingClasses.length > 0;
                    return (
                      <div key={item.id} className="rounded-[1.25rem] border border-slate-100 bg-slate-50/40 p-5">
                        <div className="mb-4 flex items-start justify-between gap-3">
                          <div>
                            <div className="text-xs font-extrabold text-[#159f91]">
                              {packageTypeLabel(item.package_type)} | الأسبوع {toEnglishDigits(item.week_number ?? "—")}
                            </div>
                            <h4 className="mt-1 text-lg font-black text-[#0b2447]">{item.title}</h4>
                            <p className="mt-1 text-sm font-bold text-slate-400">
                              {item.subject} | الصف {toEnglishDigits(item.grade)} | {packageDateLabel(item)}
                            </p>
                          </div>
                          <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-500">
                            {toEnglishDigits(item.question_count)} سؤال
                          </span>
                        </div>

                        <div className="mb-4 flex flex-wrap gap-2">
                          {[
                            { label: "تحميل ملف الأسئلة PDF", url: item.questions_pdf_url ?? item.student_pdf_url },
                            ...(item.answer_sheet_pdf_url ? [{ label: "تحميل ورقة الإجابة", url: item.answer_sheet_pdf_url }] : []),
                          ].map((link) => (
                            link.url ? (
                              <a
                                key={link.label}
                                href={link.url}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-extrabold text-slate-500 transition hover:border-[#159f91]/40 hover:text-[#159f91]"
                              >
                                {link.label}
                              </a>
                            ) : (
                              <button
                                key={link.label}
                                disabled
                                className="rounded-xl border border-slate-100 bg-white px-3 py-2 text-xs font-extrabold text-slate-300"
                              >
                                {link.label}
                              </button>
                            )
                          ))}
                        </div>

                        {hasMatchingClass ? (
                          <div className="flex flex-col gap-3 sm:flex-row">
                            <select
                              value={selectedClassId}
                              onChange={(event) => setSelectedPackageClasses((prev) => ({ ...prev, [item.id]: event.target.value }))}
                              className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-[#0b2447] outline-none focus:border-[#159f91]"
                            >
                              {item.matchingClasses.map((classItem) => (
                                <option key={classItem.id} value={classItem.id}>{classItem.name}</option>
                              ))}
                            </select>
                            <button
                              onClick={() => handleApplyPackage(item)}
                              disabled={!selectedClassId || applyingPackageId === item.id}
                              className="rounded-xl bg-[#159f91] px-4 py-2 text-sm font-extrabold text-white transition hover:bg-[#10877b] disabled:opacity-50"
                            >
                              {applyingPackageId === item.id ? "جارٍ التطبيق..." : "تطبيق على فصل"}
                            </button>
                          </div>
                        ) : (
                          <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-700">
                            أضف فصلًا مطابقًا للصف والمادة لتطبيق هذا الاختبار.
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-[1.25rem] border border-dashed border-teal-100 bg-teal-50/40 p-8 text-center">
                  <h3 className="text-xl font-black text-[#0b2447]">لا توجد اختبارات منشورة حاليًا من إدارة مقياس.</h3>
                  <p className="mt-2 text-sm font-bold text-slate-400">ستظهر هنا الحزم الأسبوعية عند نشرها وتفعيلها لمدرستك.</p>
                </div>
              )}
            </div>

            <div className="rounded-[1.5rem] border border-slate-100 bg-white p-5 shadow-[0_10px_34px_rgba(15,35,55,0.035)]">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-xl font-black text-[#0b2447]">اختبارات فصولي</h3>
                  <p className="mt-1 text-sm font-bold text-slate-400">الحزم التي تم تطبيقها على فصولك.</p>
                </div>
                <span className="rounded-full bg-slate-50 px-3 py-1 text-sm font-bold text-slate-500">
                  {toEnglishDigits(packageAssignments.length)} تعيين
                </span>
              </div>

              {packagesLoading ? (
                <div className="rounded-[1.25rem] border border-dashed border-teal-100 bg-teal-50/40 p-8 text-center font-bold text-slate-500">
                  جارٍ تحميل اختبارات الفصول...
                </div>
              ) : packageAssignments.length ? (
                <div className="grid gap-4 lg:grid-cols-2">
                  {packageAssignments.map((item) => {
                    const studentCount = classStudents[item.classId]?.length ?? 0;
                    return (
                      <div key={item.id} className="rounded-[1.25rem] border border-slate-100 bg-slate-50/40 p-5">
                        <div className="mb-4 flex items-start justify-between gap-3">
                          <div>
                            <div className="text-xs font-extrabold text-[#159f91]">
                              {item.className} | الأسبوع {toEnglishDigits(item.weekNumber ?? "—")}
                            </div>
                            <h4 className="mt-1 text-lg font-black text-[#0b2447]">{item.packageTitle}</h4>
                            <p className="mt-1 text-sm font-bold text-slate-400">
                              {item.subject} | الصف {toEnglishDigits(item.grade ?? "—")} | {packageDateLabel(item)}
                            </p>
                          </div>
                          <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-[#159f91]">
                            {packageStatusLabel(item.status)}
                          </span>
                        </div>

                        <div className="mb-4 flex flex-wrap gap-2">
                          <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-500">
                            {toEnglishDigits(item.questionCount)} سؤال
                          </span>
                          <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-500">
                            {toEnglishDigits(studentCount)} طالب
                          </span>
                        </div>

                        <div className="mb-4 flex flex-wrap gap-2">
                          {[
                            { label: "تحميل ملف الأسئلة PDF", url: item.studentPdfUrl },
                            ...(item.answerSheetPdfUrl ? [{ label: "تحميل ورقة الإجابة", url: item.answerSheetPdfUrl }] : []),
                          ].map((link) => (
                            link.url ? (
                              <a
                                key={link.label}
                                href={link.url}
                                target="_blank"
                                rel="noreferrer"
                                onClick={() => void markPackagePrinted(item.id)}
                                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-extrabold text-slate-500 transition hover:border-[#159f91]/40 hover:text-[#159f91]"
                              >
                                {link.label}
                              </a>
                            ) : (
                              <button
                                key={link.label}
                                disabled
                                className="rounded-xl border border-slate-100 bg-white px-3 py-2 text-xs font-extrabold text-slate-300"
                              >
                                {link.label}
                              </button>
                            )
                          ))}
                        </div>

                        <div className="flex flex-wrap gap-3">
                          <button
                            onClick={() => setActivePackageAssignment(item)}
                            disabled={!studentCount}
                            className="rounded-xl bg-[#0b2447] px-4 py-2 text-sm font-extrabold text-white transition hover:bg-[#12345f] disabled:opacity-50"
                          >
                            تصحيح بالكاميرا
                          </button>
                          <button
                            disabled
                            title="سيتوفر الإدخال اليدوي المنظم داخل هذا المسار لاحقًا"
                            className="rounded-xl border border-slate-100 bg-white px-4 py-2 text-sm font-extrabold text-slate-300"
                          >
                            إدخال يدوي
                          </button>
                          <button
                            onClick={() => void openPackageResults(item)}
                            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-extrabold text-slate-500 transition hover:border-[#159f91]/40 hover:text-[#159f91]"
                          >
                            عرض تقرير الفصل
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-[1.25rem] border border-dashed border-teal-100 bg-teal-50/40 p-8 text-center">
                  <h3 className="text-xl font-black text-[#0b2447]">لم يتم تطبيق أي اختبار على فصولك بعد.</h3>
                  <p className="mt-2 text-sm font-bold text-slate-400">اختر اختبارًا منشورًا ثم طبّقه على فصل مطابق للبدء.</p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            VIEW: WEEKLY PLANS
        ══════════════════════════════════════════════════════════════════════ */}
        {view === "weeklyPlans" && !pageLoading && !pageError && (
          <section className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-extrabold text-[#159f91]">الخطة الأسبوعية</p>
                <h2 className="mt-1 text-2xl font-black tracking-normal text-[#0b2447]">خطة الأسابيع لفصولي</h2>
              </div>
              <button
                onClick={() => setView("classes")}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-extrabold text-slate-500 transition hover:border-[#159f91]/40 hover:text-[#159f91]"
              >
                ← العودة للفصول
              </button>
            </div>

            {planLoading ? (
              <div className="rounded-[1.5rem] border border-slate-100 bg-white p-8 text-center font-bold text-slate-500 shadow-[0_10px_34px_rgba(15,35,55,0.035)]">
                جارٍ تحميل خطة الأسابيع...
              </div>
            ) : allPlanItems.length ? (
              <div className="grid gap-4 md:grid-cols-2">
                {allPlanItems.map((item) => (
                  <div key={`${item.class.id}-${item.plan.id}`} className="rounded-[1.5rem] border border-slate-100 bg-white p-5 shadow-[0_10px_34px_rgba(15,35,55,0.035)]">
                    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-bold text-slate-400">الأسبوع {toEnglishDigits(item.plan.week_number)}</div>
                        <h3 className="mt-1 text-xl font-black text-[#0b2447]">{item.plan.skill}</h3>
                      </div>
                      <span className="rounded-full bg-teal-50 px-3 py-1 text-sm font-bold text-[#159f91]">
                        {difficultyLabel(item.plan.difficulty_level)}
                      </span>
                    </div>
                    <p className="text-sm font-bold leading-7 text-slate-500">
                      {item.plan.learning_goal ?? "هدف التعلم قابل للتحديث من الإدارة."}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-bold text-slate-500">{item.class.name}</span>
                      <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-bold text-slate-500">{item.plan.grade_label}</span>
                      <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-bold text-slate-500">{item.plan.subject}</span>
                      <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-bold text-slate-500">
                        {formatSchoolDateRange({
                          startDate: item.plan.start_date,
                          endDate: item.plan.end_date,
                          startHijri: item.plan.start_hijri,
                          endHijri: item.plan.end_hijri,
                        })}
                      </span>
                      <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-bold text-slate-500">
                        {toEnglishDigits(item.plan.question_count)} أسئلة
                      </span>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-3">
                      <button
                        onClick={() => handleViewStudents(item.class.id)}
                        className="rounded-xl bg-[#159f91] px-4 py-2 text-sm font-extrabold text-white transition hover:bg-[#10877b]"
                      >
                        بدء التقييم
                      </button>
                      <button
                        onClick={() => window.print()}
                        className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-extrabold text-slate-500 transition hover:border-[#159f91]/40 hover:text-[#159f91]"
                      >
                        طباعة ورقة الاختبار
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-[1.5rem] border border-dashed border-teal-100 bg-white p-8 text-center shadow-[0_10px_34px_rgba(15,35,55,0.035)]">
                <h3 className="text-xl font-black text-[#0b2447]">لا توجد خطة مفعّلة لهذا الأسبوع.</h3>
                <p className="mt-2 text-sm font-bold text-slate-400">
                  يمكنك التواصل مع مدير النظام لتفعيل خطة الصفوف 3-6 في مواد مقياس الحالية.
                </p>
              </div>
            )}
          </section>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            VIEW: STUDENT LIST
        ══════════════════════════════════════════════════════════════════════ */}
        {view === "students" && activeClass && !pageLoading && !pageError && (
          <>
            {/* Back button + heading */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleBackToClasses}
                className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-extrabold text-slate-500 transition hover:border-[#159f91]/40 hover:text-[#159f91]"
              >
                ← فصولي
              </button>
              <h2 className="text-2xl font-black text-[#0b2447]">{activeClass.name}</h2>
              <span className="text-sm font-bold text-slate-400">{activeClass.subject}</span>
            </div>

            {/* Report / print actions */}
            <div className="rounded-[1.5rem] border border-teal-100 bg-white p-5 shadow-[0_10px_34px_rgba(15,35,55,0.035)]">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <div className="text-sm font-bold text-slate-400 mb-0.5">مهمة هذا الأسبوع</div>
                  <div className="font-black text-[#0b2447]">
                    {activeClassPlanItem
                      ? `${activeClassPlanItem.plan.assessment_title} — ${activeClassPlanItem.plan.skill}`
                      : `${activeClass.name} — ${activeClass.subject || teacherProfile?.subject || "مادة غير محددة"}`}
                  </div>
                  {activeClassPlanItem && (
                    <p className="mt-1 text-xs font-bold text-slate-400">
                      الأسبوع {toEnglishDigits(activeClassPlanItem.plan.week_number)} | {toEnglishDigits(activeClassPlanItem.plan.question_count)} أسئلة
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <button
                    onClick={generateReport}
                    disabled={activeStudents.every((s) => s.score === 0)}
                    className="flex items-center gap-2 rounded-xl bg-[#0b2447] px-4 py-2.5 text-sm font-extrabold text-white transition hover:bg-[#12345f] disabled:opacity-50"
                  >
                    توليد تقرير الفصل
                  </button>
                  <button className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-extrabold text-slate-500 transition hover:border-[#159f91]/40 hover:text-[#159f91]" onClick={() => window.print()}>
                    طباعة
                  </button>
                </div>
              </div>
            </div>

            {/* Student table */}
            <div className="overflow-hidden rounded-[1.5rem] border border-slate-100 bg-white shadow-[0_10px_34px_rgba(15,35,55,0.035)]">
              <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h3 className="font-black text-[#0b2447]">قائمة الطلاب</h3>
                  <p className="mt-0.5 text-sm font-bold text-slate-400">{toEnglishDigits(activeStudents.length)} طالب</p>
                </div>
                {/* Add students button */}
                <button
                  onClick={() => { setShowAddStudents(true); setAddStudentMode("choice"); }}
                  className="rounded-xl bg-[#159f91] px-4 py-2 text-sm font-extrabold text-white transition hover:bg-[#10877b]"
                >
                  + إضافة طلاب
                </button>
              </div>
              {activeStudents.length === 0 ? (
                <div className="py-12 text-center text-gray-400">
                  <div className="text-4xl mb-3">👥</div>
                  <p className="font-medium">لا يوجد طلاب بعد — أضف طلاباً</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">#</th>
                        <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">رقم الطالب</th>
                        <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">اسم الطالب</th>
                        <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">آخر درجة</th>
                        <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">المستوى</th>
                        <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">إجراء</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {activeStudents.map((s, i) => {
                        const packageScore = activeClass ? getStudentPackageScore(activeClass.id, s.id) : null;
                        return (
                          <tr key={s.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-gray-400 text-sm">{toEnglishDigits(i + 1)}</td>
                            <td className="px-4 py-3">
                              <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-black text-[#159f91]">
                                رقم الطالب: {toEnglishDigits(s.studentCode ?? i + 1)}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-medium text-gray-900">{s.name}</td>
                            <td className="px-4 py-3">
                              {packageScore ? (
                                <div>
                                  <span className="font-bold text-gray-900">{toEnglishDigits(packageScore.score)}</span>
                                  <span className="text-gray-400">/{toEnglishDigits(packageScore.total)}</span>
                                  <span className="mr-2 text-xs font-bold text-slate-400">({toEnglishDigits(packageScore.percentage)}٪)</span>
                                </div>
                              ) : (
                                <span className="text-gray-300 text-sm">لم يقيم بعد</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {packageScore ? (
                                packageScore.level
                                  ? <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-black text-[#159f91]">{packageScore.level}</span>
                                  : <LevelBadge score={packageScore.score} total={packageScore.total} />
                              ) : <span className="text-gray-300 text-sm">—</span>}
                            </td>
                            <td className="px-4 py-3 text-xs font-bold text-slate-300">—</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Add students panel */}
            {showAddStudents && (
              <div className="rounded-[1.5rem] border border-slate-100 bg-white p-5 shadow-[0_10px_34px_rgba(15,35,55,0.035)]">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-gray-900">إضافة طلاب</h3>
                  <button onClick={() => { setShowAddStudents(false); setAddStudentMode("choice"); setManualNames(""); }} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
                </div>

                {addStudentMode === "choice" && (
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={() => setAddStudentMode("import")}
                      className="flex-1 py-4 rounded-xl border-2 font-bold text-sm hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                      style={{ borderColor: "#7F77DD", color: "#7F77DD" }}
                    >
                      📷 تصوير كشف الأسماء
                    </button>
                    <button
                      onClick={() => setAddStudentMode("manual")}
                      className="flex-1 py-4 rounded-xl border-2 font-bold text-sm hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                      style={{ borderColor: "#1D9E75", color: "#1D9E75" }}
                    >
                      ✏️ إضافة يدوي
                    </button>
                  </div>
                )}

                {addStudentMode === "import" && (
                  <StudentImportFlow
                    initialNames={activeStudents.map((student) => student.name)}
                    onSave={handleImportSave}
                  />
                )}

                {addStudentMode === "manual" && (
                  <div className="space-y-3">
                    {studentSaveError && (
                      <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                        {studentSaveError}
                      </div>
                    )}
                    <p className="text-sm text-gray-600">أدخل اسماً في كل سطر:</p>
                    <textarea
                      value={manualNames}
                      onChange={(e) => setManualNames(e.target.value)}
                      rows={6}
                      placeholder={"اسم الطالب الأول\nاسم الطالب الثاني\nاسم الطالب الثالث"}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 resize-y"
                      style={{ direction: "rtl" }}
                    />
                    <div className="flex gap-3">
                      <button
                        onClick={handleManualSave}
                        disabled={!manualNames.trim() || manualSaving}
                        className="px-5 py-2.5 rounded-lg text-white text-sm font-bold hover:opacity-90 disabled:opacity-50"
                        style={{ background: "#1D9E75" }}
                      >
                        {manualSaving ? "جارٍ الحفظ..." : "حفظ"}
                      </button>
                      <button
                        onClick={() => setAddStudentMode("choice")}
                        className="px-5 py-2.5 rounded-lg border text-gray-600 text-sm font-medium hover:bg-gray-50"
                      >
                        رجوع
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

          </>
        )}
      </main>
    </div>
  );
}
