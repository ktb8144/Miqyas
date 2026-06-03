import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { scanAnswerSheet, scanQuestionPaperAnswers } from "@/lib/gemini";
import { getLevel } from "@/lib/demo-data";
import { getAdminClient, requireUserRole } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const VALID_ANSWERS = new Set(["أ", "ب", "ج", "د"]);
const VALID_EMPTY_ANSWERS = new Set(["blank", "unclear"]);
const DEBUG_SCAN =
  process.env.NODE_ENV !== "production" || process.env.DEBUG_SCAN === "true";

type AssignmentRow = {
  id: string;
  package_id: string;
  school_id: string;
  class_id: string;
  teacher_id: string;
  status: string;
};

type PackageRow = {
  id: string;
  status: string;
  subject: string;
  grade: number;
};

type PackageQuestionRow = {
  id: string;
  package_id: string;
  question_number: number;
  correct_option: string;
  nafs_domain_id: string | null;
  skill_id: string | null;
  domain_text?: string | null;
  skill_text?: string | null;
  difficulty_level: string;
  points: number | string;
  learning_skills?: { skill_name?: string | null; skill_code?: string | null } | null;
  nafs_domains?: { domain_name?: string | null; domain_code?: string | null } | null;
};

type GradedQuestion = {
  questionKey: string;
  selectedOption: string;
  isCorrect: boolean;
  points: number;
  packageQuestion: PackageQuestionRow;
};

type GradedResult = {
  studentName: string;
  answers: Record<string, string>;
  score: number;
  total: number;
  percentage: number;
  level: string;
  weakSkills: Array<{
    question: string;
    skill: string;
    domain: string;
    difficultyLevel: string;
  }>;
  gradedQuestions: GradedQuestion[];
};

type ScanDebugInfo = {
  scanMode: "answer_sheet" | "question_paper";
  classPackageAssignmentId: string;
  totalQuestions: number;
  packageQuestionCount: number;
  didGeminiReturnText: boolean;
  didParseJson: boolean;
  detectedAnswerCount: number;
  errorStage?: string;
  rawResponsePreview?: string;
};

const scanSchema = z.object({
  classPackageAssignmentId: z.string().uuid(),
  imageBase64: z.string().min(100).optional(),
  mimeType: z.string().trim().min(1).default("image/jpeg"),
  scanMode: z.enum(["answer_sheet", "question_paper"]).optional().default("answer_sheet"),
  studentAnswers: z.record(z.string()).optional(),
  save: z.boolean().optional().default(false),
  studentId: z.string().uuid().optional(),
}).refine((value) => value.imageBase64 || value.studentAnswers, {
  message: "imageBase64 or studentAnswers is required",
}).refine((value) => !value.save || Boolean(value.studentId), {
  message: "studentId is required when save is true",
});

function normalizeAnswer(value: unknown) {
  if (typeof value !== "string") return "unclear";
  const answer = value.trim();
  if (VALID_ANSWERS.has(answer)) return answer;
  if (VALID_EMPTY_ANSWERS.has(answer)) return answer;
  return "unclear";
}

function normalizePoints(value: number | string) {
  const points = Number(value);
  return Number.isFinite(points) && points > 0 ? points : 1;
}

function countDetectedAnswers(scanned: Record<string, string>, totalQuestions: number) {
  const explicitCount = Number(scanned._detectedAnswerCount);
  if (Number.isFinite(explicitCount)) return explicitCount;
  let count = 0;
  for (let i = 1; i <= totalQuestions; i++) {
    const value = scanned[`q${i}`];
    if (value && ["أ", "ب", "ج", "د", "unclear"].includes(value)) count += 1;
  }
  return count;
}

function buildScanDebug({
  body,
  totalQuestions,
  scanned,
  detectedAnswerCount,
  errorStage,
}: {
  body: z.infer<typeof scanSchema>;
  totalQuestions: number;
  scanned?: Record<string, string>;
  detectedAnswerCount: number;
  errorStage?: string;
}): ScanDebugInfo {
  return {
    scanMode: body.scanMode,
    classPackageAssignmentId: body.classPackageAssignmentId,
    totalQuestions,
    packageQuestionCount: totalQuestions,
    didGeminiReturnText: scanned?._geminiReturnedText === "true",
    didParseJson: scanned?._parseableJson === "true",
    detectedAnswerCount,
    errorStage,
    rawResponsePreview: scanned?._rawTextPreview,
  };
}

