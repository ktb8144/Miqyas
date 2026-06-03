import "server-only";
import { getAdminClient } from "@/lib/supabase-admin";

type AssignmentRow = {
  id: string;
  package_id: string;
  school_id: string;
  class_id: string;
  teacher_id: string;
};

type StudentRow = {
  id: string;
  name: string;
  student_code: string | null;
};

type StudentResultRow = {
  id: string;
  student_id: string;
};

type QuestionResultRow = {
  id: string;
  student_package_result_id: string;
  student_id: string;
  package_question_id: string | null;
  selected_option: string | null;
  correct_option: string | null;
  is_correct: boolean;
  error_type: string | null;
  package_questions?: {
    question_number?: number | null;
    difficulty_level?: string | null;
    question_text?: string | null;
    remediation_note?: string | null;
    misconceptions_json?: unknown;
  } | Array<{
    question_number?: number | null;
    difficulty_level?: string | null;
    question_text?: string | null;
    remediation_note?: string | null;
    misconceptions_json?: unknown;
  }> | null;
  nafs_domains?: { domain_name?: string | null } | Array<{ domain_name?: string | null }> | null;
  learning_skills?: { skill_name?: string | null } | Array<{ skill_name?: string | null }> | null;
};

type SkillBucket = {
  key: string;
  skillText: string;
  domainText: string;
  totalAttempts: number;
  correctAttempts: number;
  wrongAttempts: number;
  questionNumbers: Set<number>;
  affectedStudentIds: Set<string>;
  misconceptions: Map<string, number>;
  wrongOptions: Map<string, number>;
};

function firstJoin<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function pct(correct: number, total: number) {
  return total > 0 ? Math.round((correct / total) * 100) : 0;
}

function confidenceFor(questionCount: number, totalAttempts: number, dominantWrongRate: number) {
  if (questionCount < 2 || totalAttempts < 6) return "low" as const;
  if (dominantWrongRate >= 60) return "high" as const;
  if (dominantWrongRate >= 35) return "medium" as const;
  return "medium" as const;
}

function confidenceLabel(value: "high" | "medium" | "low") {
  const labels = { high: "عالٍ", medium: "متوسط", low: "منخفض" };
  return labels[value];
}

