import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { toEnglishDigits, normalizeName } from "@/lib/format";
import { normalizeSubject } from "@/lib/subjects";
import { getLevel } from "@/lib/levels";
import { gradeLabel } from "@/lib/labels";
import type {
  AssignmentStudentScores,
  ClassItem,
  ClassReport,
  ClassStudentsMap,
  PackageResultDetails,
  SkillDiagnosisDetails,
  Student,
  TeacherPackage,
  TeacherPackageAssignment,
  TeacherProfile,
  View,
  WeeklyPlanItem,
} from "./types";

export function useTeacherDashboard() {
  const router = useRouter();

  // ── View state ──────────────────────────────────────────────────────────────
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

  // ── Package workflow state ───────────────────────────────────────────
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
  const [skillDiagnosis, setSkillDiagnosis] = useState<SkillDiagnosisDetails | null>(null);
  const [assignmentStudentScores, setAssignmentStudentScores] = useState<AssignmentStudentScores>({});
  const [packageResultsLoading, setPackageResultsLoading] = useState(false);
  const [packageResultsError, setPackageResultsError] = useState<string | null>(null);
  const [skillDiagnosisError, setSkillDiagnosisError] = useState<string | null>(null);
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

  const packageDateLabel = (item: { start_date?: string | null; end_date?: string | null; startDate?: string | null; endDate?: string | null }) => {
    const start = item.start_date ?? item.startDate;
    const end = item.end_date ?? item.endDate;
    if (!start || !end) return "تاريخ غير محدد";
    return `${toEnglishDigits(start)} - ${toEnglishDigits(end)}`;
  };

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
        throw new Error(packagesJson.error || "تعذر تحميل اختبارات دالا");
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
      setPackagesError(err instanceof Error ? err.message : "تعذر تحميل اختبارات دالا");
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
          grade: gradeLabel(reportClass.grade),
          subject: reportClass.subject || teacherProfile?.subject || "غير محدد",
          results: activeStudents
            .filter((s) => s.score > 0)
            .map((s) => ({ name: s.name, score: s.score, total: s.total, level: getLevel(s.score, s.total) })),
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
    const existingNames = new Set(existing.map((student) => normalizeName(student.name)));
    const newNames = names
      .map((name) => name.trim().replace(/\s+/g, " "))
      .filter(Boolean)
      .filter((name) => !existingNames.has(normalizeName(name)));

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
      throw new Error("لم يتم العثور على طلاب مطابقين لحفظ نتائج اختبار دالا");
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

    const didReloadResults = await openPackageResults(activePackageAssignment);
    if (!didReloadResults) {
      setPackageResultsAssignment(null);
      setPackageSuccess("تم حفظ النتائج، لكن تعذر تحديث عرض النتائج. حدّث الصفحة أو حاول مرة أخرى.");
      await loadPackageWorkflow();
      return;
    }

    setPackageSuccess("تم حفظ نتائج اختبار دالا بنجاح.");
    setActivePackageAssignment(null);
    await loadPackageWorkflow();
  };

  const openPackageResults = async (assignment: TeacherPackageAssignment) => {
    setPackageResultsAssignment(assignment);
    setPackageResults(null);
    setSkillDiagnosis(null);
    setPackageResultsError(null);
    setSkillDiagnosisError(null);
    setPackageResultsLoading(true);
    try {
      const [resultsRes, diagnosisRes] = await Promise.all([
        fetch(`/api/teacher/class-package-assignments/${assignment.id}/results`, { cache: "no-store" }),
        fetch(`/api/teacher/class-package-assignments/${assignment.id}/skill-diagnosis`, { cache: "no-store" }),
      ]);
      const resultsJson = await resultsRes.json().catch(() => ({}));
      if (!resultsRes.ok || !resultsJson.success) throw new Error(resultsJson.error || "تعذر تحميل نتائج الاختبار");
      setPackageResults(resultsJson.data as PackageResultDetails);

      const diagnosisJson = await diagnosisRes.json().catch(() => ({}));
      if (diagnosisRes.ok && diagnosisJson.success) {
        setSkillDiagnosis(diagnosisJson.data as SkillDiagnosisDetails);
      } else {
        setSkillDiagnosisError(diagnosisJson.error || "تعذر تحميل التحليل المهاري");
      }
      return true;
    } catch (err) {
      setPackageResultsError(err instanceof Error ? err.message : "تعذر تحميل نتائج الاختبار");
      return false;
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

  return {
    router,
    view,
    setView,
    activeClassId,
    setActiveClassId,
    classes,
    setClasses,
    classStudents,
    setClassStudents,
    showAddClass,
    setShowAddClass,
    teacherProfile,
    setTeacherProfile,
    pageLoading,
    setPageLoading,
    pageError,
    setPageError,
    studentSaveError,
    setStudentSaveError,
    manualSaving,
    setManualSaving,
    currentPlans,
    setCurrentPlans,
    upcomingPlans,
    setUpcomingPlans,
    setPlanSource,
    planLoading,
    setPlanLoading,
    packages,
    setPackages,
    packageAssignments,
    setPackageAssignments,
    packagesLoading,
    setPackagesLoading,
    packagesError,
    setPackagesError,
    selectedPackageClasses,
    setSelectedPackageClasses,
    applyingPackageId,
    setApplyingPackageId,
    packageSuccess,
    setPackageSuccess,
    activePackageAssignment,
    setActivePackageAssignment,
    packageResultsAssignment,
    setPackageResultsAssignment,
    packageResults,
    setPackageResults,
    skillDiagnosis,
    setSkillDiagnosis,
    assignmentStudentScores,
    setAssignmentStudentScores,
    packageResultsLoading,
    setPackageResultsLoading,
    packageResultsError,
    setPackageResultsError,
    skillDiagnosisError,
    setSkillDiagnosisError,
    selectedClassAssignment,
    setSelectedClassAssignment,
    showAddStudents,
    setShowAddStudents,
    addStudentMode,
    setAddStudentMode,
    manualNames,
    setManualNames,
    reportOpen,
    setReportOpen,
    report,
    setReport,
    reportLoading,
    setReportLoading,
    reportError,
    setReportError,
    activeClass,
    activeStudents,
    allPlanItems,
    weeklyPlanItem,
    activeClassPlanItem,
    weeklyClass,
    teacherDisplayName,
    teacherSubtitle,
    activePackageStudents,
    packageAssignmentsByClass,
    getSelectedAssignmentForClass,
    getStudentPackageScore,
    calcPackageAvg,
    packageDateLabel,
    mapStudentRow,
    loadTeacherData,
    loadCurrentPlan,
    loadPackageWorkflow,
    generateReport,
    saveStudents,
    handleImportSave,
    handleManualSave,
    handleApplyPackage,
    handlePackageScanComplete,
    openPackageResults,
    markPackagePrinted,
    handleAddClass,
    handleViewStudents,
    handleBackToClasses,
  };
}

export type TeacherDashboardState = ReturnType<typeof useTeacherDashboard>;