function scanLogPayload(debug: ScanDebugInfo) {
  return {
    scanMode: debug.scanMode,
    classPackageAssignmentId: debug.classPackageAssignmentId,
    packageQuestionCount: debug.packageQuestionCount,
    detectedAnswerCount: debug.detectedAnswerCount,
    didGeminiReturnText: debug.didGeminiReturnText,
    didParseJson: debug.didParseJson,
    errorStage: debug.errorStage,
    rawResponsePreview: debug.rawResponsePreview,
  };
}

function debugResponse(debug: ScanDebugInfo) {
  return DEBUG_SCAN ? { debug } : {};
}

function logScanFailure({
  errorStage,
  message,
  classPackageAssignmentId,
  detectedAnswerCount,
}: {
  errorStage: string;
  message: string;
  classPackageAssignmentId: string;
  detectedAnswerCount?: number;
}) {
  console.warn("scan-package-omr failed", {
    errorStage,
    message,
    detectedAnswerCount,
    classPackageAssignmentId,
  });
}

async function loadPackageQuestionsForAssignment(classPackageAssignmentId: string, profile: { id: string; school_id?: string | null }) {
  const db = getAdminClient();

  const { data: assignment, error: assignmentError } = await db
    .from("class_package_assignments")
    .select("id, package_id, school_id, class_id, teacher_id, status")
    .eq("id", classPackageAssignmentId)
    .maybeSingle();

  if (assignmentError) throw assignmentError;
  if (!assignment) {
    return { error: "لم يتم العثور على تعيين الحزمة لهذا الفصل" as const, status: 404 as const };
  }

  const assignmentRow = assignment as AssignmentRow;
  if (assignmentRow.school_id !== profile.school_id || assignmentRow.teacher_id !== profile.id) {
    return { error: "ليست لديك صلاحية لتصحيح هذه الحزمة" as const, status: 403 as const };
  }

  if (assignmentRow.status === "withdrawn") {
    return { error: "تم سحب هذه الحزمة ولا يمكن تصحيحها" as const, status: 403 as const };
  }

  const { data: classRow, error: classError } = await db
    .from("classes")
    .select("id")
    .eq("id", assignmentRow.class_id)
    .eq("school_id", assignmentRow.school_id)
    .eq("teacher_id", profile.id)
    .maybeSingle();

  if (classError) throw classError;
  if (!classRow) {
    return { error: "الفصل غير مرتبط بحساب المعلم الحالي" as const, status: 403 as const };
  }

  const { data: packageRow, error: packageError } = await db
    .from("assessment_packages")
    .select("id, status, subject, grade")
    .eq("id", assignmentRow.package_id)
    .maybeSingle();

  if (packageError) throw packageError;
  if (!packageRow) {
    return { error: "لم يتم العثور على حزمة التقييم" as const, status: 404 as const };
  }

  const assessmentPackage = packageRow as PackageRow;
  if (assessmentPackage.status !== "published") {
    return { error: "حزمة التقييم غير منشورة بعد" as const, status: 400 as const };
  }

  const { data: schoolAssignment, error: schoolAssignmentError } = await db
    .from("school_package_assignments")
    .select("id")
    .eq("package_id", assignmentRow.package_id)
    .eq("school_id", assignmentRow.school_id)
    .in("status", ["available", "active", "completed"])
    .limit(1)
    .maybeSingle();

  if (schoolAssignmentError) throw schoolAssignmentError;
  if (!schoolAssignment) {
    return { error: "هذه الحزمة غير مفعّلة لهذه المدرسة" as const, status: 403 as const };
  }

  const { data: questions, error: questionsError } = await db
    .from("package_questions")
    .select(`
      id,
      package_id,
      question_number,
      correct_option,
      nafs_domain_id,
      skill_id,
      domain_text,
      skill_text,
      difficulty_level,
      points,
      learning_skills(skill_name, skill_code),
      nafs_domains(domain_name, domain_code)
    `)
    .eq("package_id", assignmentRow.package_id)
    .order("question_number", { ascending: true });

  if (questionsError) throw questionsError;

  const packageQuestions = (questions ?? []) as PackageQuestionRow[];
  if (!packageQuestions.length) {
    return { error: "لا توجد خريطة أسئلة لهذه الحزمة" as const, status: 404 as const };
  }

  return {
    assignment: assignmentRow,
    assessmentPackage,
    questions: packageQuestions,
  };
}

