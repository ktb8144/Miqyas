import "server-only";

const OPTION_LABELS = ["أ", "ب", "ج", "د"] as const;

type OptionLabel = (typeof OPTION_LABELS)[number];

type WeeklyAnswerQuestion = {
  question_number: number;
  correct_answer: OptionLabel;
  skill: string;
  domain: string;
  difficulty: string;
  question_text?: string | null;
  explanation?: string | null;
  options: Record<OptionLabel, string>;
};

type WeeklyAnswerKey = {
  questions: WeeklyAnswerQuestion[];
};

type SupabaseAdminClient = ReturnType<typeof import("@/lib/supabase-admin").getAdminClient>;

type PackageForWeeklySync = {
  id: string;
  subject: string;
  grade: number | string;
  week_number: number | null;
  start_date: string | null;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function questionNumberLabel(value: unknown, fallback: number) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
}

function normalizeOption(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export class WeeklyAnswerKeyValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WeeklyAnswerKeyValidationError";
  }
}

function validationError(message: string): never {
  throw new WeeklyAnswerKeyValidationError(message);
}

export function parseWeeklyAnswerKey(input: unknown): WeeklyAnswerKey {
  const source = typeof input === "string" ? input.trim() : input;
  if (!source) {
    return { questions: [] };
  }

  let parsed: unknown;
  try {
    parsed = typeof source === "string" ? JSON.parse(source) : source;
  } catch {
    validationError("صيغة JSON غير صحيحة.");
  }

  const rawQuestions = Array.isArray(parsed)
    ? parsed
    : isPlainObject(parsed) && Array.isArray(parsed.questions)
      ? parsed.questions
      : null;

  if (!rawQuestions) {
    validationError("صيغة JSON غير صحيحة. يجب أن يحتوي الملف على questions كمصفوفة.");
  }

  if (rawQuestions.length === 0) {
    validationError("مفتاح الإجابة لا يحتوي على أسئلة.");
  }

  const questions = rawQuestions.map((rawQuestion, index) => {
    const question = isPlainObject(rawQuestion) ? rawQuestion : {};
    const questionNumber = questionNumberLabel(question.question_number, index + 1);
    const correctAnswer = normalizeOption(question.correct_answer);
    const skill = normalizeOption(question.skill);
    const domain = normalizeOption(question.domain);
    const difficulty = normalizeOption(question.difficulty);
    const options = isPlainObject(question.options) ? question.options : null;

    if (!question.question_number || !Number.isFinite(Number(question.question_number))) {
      validationError(`السؤال رقم ${questionNumber} لا يحتوي على رقم سؤال صحيح.`);
    }
    if (!correctAnswer) {
      validationError(`السؤال رقم ${questionNumber} لا يحتوي على إجابة صحيحة.`);
    }
    if (!OPTION_LABELS.includes(correctAnswer as OptionLabel)) {
      validationError(`الإجابة الصحيحة في السؤال رقم ${questionNumber} يجب أن تكون أ أو ب أو ج أو د.`);
    }
    if (!skill) {
      validationError(`السؤال رقم ${questionNumber} لا يحتوي على المهارة.`);
    }
    if (!domain) {
      validationError(`السؤال رقم ${questionNumber} لا يحتوي على المجال.`);
    }
    if (!difficulty) {
      validationError(`السؤال رقم ${questionNumber} لا يحتوي على مستوى الصعوبة.`);
    }
    if (!options || OPTION_LABELS.some((label) => !normalizeOption(options[label]))) {
      validationError(`السؤال رقم ${questionNumber} لا يحتوي على الخيارات الأربعة.`);
    }

    return {
      question_number: Number(question.question_number),
      correct_answer: correctAnswer as OptionLabel,
      skill,
      domain,
      difficulty,
      question_text: normalizeOption(question.question_text) || null,
      explanation: normalizeOption(question.explanation) || null,
      options: {
        "أ": normalizeOption(options["أ"]),
        "ب": normalizeOption(options["ب"]),
        "ج": normalizeOption(options["ج"]),
        "د": normalizeOption(options["د"]),
      },
    };
  });

  const numbers = questions.map((question) => question.question_number);
  if (new Set(numbers).size !== numbers.length) {
    validationError("أرقام الأسئلة يجب ألا تتكرر داخل مفتاح الإجابة.");
  }

  return { questions: questions.sort((a, b) => a.question_number - b.question_number) };
}

