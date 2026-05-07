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

type OptionRow = {
  option_label: string;
  option_text: string;
  is_correct?: boolean;
};

type QuestionRow = Record<string, unknown> & {
  question_options?: OptionRow[];
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
    const status = VALID_STATUSES.has(body.status) ? body.status : "draft";
    const db = getAdminClient();
    const { data, error } = await db
      .from("weekly_questions")
      .update({ status })
      .eq("id", params.id)
      .select("*, question_options(option_label, option_text, is_correct)")
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: normalizeQuestion(data as QuestionRow),
    });
  } catch (err) {
    console.error("admin question status update failed", err);
    return NextResponse.json(
      { success: false, error: "تعذر تحديث حالة السؤال" },
      { status: 500 }
    );
  }
}