function gradePackageAnswers(studentAnswers: Record<string, string>, questions: PackageQuestionRow[], studentName = ""): GradedResult {
  const answers: Record<string, string> = {};
  const weakSkills: GradedResult["weakSkills"] = [];
  const gradedQuestions: GradedQuestion[] = [];
  let score = 0;
  let total = 0;

  questions.forEach((question) => {
    const qKey = `q${question.question_number}`;
    const selectedOption = normalizeAnswer(studentAnswers[qKey]);
    const points = normalizePoints(question.points);
    const isCorrect = selectedOption === question.correct_option;

    total += points;
    if (isCorrect) score += points;
    answers[qKey] = selectedOption;

    if (!isCorrect) {
      weakSkills.push({
        question: qKey,
        skill: question.learning_skills?.skill_name || question.skill_text || "مهارة غير محددة",
        domain: question.nafs_domains?.domain_name || question.domain_text || "مجال غير محدد",
        difficultyLevel: question.difficulty_level,
      });
    }

    gradedQuestions.push({
      questionKey: qKey,
      selectedOption,
      isCorrect,
      points,
      packageQuestion: question,
    });
  });

  const percentage = total ? Math.round((score / total) * 100) : 0;

  return {
    studentName,
    answers,
    score,
    total,
    percentage,
    level: getLevel(score, total),
    weakSkills,
    gradedQuestions,
  };
}

