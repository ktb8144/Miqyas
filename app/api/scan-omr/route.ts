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
  totalQuestions?: number;
  mimeType?: string;
  subject?: string;
  grade?: string;
  weekNumber?: number;
  assessmentDate?: string;
};

type QuestionRow = {
  id: string;
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

async function loadAnswerKey(body: ScanBody, profile: { school_id?: string | null; grade?: string | number | null; subject?: string | null }) {
  const db = getAdminClient();
  const subject = body.subject?.trim() || profile.subject || "رياضيات";
  const grade = normalizeGrade(body.grade) || normalizeGrade(profile.grade) || "الثالث";

  let query = db
    .from("weekly_questions")
    .select("id, question_options(option_label, is_correct)")
    .eq("is_active", true)
    .eq("subject", subject)
    .eq("grade", grade)
    .order("sort_order", { ascending: true });

  if (profile.school_id) {
    query = query.eq("school_id", profile.school_id);
  }

  if (typeof body.weekNumber === "number") {
    query = query.eq("week_number", body.weekNumber);
  }

  if (body.assessmentDate) {
    query = query.eq("assessment_date", body.assessmentDate);
  }

  const { data, error } = await query;
  if (error) throw error;

  const rows = (data ?? []) as QuestionRow[];
  const answerKey: AnswerKey = {};

  rows.forEach((question, index) => {
    const correct = question.question_options?.find((option) => option.is_correct);
    if (correct?.option_label && VALID_ANSWERS.has(correct.option_label)) {
      answerKey[`q${index + 1}`] = correct.option_label;
    }
  });

  if (Object.keys(answerKey).length === 0) {
    throw new Error("No active answer key was found for this teacher and assessment");
  }

  return answerKey;
}

function gradeAnswers(studentAnswers: Record<string, string>, answerKey: AnswerKey) {
  const total = Object.keys(answerKey).length;
  const answers: Record<string, string> = {};
  let score = 0;

  for (let i = 1; i <= total; i++) {
    const qKey = `q${i}`;
    const answer = normalizeAnswer(studentAnswers[qKey]);
    answers[qKey] = answer;
    if (answer === answerKey[qKey]) score++;
  }

  return {
    answers,
    score,
    total,
    level: getLevel(score, total),
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

    const answerKey = await loadAnswerKey(body, auth.profile);
    const totalQuestions = Object.keys(answerKey).length;
    const scanned = studentAnswers ?? await scanAnswerSheet(imageBase64!, totalQuestions, mimeType);
    const studentName = typeof scanned.studentName === "string" ? scanned.studentName.trim() : "";
    const graded = gradeAnswers(scanned, answerKey);

    return NextResponse.json({
      success: true,
      result: {
        studentName,
        answers: graded.answers,
        score: graded.score,
        total: graded.total,
        level: graded.level,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
