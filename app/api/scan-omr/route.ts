import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { scanAnswerSheet } from "@/lib/gemini";
import { getLevel } from "@/lib/demo-data";
import { getAdminClient } from "@/lib/supabase-admin";

const VALID_ANSWERS = new Set(["أ", "ب", "ج", "د"]);

type AnswerKey = Record<string, string>;
type ScanBody = {
  imageBase64?: string;
  studentAnswers?: Record<string, string>;
  mimeType?: string;
  subject?: string;
  grade?: string | number;
  weekNumber?: number;
};

type QuestionRow = {
  id: string;
  skill?: string | null;
  question_options?: { option_label: string; is_correct: boolean }[];
};

function normalizeAnswer(value: unknown) {
  return typeof value === "string" && VALID_ANSWERS.has(value) ? value : value === "blank" ? "blank" : "unclear";
}

function normalizeGrade(value: unknown) {
  if (typeof value === "number") {
    const labels: Record<number, string> = {
      1: "الأول",
      2: "الثاني",
      3: "الثالث",
      4: "الرابع",
      5: "الخامس",
      6: "السادس",
    };
    return labels[value] ?? String(value);
  }
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

async function requireTeacher(req: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll() {
          // This route only needs to read the incoming auth cookies.
        },
      },
    }
  );

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { ok: false as const, status: 401, error: "Unauthorized" };
  }

  const db = getAdminClient();
  const { data: profile, error: profileError } = await db
    .from("users")
    .select("role, school_id, grade, subject")
    .eq("auth_id", user.id)
    .single();

  if (profileError || !profile) {
    return { ok: false as const, status: 403, error: "Teacher profile not found" };
  }

  if (profile.role !== "teacher") {
    return { ok: false as const, status: 403, error: "Only teachers can scan OMR sheets" };
  }

  return { ok: true as const, user, profile };
}

async function loadAssessmentQuestions(body: ScanBody, profile: { school_id?: string | null; grade?: string | number | null; subject?: string | null }) {
  const db = getAdminClient();
  const subject = body.subject?.trim() || profile.subject || "رياضيات";
  const grade = normalizeGrade(body.grade) || normalizeGrade(profile.grade) || "الثالث";
  const weekNumber = Number(body.weekNumber || 0);

  let query = db
    .from("weekly_questions")
    .select("id, school_id, skill, question_options(option_label, is_correct)")
    .eq("is_active", true)
    .eq("status", "active")
    .eq("subject", subject)
    .eq("grade", grade)
    .order("sort_order", { ascending: true });

  if (profile.school_id) {
    query = query.or(`school_id.eq.${profile.school_id},school_id.is.null`);
  } else {
    query = query.is("school_id", null);
  }

  if (weekNumber > 0) {
    query = query.eq("week_number", weekNumber);
  }

  const { data, error } = await query;
  if (error) throw error;

  const rows = (data ?? []) as QuestionRow[];
  if (rows.length === 0) {
    return { rows, answerKey: {} as AnswerKey };
  }

  const answerKey: AnswerKey = {};

  rows.forEach((question, index) => {
    const correct = question.question_options?.find((option) => option.is_correct);
    if (correct?.option_label && VALID_ANSWERS.has(correct.option_label)) {
      answerKey[`q${index + 1}`] = correct.option_label;
    }
  });

  return { rows, answerKey };
}

function gradeAnswers(studentAnswers: Record<string, string>, answerKey: AnswerKey, questions: QuestionRow[]) {
  const total = Object.keys(answerKey).length;
  const answers: Record<string, string> = {};
  const weakSkills: { question: string; skill: string }[] = [];
  let score = 0;

  for (let i = 1; i <= total; i++) {
    const qKey = `q${i}`;
    const answer = normalizeAnswer(studentAnswers[qKey]);
    answers[qKey] = answer;
    if (answer === answerKey[qKey]) {
      score++;
    } else {
      weakSkills.push({
        question: qKey,
        skill: questions[i - 1]?.skill || `السؤال ${i}`,
      });
    }
  }

  const percentage = total ? Math.round((score / total) * 100) : 0;

  return {
    answers,
    score,
    total,
    percentage,
    level: getLevel(score, total),
    weakSkills,
  };
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireTeacher(req);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = (await req.json()) as ScanBody;
    const { imageBase64, studentAnswers, mimeType = "image/jpeg" } = body;

    if (!imageBase64 && !studentAnswers) {
      return NextResponse.json({ error: "imageBase64 or studentAnswers is required" }, { status: 400 });
    }

    const { rows, answerKey } = await loadAssessmentQuestions(body, auth.profile);
    if (rows.length === 0 || Object.keys(answerKey).length === 0) {
      return NextResponse.json(
        { error: "لا توجد أسئلة مفعّلة لهذا الصف/المادة/الأسبوع." },
        { status: 404 }
      );
    }

    const totalQuestions = Object.keys(answerKey).length;
    const scanned = studentAnswers ?? await scanAnswerSheet(imageBase64!, totalQuestions, mimeType);
    const studentName = typeof scanned.studentName === "string" ? scanned.studentName.trim() : "";
    const graded = gradeAnswers(scanned, answerKey, rows);

    return NextResponse.json({
      success: true,
      result: {
        studentName,
        answers: graded.answers,
        score: graded.score,
        total: graded.total,
        percentage: graded.percentage,
        level: graded.level,
        weakSkills: graded.weakSkills,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
