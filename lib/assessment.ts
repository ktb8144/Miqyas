import "server-only";
import { classMatchesPackage } from "@/lib/packages";

const OPTION_LABELS = ["أ", "ب", "ج", "د"] as const;

type OptionLabel = (typeof OPTION_LABELS)[number];
type SupabaseAdminClient = ReturnType<typeof import("@/lib/supabase-admin").getAdminClient>;

type PackageForSync = {
  id: string;
  subject: string;
  grade: number | string;
};

type AssignmentPackage = PackageForSync & {
  status?: string | null;
};

type ParsedAnswerQuestion = {
  question_number: number;
  correct_answer: OptionLabel;
  skill: string;
  domain: string;
  difficulty: string;
  question_text?: string | null;
  explanation?: string | null;
  options: Record<OptionLabel, string>;
};

export class AssessmentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AssessmentValidationError";
  }
}

function fail(message: string): never {
  throw new AssessmentValidationError(message);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}


export function parsePackageAnswerKey(input: unknown) {
  const source = typeof input === "string" ? input.trim() : input;
  if (!source) return { questions: [] as ParsedAnswerQuestion[] };

  let parsed: unknown;
  try {
    parsed = typeof source === "string" ? JSON.parse(source) : source;
  } catch {
    fail("صيغة JSON غير صحيحة.");
  }

  const rawQuestions = Array.isArray(parsed)
    ? parsed
    : isPlainObject(parsed) && Array.isArray(parsed.questions)
      ? parsed.questions
      : null;

  if (!rawQuestions) fail("صيغة JSON غير صحيحة. يجب أن يحتوي الملف على questions كمصفوفة.");
  if (rawQuestions.length === 0) fail("مفتاح الإجابة لا يحتوي على أسئلة.");

  const questions = rawQuestions.map((rawQuestion, index) => {
    const question = isPlainObject(rawQuestion) ? rawQuestion : {};
    const fallbackNumber = index + 1;
    const questionNumber = Number(question.question_number ?? fallbackNumber);
    const correctAnswer = normalizeText(question.correct_answer);
    const skill = normalizeText(question.skill);
    const domain = normalizeText(question.domain);
    const difficulty = normalizeText(question.difficulty);
    const options = isPlainObject(question.options) ? question.options : null;

    if (!Number.isFinite(questionNumber) || questionNumber <= 0) {
      fail(`السؤال رقم ${fallbackNumber} لا يحتوي على رقم سؤال صحيح.`);
    }
    if (!correctAnswer) fail(`السؤال رقم ${questionNumber} لا يحتوي على إجابة صحيحة.`);
    if (!OPTION_LABELS.includes(correctAnswer as OptionLabel)) {
      fail(`الإجابة الصحيحة في السؤال رقم ${questionNumber} يجب أن تكون أ أو ب أو ج أو د.`);
    }
    if (!skill) fail(`السؤال رقم ${questionNumber} لا يحتوي على المهارة.`);
    if (!domain) fail(`السؤال رقم ${questionNumber} لا يحتوي على المجال.`);
    if (!difficulty) fail(`السؤال رقم ${questionNumber} لا يحتوي على مستوى الصعوبة.`);
    if (!options || OPTION_LABELS.some((label) => !normalizeText(options[label]))) {
      fail(`السؤال رقم ${questionNumber} لا يحتوي على الخيارات الأربعة.`);
    }

    return {
      question_number: questionNumber,
      correct_answer: correctAnswer as OptionLabel,
      skill,
      domain,
      difficulty,
      question_text: normalizeText(question.question_text) || null,
      explanation: normalizeText(question.explanation) || null,
      options: {
        "أ": normalizeText(options["أ"]),
        "ب": normalizeText(options["ب"]),
        "ج": normalizeText(options["ج"]),
        "د": normalizeText(options["د"]),
      },
    };
  });

  const numbers = questions.map((question) => question.question_number);
  if (new Set(numbers).size !== numbers.length) fail("أرقام الأسئلة يجب ألا تتكرر داخل مفتاح الإجابة.");

  return { questions: questions.sort((a, b) => a.question_number - b.question_number) };
}

export async function syncPackageQuestionsFromAnswerKey({
  db,
  assessmentPackage,
  answerKeyInput,
}: {
  db: SupabaseAdminClient;
  assessmentPackage: PackageForSync;
  answerKeyInput: unknown;
}) {
  const answerKey = parsePackageAnswerKey(answerKeyInput);
  if (!answerKey.questions.length) return { syncedQuestionCount: 0 };

  const { error: deleteError } = await db
    .from("package_questions")
    .delete()
    .eq("package_id", assessmentPackage.id);
  if (deleteError) throw deleteError;

  const { data, error } = await db
    .from("package_questions")
    .insert(
      answerKey.questions.map((question) => ({
        package_id: assessmentPackage.id,
        question_number: question.question_number,
        correct_option: question.correct_answer,
        difficulty_level: question.difficulty,
        points: 1,
        question_text: question.question_text || `سؤال رقم ${question.question_number} - راجع ملف PDF`,
        domain_text: question.domain,
        skill_text: question.skill,
        remediation_note: question.explanation || null,
        options_json: question.options,
      }))
    )
    .select("id");
  if (error) throw error;

  return { syncedQuestionCount: data?.length ?? 0 };
}

export async function createClassAssignmentsForPackage({
  db,
  assessmentPackage,
  schoolIds,
}: {
  db: SupabaseAdminClient;
  assessmentPackage: AssignmentPackage;
  schoolIds?: string[];
}) {
  const targetSchoolIds = Array.from(new Set((schoolIds ?? []).filter(Boolean)));
  let query = db
    .from("classes")
    .select("id, school_id, teacher_id, grade, subject");

  if (targetSchoolIds.length > 0) {
    query = query.in("school_id", targetSchoolIds);
  }

  const { data: classes, error } = await query;
  if (error) throw error;

  const rows = (classes ?? [])
    .filter((classItem) => classItem.teacher_id && classMatchesPackage(classItem, assessmentPackage))
    .map((classItem) => ({
      package_id: assessmentPackage.id,
      school_id: classItem.school_id,
      class_id: classItem.id,
      teacher_id: classItem.teacher_id,
      status: "assigned",
    }));

  if (!rows.length) return { assignedClassCount: 0 };

  const { data, error: upsertError } = await db
    .from("class_package_assignments")
    .upsert(rows, { onConflict: "package_id,class_id" })
    .select("id");

  if (upsertError) throw upsertError;
  return { assignedClassCount: data?.length ?? rows.length };
}
