import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, requireAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const OPTION_LABELS = ["أ", "ب", "ج", "د"];
const VALID_STATUSES = new Set(["draft", "active", "archived"]);

type OptionInput = {
  option_label: string;
  option_text: string;
  is_correct?: boolean;
};

type QuestionRow = Record<string, unknown> & {
  question_options?: OptionInput[];
};

function normalizeQuestion(row: QuestionRow) {
  const options = (row.question_options ?? [])
    .map((option) => ({
      option_label: String(option.option_label ?? ""),
      option_text: String(option.option_text ?? ""),
      is_correct: Boolean(option.is_correct),
    }))
    .sort((a, b) => OPTION_LABELS.indexOf(a.option_label) - OPTION_LABELS.indexOf(b.option_label));

  const status = String(row.status ?? "draft");

  return {
    id: String(row.id),
    subject: String(row.subject ?? ""),
    grade: String(row.grade ?? ""),
    skill: String(row.skill ?? ""),
    difficulty: String(row.difficulty ?? ""),
    question_text: String(row.question_text ?? ""),
    week_number: Number(row.week_number ?? 0),
    status,
    options,
    correct_option: options.find((option) => option.is_correct)?.option_label ?? "",
  };
}

function normalizeOptions(rawOptions: unknown, correctOption: unknown) {
  const options = Array.isArray(rawOptions) ? rawOptions : [];
  const correct = typeof correctOption === "string" ? correctOption : "";

  return OPTION_LABELS.map((label) => {
    const option = options.find((item) => item?.option_label === label);
    return {
      option_label: label,
      option_text: typeof option?.option_text === "string" ? option.option_text.trim() : "",
      is_correct: label === correct,
    };
  });
}

async function getCreatedBy(authId: string) {
  const { data } = await getAdminClient()
    .from("users")
    .select("id")
    .eq("auth_id", authId)
    .single();

  return data?.id ?? null;
}

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);

  if (!admin.ok) {
    return NextResponse.json(
      { success: false, error: admin.error },
      { status: admin.status }
    );
  }

  try {
    const { data, error } = await getAdminClient()
      .from("weekly_questions")
      .select("*, question_options(option_label, option_text, is_correct)")
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: ((data ?? []) as QuestionRow[]).map((row) => normalizeQuestion(row)),
    });
  } catch (err) {
    console.error("admin questions list failed", err);
    return NextResponse.json(
      { success: false, error: "تعذر تحميل الأسئلة" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);

  if (!admin.ok) {
    return NextResponse.json(
      { success: false, error: admin.error },
      { status: admin.status }
    );
  }

  try {
    const body = await req.json();
    const subject = typeof body.subject === "string" ? body.subject.trim() : "";
    const grade = typeof body.grade === "string" ? body.grade.trim() : "";
    const skill = typeof body.skill === "string" ? body.skill.trim() : "";
    const difficulty = typeof body.difficulty === "string" ? body.difficulty.trim() : "";
    const questionText = typeof body.question_text === "string" ? body.question_text.trim() : "";
    const weekNumber = Number(body.week_number || 0);
    const status = VALID_STATUSES.has(body.status) ? body.status : "draft";
    const options = normalizeOptions(body.options, body.correct_option);

    if (!subject || !grade || !questionText || !options.some((option) => option.is_correct)) {
      return NextResponse.json(
        { success: false, error: "subject, grade, question_text and correct option are required" },
        { status: 400 }
      );
    }

    const db = getAdminClient();
    const createdBy = await getCreatedBy(admin.user.id);
    const { data: question, error: questionError } = await db
      .from("weekly_questions")
      .insert({
        subject,
        grade,
        skill,
        difficulty,
        question_text: questionText,
        week_number: weekNumber,
        status,
        created_by: createdBy,
      })
      .select("*")
      .single();

    if (questionError) throw questionError;

    const { error: optionsError } = await db
      .from("question_options")
      .insert(options.map((option) => ({ ...option, question_id: question.id })));

    if (optionsError) {
      await db.from("weekly_questions").delete().eq("id", question.id);
      throw optionsError;
    }

    const { data, error } = await db
      .from("weekly_questions")
      .select("*, question_options(option_label, option_text, is_correct)")
      .eq("id", question.id)
      .single();

    if (error) throw error;

    return NextResponse.json(
      { success: true, data: normalizeQuestion(data as QuestionRow) },
      { status: 201 }
    );
  } catch (err) {
    console.error("admin question create failed", err);
    return NextResponse.json(
      { success: false, error: "تعذر حفظ السؤال" },
      { status: 500 }
    );
  }
}