async function getCreatedBy(db: SupabaseAdminClient, authId: string) {
  const { data } = await db
    .from("users")
    .select("id")
    .eq("auth_id", authId)
    .maybeSingle();

  return data?.id ?? null;
}

async function syncForSchool({
  db,
  schoolId,
  assessmentPackage,
  answerKey,
  createdBy,
}: {
  db: SupabaseAdminClient;
  schoolId: string | null;
  assessmentPackage: PackageForWeeklySync;
  answerKey: WeeklyAnswerKey;
  createdBy: string | null;
}) {
  const assessmentDate = assessmentPackage.start_date ?? new Date().toISOString().slice(0, 10);
  const weekNumber = Number(assessmentPackage.week_number ?? 0);

  let existingQuery = db
    .from("weekly_questions")
    .select("id")
    .eq("subject", assessmentPackage.subject)
    .eq("grade", assessmentPackage.grade)
    .eq("week_number", weekNumber)
    .eq("assessment_date", assessmentDate);

  existingQuery = schoolId ? existingQuery.eq("school_id", schoolId) : existingQuery.is("school_id", null);

  const { data: existingQuestions, error: existingError } = await existingQuery;
  if (existingError) throw existingError;

  const existingIds = (existingQuestions ?? []).map((item) => item.id as string);
  if (existingIds.length > 0) {
    const { error: optionsDeleteError } = await db
      .from("question_options")
      .delete()
      .in("question_id", existingIds);
    if (optionsDeleteError) throw optionsDeleteError;

    const { error: questionsDeleteError } = await db
      .from("weekly_questions")
      .delete()
      .in("id", existingIds);
    if (questionsDeleteError) throw questionsDeleteError;
  }

  const { data: insertedQuestions, error: questionsInsertError } = await db
    .from("weekly_questions")
    .insert(
      answerKey.questions.map((question) => ({
        school_id: schoolId,
        subject: assessmentPackage.subject,
        grade: assessmentPackage.grade,
        skill: question.skill,
        difficulty: question.difficulty,
        question_text: question.question_text?.trim() || `سؤال رقم ${question.question_number} - راجع ملف PDF`,
        week_number: weekNumber,
        assessment_date: assessmentDate,
        status: "active",
        sort_order: question.question_number,
        created_by: createdBy,
      }))
    )
    .select("id, sort_order");

  if (questionsInsertError) throw questionsInsertError;

  const optionsRows = (insertedQuestions ?? []).flatMap((inserted) => {
    const matchingQuestion = answerKey.questions.find((question) => question.question_number === Number(inserted.sort_order));
    if (!matchingQuestion) return [];

    return OPTION_LABELS.map((label) => ({
      question_id: inserted.id,
      option_label: label,
      option_text: matchingQuestion.options[label],
      is_correct: label === matchingQuestion.correct_answer,
    }));
  });

  if (optionsRows.length > 0) {
    const { error: optionsInsertError } = await db
      .from("question_options")
      .insert(optionsRows);
    if (optionsInsertError) throw optionsInsertError;
  }
}

export async function syncWeeklyQuestionsFromAnswerKey({
  db,
  authId,
  assessmentPackage,
  answerKeyInput,
}: {
  db: SupabaseAdminClient;
  authId: string;
  assessmentPackage: PackageForWeeklySync;
  answerKeyInput: unknown;
}) {
  const answerKey = parseWeeklyAnswerKey(answerKeyInput);
  if (answerKey.questions.length === 0) {
    return { syncedQuestionCount: 0 };
  }

  const createdBy = await getCreatedBy(db, authId);
  const { data: assignments, error: assignmentsError } = await db
    .from("school_package_assignments")
    .select("school_id")
    .eq("package_id", assessmentPackage.id);

  if (assignmentsError) throw assignmentsError;

  const assignedSchoolIds = Array.from(
    new Set((assignments ?? []).map((item) => item.school_id as string).filter(Boolean))
  );
  const targetSchoolIds: Array<string | null> = assignedSchoolIds.length > 0 ? assignedSchoolIds : [null];

  await Promise.all(
    targetSchoolIds.map((schoolId) =>
      syncForSchool({
        db,
        schoolId,
        assessmentPackage,
        answerKey,
        createdBy,
      })
    )
  );

  return {
    syncedQuestionCount: answerKey.questions.length,
    syncedSchoolCount: targetSchoolIds.length,
  };
}
