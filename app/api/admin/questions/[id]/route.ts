import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, requireAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const OPTION_LABELS = ["أ", "ب", "ج", "د"];
const VALID_STATUSES = new Set(["draft", "active", "archived"]);

type Params = {
  params: {
    id: string;
  };
};

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

export async function PATCH(req: NextRequest, { params }: Params) {
  const admin = await requireAdmin(req);

  if (!admin.ok) {
    return NextResponse.json(
      { success: false, error: admin.error },
      { status: admin.status }
    );
  }

  try {
    const body = await req.json();
    const updates: Record<string, string | number | boolean> = {};

    if (typeof body.subject === "string") updates.subject = body.subject.trim();
    if (typeof body.grade === "string") updates.grade = body.grade.trim();
    if (typeof body.skill === "string") updates.skill = body.skill.trim();
    if (typeof body.difficulty === "string") updates.difficulty = body.difficulty.trim();
    if (typeof body.question_text === "string") updates.question_text = body.question_text.trim();
    if (body.week_number !== undefined) updates.week_number = Number(body.week_number || 0);
    if (VALID_STATUSES.has(body.status)) {
      updates.status = body.status;
    }

    const db = getAdminClient();
    if (Object.keys(updates).length > 0) {
      const { error } = await db
        .from("weekly_questions")
        .update(updates)
        .eq("id", params.id);

      if (error) throw error;
    }

    if (body.options || body.correct_option) {
      const options = normalizeOptions(body.options, body.correct_option);
      const { error: deleteError } = await db
        .from("question_options")
        .delete()
        .eq("question_id", params.id);

      if (deleteError) throw deleteError;

      const { error: insertError } = await db
        .from("question_options")
        .insert(options.map((option) => ({ ...option, question_id: params.id })));

      if (insertError) throw insertError;
    }

    const { data, error } = await db
      .from("weekly_questions")
      .select("*, question_options(option_label, option_text, is_correct)")
      .eq("id", params.id)
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: normalizeQuestion(data as QuestionRow),
    });
  } catch (err) {
    console.error("admin question update failed", err);
    return NextResponse.json(
      { success: false, error: "تعذر تحديث السؤال" },
      { status: 500 }
    );
  }
}