async function savePackageResult({
  assignment,
  graded,
  studentId,
}: {
  assignment: AssignmentRow;
  graded: GradedResult;
  studentId: string;
}) {
  const db = getAdminClient();
  const now = new Date().toISOString();

  const { data: student, error: studentError } = await db
    .from("students")
    .select("id")
    .eq("id", studentId)
    .eq("school_id", assignment.school_id)
    .eq("class_id", assignment.class_id)
    .maybeSingle();

  if (studentError) throw studentError;
  if (!student) {
    return { error: "الطالب غير مرتبط بهذا الفصل" as const, status: 400 as const };
  }

  const resultPayload = {
    class_package_assignment_id: assignment.id,
    package_id: assignment.package_id,
    student_id: studentId,
    school_id: assignment.school_id,
    class_id: assignment.class_id,
    teacher_id: assignment.teacher_id,
    score: graded.score,
    total: graded.total,
    percentage: graded.percentage,
    level: graded.level,
    scanned_at: now,
  };

  const { data: existingResult, error: existingError } = await db
    .from("student_package_results")
    .select("id")
    .eq("class_package_assignment_id", assignment.id)
    .eq("student_id", studentId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingError) throw existingError;

  let resultId = existingResult?.id as string | undefined;
  if (resultId) {
    const { error: updateError } = await db
      .from("student_package_results")
      .update(resultPayload)
      .eq("id", resultId);
    if (updateError) throw updateError;
  } else {
    const { data: insertedResult, error: insertError } = await db
      .from("student_package_results")
      .insert(resultPayload)
      .select("id")
      .single();
    if (insertError) throw insertError;
    resultId = insertedResult.id as string;
  }

  const { error: deleteOldError } = await db
    .from("student_question_results")
    .delete()
    .eq("student_package_result_id", resultId);

  if (deleteOldError) throw deleteOldError;

  const questionRows = graded.gradedQuestions.map((question) => ({
    student_package_result_id: resultId,
    package_question_id: question.packageQuestion.id,
    package_id: assignment.package_id,
    student_id: studentId,
    selected_option: question.selectedOption,
    correct_option: question.packageQuestion.correct_option,
    is_correct: question.isCorrect,
    nafs_domain_id: question.packageQuestion.nafs_domain_id,
    skill_id: question.packageQuestion.skill_id,
  }));

  if (questionRows.length) {
    const { error: insertQuestionsError } = await db
      .from("student_question_results")
      .insert(questionRows);
    if (insertQuestionsError) throw insertQuestionsError;
  }

  const { error: assignmentUpdateError } = await db
    .from("class_package_assignments")
    .update({ scanned_at: now, status: "scanned" })
    .eq("id", assignment.id);

  if (assignmentUpdateError) throw assignmentUpdateError;

  return { resultId };
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireUserRole(req, ["teacher"]);
    if (!auth.ok) {
      return NextResponse.json(
        { success: false, error: auth.error, errorCode: "PERMISSION_DENIED" },
        { status: auth.status }
      );
    }

    const parsed = scanSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "يرجى إرفاق بيانات الحزمة وصورة الورقة أو إجابات الطالب",
          errorCode: "INVALID_SCAN_RESPONSE",
        },
        { status: 400 }
      );
    }

    const body = parsed.data;
    const loaded = await loadPackageQuestionsForAssignment(body.classPackageAssignmentId, auth.profile);
    if ("error" in loaded) {
      const loadedError = loaded.error ?? "تعذر تحميل بيانات حزمة التقييم";
      const errorCode =
        loaded.status === 403
          ? "PERMISSION_DENIED"
          : loadedError.includes("خريطة أسئلة")
            ? "PACKAGE_QUESTIONS_NOT_FOUND"
            : "UNKNOWN_SCAN_ERROR";
      logScanFailure({
        errorStage: "load_package_questions",
        message: loadedError,
        classPackageAssignmentId: body.classPackageAssignmentId,
      });
      return NextResponse.json({ success: false, error: loadedError, errorCode }, { status: loaded.status });
    }

    const totalQuestions = loaded.questions.length;
    let scanned: Record<string, string>;
    let errorStage: ScanDebugInfo["errorStage"] = body.studentAnswers ? "manual_answers" : "gemini_scan";
    if (body.studentAnswers) {
      scanned = body.studentAnswers;
    } else {
      try {
        scanned = body.scanMode === "question_paper"
          ? await scanQuestionPaperAnswers(body.imageBase64!, totalQuestions, body.mimeType)
          : await scanAnswerSheet(body.imageBase64!, totalQuestions, body.mimeType);
      } catch (scanError) {
        const message = scanError instanceof Error ? scanError.message : String(scanError);
        const failedDebug = buildScanDebug({
          body,
          totalQuestions,
          detectedAnswerCount: 0,
          errorStage: "gemini_scan",
        });
        logScanFailure({
          errorStage: "gemini_scan",
          message,
          classPackageAssignmentId: body.classPackageAssignmentId,
          detectedAnswerCount: 0,
        });
        return NextResponse.json(
          {
            success: false,
            error: "تعذر قراءة اختيارات الطالب من الورقة. حاول تصوير الورقة بوضوح أكبر.",
            errorCode: "GEMINI_SCAN_FAILED",
            ...debugResponse({ ...failedDebug, errorStage: "gemini_scan" }),
          },
          { status: 502 }
        );
      }
    }

    const detectedAnswerCount = body.studentAnswers ? totalQuestions : countDetectedAnswers(scanned, totalQuestions);
    const scanDebug = buildScanDebug({
      body,
      totalQuestions,
      scanned,
      detectedAnswerCount,
      errorStage,
    });
    console.info("scan-package-omr", scanLogPayload(scanDebug));

    if (!body.studentAnswers && body.scanMode === "question_paper" && detectedAnswerCount < 1) {
      errorStage = "no_detected_answers";
      const noAnswersDebug = { ...scanDebug, errorStage };
      console.warn("scan-package-omr no detected answers", scanLogPayload(noAnswersDebug));
      return NextResponse.json(
        {
          success: false,
          error: "لم يتم العثور على اختيارات مظللة بوضوح في الورقة",
          errorCode: "INVALID_SCAN_RESPONSE",
          ...debugResponse(noAnswersDebug),
        },
        { status: 422 }
      );
    }

    const studentName = typeof scanned.studentName === "string" ? scanned.studentName.trim() : "";
    const studentCode = typeof scanned.studentCode === "string" ? scanned.studentCode.trim() : "";
    const graded = gradePackageAnswers(scanned, loaded.questions, studentName);

    let saved: { resultId?: string } | undefined;
    if (body.save && body.studentId) {
      const saveResult = await savePackageResult({
        assignment: loaded.assignment,
        graded,
        studentId: body.studentId,
      });

      if ("error" in saveResult) {
        return NextResponse.json(
          { success: false, error: saveResult.error, errorCode: "UNKNOWN_SCAN_ERROR" },
          { status: saveResult.status }
        );
      }

      saved = { resultId: saveResult.resultId };
    }

    return NextResponse.json({
      success: true,
      result: {
        studentName: graded.studentName,
        studentCode,
        answers: graded.answers,
        score: graded.score,
        total: graded.total,
        percentage: graded.percentage,
        level: graded.level,
        weakSkills: graded.weakSkills,
      },
      saved: Boolean(saved),
      resultId: saved?.resultId,
      ...debugResponse({ ...scanDebug, errorStage: undefined }),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("scan package OMR failed", { errorStage: "unhandled_exception", message });
    return NextResponse.json(
      {
        success: false,
        error: "تعذر تصحيح حزمة التقييم حاليًا",
        errorCode: "UNKNOWN_SCAN_ERROR",
        ...(DEBUG_SCAN
          ? {
              debug: {
                errorStage: "unhandled_exception",
                message,
              },
            }
          : {}),
      },
      { status: 500 }
    );
  }
}