function misconceptionFor(question: QuestionResultRow, selectedOption: string) {
  const packageQuestion = firstJoin(question.package_questions);
  const raw = packageQuestion?.misconceptions_json;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const map = raw as Record<string, unknown>;
  const value = map[selectedOption] ?? map[`option_${selectedOption}`] ?? map[selectedOption.trim()];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function topEntry(map: Map<string, number>) {
  return Array.from(map.entries()).sort((a, b) => b[1] - a[1])[0] ?? null;
}

function skillKey(skillText: string, domainText: string) {
  return `${domainText}::${skillText}`;
}

function buildLikelyCause(bucket: SkillBucket, questionCount: number, dominantMisconception: string | null, dominantWrongOption: string | null, dominantWrongRate: number) {
  if (questionCount < 2) return "لا يمكن الجزم بسبب محدد؛ المهارة مقاسة بسؤال واحد فقط وتحتاج قياسًا إضافيًا.";
  if (dominantMisconception && dominantWrongRate >= 40) return `النمط الأكثر ظهورًا يشير إلى: ${dominantMisconception}.`;
  if (dominantWrongOption && dominantWrongRate >= 40) return `ظهر تكرار في اختيار (${dominantWrongOption}) كإجابة خاطئة، ما يشير إلى تصور غير مكتمل حول المهارة.`;
  return "الأخطاء موزعة على أكثر من خيار؛ السبب غير مؤكد ويحتاج سؤالًا تشخيصيًا قصيرًا قبل التدخل.";
}

function buildRecommendedAction(bucket: SkillBucket, masteryRate: number, affectedCount: number, totalStudents: number, questionCount: number) {
  const classWide = totalStudents > 0 && affectedCount / totalStudents >= 0.5;
  const target = classWide ? "الفصل كاملًا" : "مجموعة علاجية صغيرة";
  const duration = classWide ? "15 دقيقة" : "10 دقائق";
  const measure = questionCount < 2 ? "أعد القياس بسؤالين قصيرين قبل اعتماد الحكم النهائي." : "اختم بسؤال خروج واحد يقيس نفس المهارة.";

  return {
    whatHappened: `بلغت نسبة إتقان مهارة "${bucket.skillText}" ${masteryRate}%.`,
    nextLessonAction: classWide
      ? "ابدأ الحصة بنموذج محلول، ثم تدريب موجه، ثم سؤال فردي سريع."
      : "اجمع الطلاب المستهدفين في نشاط قصير يراجع الخطأ الشائع ثم سؤال تحقق.",
    duration,
    targetStudents: target,
    impactMeasure: measure,
  };
}

export async function analyzeClassPackageAssignmentSkills({
  assignmentId,
  teacherId,
  schoolId,
}: {
  assignmentId: string;
  teacherId: string;
  schoolId: string;
}) {
  const db = getAdminClient();

  const { data: assignment, error: assignmentError } = await db
    .from("class_package_assignments")
    .select("id, package_id, school_id, class_id, teacher_id")
    .eq("id", assignmentId)
    .eq("school_id", schoolId)
    .eq("teacher_id", teacherId)
    .maybeSingle();
  if (assignmentError) throw assignmentError;
  if (!assignment) throw new Error("لم يتم العثور على اختبار مرتبط بحسابك");

  const typedAssignment = assignment as AssignmentRow;

  const [studentsRes, resultsRes] = await Promise.all([
    db.from("students").select("id, name, student_code").eq("class_id", typedAssignment.class_id).eq("school_id", schoolId),
    db.from("student_package_results").select("id, student_id").eq("class_package_assignment_id", assignmentId).eq("school_id", schoolId).eq("teacher_id", teacherId),
  ]);
  if (studentsRes.error) throw studentsRes.error;
  if (resultsRes.error) throw resultsRes.error;

  const students = (studentsRes.data ?? []) as StudentRow[];
  const studentsById = new Map(students.map((student) => [student.id, student]));
  const studentResults = (resultsRes.data ?? []) as StudentResultRow[];
  const resultIds = studentResults.map((result) => result.id);

  if (!resultIds.length) {
    return {
      weakestSkills: [],
      strongestSkills: [],
      skillEvidence: [],
      likelyCauses: [],
      recommendedActions: [],
      studentGroups: {
        classIntervention: [],
        smallGroup: [],
        additionalMeasurement: students.map((student) => ({ id: student.id, name: student.name, studentCode: student.student_code })),
      },
      confidence: { level: "low", label: "منخفض", reason: "لا توجد نتائج طلاب محفوظة لهذا الاختبار." },
    };
  }

  const { data: questionRowsData, error: questionRowsError } = await db
    .from("student_question_results")
    .select(`
      id,
      student_package_result_id,
      student_id,
      package_question_id,
      selected_option,
      correct_option,
      is_correct,
      error_type,
      package_questions(question_number, difficulty_level, question_text, remediation_note, misconceptions_json),
      nafs_domains(domain_name),
      learning_skills(skill_name)
    `)
    .in("student_package_result_id", resultIds);
  if (questionRowsError) throw questionRowsError;

  const questionRows = (questionRowsData ?? []) as QuestionResultRow[];
  const buckets = new Map<string, SkillBucket>();
  const questionEvidence = new Map<number, {
    questionNumber: number;
    total: number;
    correct: number;
    wrongOptions: Map<string, number>;
    topWrongOption: string | null;
  }>();

  questionRows.forEach((row) => {
    const skillText = firstJoin(row.learning_skills)?.skill_name || "مهارة غير محددة";
    const domainText = firstJoin(row.nafs_domains)?.domain_name || "مجال غير محدد";
    const packageQuestion = firstJoin(row.package_questions);
    const questionNumber = Number(packageQuestion?.question_number ?? 0);
    const key = skillKey(skillText, domainText);
    const bucket = buckets.get(key) ?? {
      key,
      skillText,
      domainText,
      totalAttempts: 0,
      correctAttempts: 0,
      wrongAttempts: 0,
      questionNumbers: new Set<number>(),
      affectedStudentIds: new Set<string>(),
      misconceptions: new Map<string, number>(),
      wrongOptions: new Map<string, number>(),
    };

    bucket.totalAttempts += 1;
    if (questionNumber) bucket.questionNumbers.add(questionNumber);
    if (row.is_correct) {
      bucket.correctAttempts += 1;
    } else {
      bucket.wrongAttempts += 1;
      bucket.affectedStudentIds.add(row.student_id);
      const selected = row.selected_option || "blank";
      bucket.wrongOptions.set(selected, (bucket.wrongOptions.get(selected) ?? 0) + 1);
      const misconception = misconceptionFor(row, selected);
      if (misconception) bucket.misconceptions.set(misconception, (bucket.misconceptions.get(misconception) ?? 0) + 1);
    }
    buckets.set(key, bucket);

    if (questionNumber) {
      const evidence = questionEvidence.get(questionNumber) ?? {
        questionNumber,
        total: 0,
        correct: 0,
        wrongOptions: new Map<string, number>(),
        topWrongOption: null,
      };
      evidence.total += 1;
      if (row.is_correct) {
        evidence.correct += 1;
      } else {
        const selected = row.selected_option || "blank";
        evidence.wrongOptions.set(selected, (evidence.wrongOptions.get(selected) ?? 0) + 1);
      }
      const topWrong = topEntry(evidence.wrongOptions);
      evidence.topWrongOption = topWrong?.[0] ?? null;
      questionEvidence.set(questionNumber, evidence);
    }
  });

  const skillEvidence = Array.from(buckets.values()).map((bucket) => {
    const masteryRate = pct(bucket.correctAttempts, bucket.totalAttempts);
    const questionCount = bucket.questionNumbers.size;
    const affectedStudents = Array.from(bucket.affectedStudentIds).map((id) => {
      const student = studentsById.get(id);
      return { id, name: student?.name ?? "طالب غير محدد", studentCode: student?.student_code ?? null };
    });
    const topWrong = topEntry(bucket.wrongOptions);
    const topMisconception = topEntry(bucket.misconceptions);
    const dominantWrongRate = bucket.wrongAttempts ? Math.round(((topWrong?.[1] ?? 0) / bucket.wrongAttempts) * 100) : 0;
    const confidence = confidenceFor(questionCount, bucket.totalAttempts, dominantWrongRate);
    const likelyCause = buildLikelyCause(bucket, questionCount, topMisconception?.[0] ?? null, topWrong?.[0] ?? null, dominantWrongRate);
    const recommendation = buildRecommendedAction(bucket, masteryRate, affectedStudents.length, students.length, questionCount);

    return {
      skillText: bucket.skillText,
      domainText: bucket.domainText,
      masteryRate,
      masteredCount: bucket.correctAttempts,
      notMasteredCount: bucket.wrongAttempts,
      totalAttempts: bucket.totalAttempts,
      linkedQuestionCount: questionCount,
      affectedStudentsCount: affectedStudents.length,
      affectedStudents,
      commonWrongOption: topWrong ? { option: topWrong[0], count: topWrong[1] } : null,
      topMisconception: topMisconception ? { text: topMisconception[0], count: topMisconception[1] } : null,
      confidence,
      confidenceLabel: confidenceLabel(confidence),
      warning: questionCount < 2 ? "يحتاج قياس إضافي" : null,
      likelyCause,
      recommendation,
    };
  });

  const weakestSkills = [...skillEvidence]
    .filter((item) => item.notMasteredCount > 0)
    .sort((a, b) => a.masteryRate - b.masteryRate || b.affectedStudentsCount - a.affectedStudentsCount)
    .slice(0, 5);

  const strongestSkills = [...skillEvidence]
    .filter((item) => item.totalAttempts > 0)
    .sort((a, b) => b.masteryRate - a.masteryRate)
    .slice(0, 5);

  const likelyCauses = weakestSkills.map((item) => ({
    skillText: item.skillText,
    cause: item.likelyCause,
    confidence: item.confidence,
    warning: item.warning,
  }));

  const recommendedActions = weakestSkills.map((item) => ({
    skillText: item.skillText,
    whatHappened: item.recommendation.whatHappened,
    whyLikely: item.likelyCause,
    nextLessonAction: item.recommendation.nextLessonAction,
    duration: item.recommendation.duration,
    targetStudents: item.recommendation.targetStudents,
    impactMeasure: item.recommendation.impactMeasure,
  }));

  const classIntervention = weakestSkills
    .filter((item) => students.length > 0 && item.affectedStudentsCount / students.length >= 0.5)
    .flatMap((item) => item.affectedStudents)
    .filter((student, index, array) => array.findIndex((other) => other.id === student.id) === index);

  const smallGroup = weakestSkills
    .filter((item) => students.length === 0 || item.affectedStudentsCount / students.length < 0.5)
    .flatMap((item) => item.affectedStudents)
    .filter((student, index, array) => array.findIndex((other) => other.id === student.id) === index);

  const lowConfidenceCount = skillEvidence.filter((item) => item.confidence === "low").length;
  const overallConfidence = !skillEvidence.length || lowConfidenceCount === skillEvidence.length
    ? "low"
    : lowConfidenceCount > 0
      ? "medium"
      : "high";

  return {
    weakestSkills,
    strongestSkills,
    skillEvidence,
    questionEvidence: Array.from(questionEvidence.values()).map((item) => ({
      questionNumber: item.questionNumber,
      masteryRate: pct(item.correct, item.total),
      totalAttempts: item.total,
      topWrongOption: item.topWrongOption,
      wrongOptions: Array.from(item.wrongOptions.entries()).map(([option, count]) => ({ option, count })),
    })),
    likelyCauses,
    recommendedActions,
    studentGroups: {
      classIntervention,
      smallGroup,
      additionalMeasurement: skillEvidence
        .filter((item) => item.warning)
        .flatMap((item) => item.affectedStudents)
        .filter((student, index, array) => array.findIndex((other) => other.id === student.id) === index),
    },
    confidence: {
      level: overallConfidence,
      label: confidenceLabel(overallConfidence),
      reason: overallConfidence === "low"
        ? "عدد الأسئلة أو النتائج غير كافٍ للجزم بسبب دقيق."
        : "التحليل مبني على نتائج الطلاب وخياراتهم الخاطئة في هذه الحزمة.",
    },
  };
}
