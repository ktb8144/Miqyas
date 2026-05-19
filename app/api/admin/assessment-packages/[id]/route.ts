import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminClient, requireAdmin } from "@/lib/supabase-admin";
import { parseWeeklyAnswerKey, syncWeeklyQuestionsFromAnswerKey, WeeklyAnswerKeyValidationError } from "@/lib/weekly-answer-key";

export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

const packageUpdateSchema = z.object({
  title: z.string().trim().min(1).optional(),
  description: z.string().trim().optional().nullable(),
  subject: z.string().trim().min(1).optional(),
  grade: z.coerce.number().int().min(1).max(12).optional(),
  week_number: z.coerce.number().int().min(1).max(60).optional().nullable(),
  start_date: z.string().trim().optional().nullable(),
  end_date: z.string().trim().optional().nullable(),
  duration_minutes: z.coerce.number().int().positive().optional().nullable(),
  package_type: z.string().trim().optional(),
  student_pdf_url: z.string().trim().url().optional().or(z.literal("")).nullable(),
  questions_pdf_url: z.string().trim().url().optional().or(z.literal("")).nullable(),
  teacher_pdf_url: z.string().trim().url().optional().or(z.literal("")).nullable(),
  answer_sheet_pdf_url: z.string().trim().url().optional().or(z.literal("")).nullable(),
  answer_key_file_url: z.string().trim().url().optional().or(z.literal("")).nullable(),
  answer_key_json: z.unknown().optional(),
  status: z.enum(["draft", "published", "archived"]).optional(),
});

function emptyToNull(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

async function loadCounts(packageId: string, assessmentPackage?: { subject?: string | null; grade?: number | string | null; week_number?: number | null; start_date?: string | null }) {
  const db = getAdminClient();
  const [questionResult, schoolResult] = await Promise.all([
    db.from("package_questions").select("id", { count: "exact", head: true }).eq("package_id", packageId),
    db.from("school_package_assignments").select("id", { count: "exact", head: true }).eq("package_id", packageId),
  ]);

  if (questionResult.error) throw questionResult.error;
  if (schoolResult.error) throw schoolResult.error;
  let weeklyQuestionCount = 0;
  if (assessmentPackage?.subject && assessmentPackage.grade && assessmentPackage.week_number) {
    const assessmentDate = assessmentPackage.start_date ?? new Date().toISOString().slice(0, 10);
    const { data, error } = await db
      .from("weekly_questions")
      .select("sort_order")
      .eq("subject", assessmentPackage.subject)
      .eq("grade", assessmentPackage.grade)
      .eq("week_number", assessmentPackage.week_number)
      .eq("assessment_date", assessmentDate);
    if (error) throw error;
    weeklyQuestionCount = new Set((data ?? []).map((item) => Number(item.sort_order)).filter(Number.isFinite)).size;
  }
  return {
    question_count: Math.max(questionResult.count ?? 0, weeklyQuestionCount),
    assigned_school_count: schoolResult.count ?? 0,
  };
}

export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  try {
    const db = getAdminClient();
    const { data: assessmentPackage, error } = await db
      .from("assessment_packages")
      .select("*")
      .eq("id", params.id)
      .maybeSingle();

    if (error) throw error;
    if (!assessmentPackage) {
      return NextResponse.json({ success: false, error: "لم يتم العثور على حزمة الاختبار" }, { status: 404 });
    }

    const [{ data: questions, error: questionsError }, counts] = await Promise.all([
      db
        .from("package_questions")
        .select(`
          id,
          package_id,
          question_number,
          correct_option,
          nafs_domain_id,
          skill_id,
          difficulty_level,
          points,
          question_text,
          remediation_note,
          created_at,
          nafs_domains(domain_name, domain_code),
          learning_skills(skill_name, skill_code)
        `)
        .eq("package_id", params.id)
        .order("question_number", { ascending: true }),
      loadCounts(params.id, assessmentPackage),
    ]);

    if (questionsError) throw questionsError;

    return NextResponse.json({
      success: true,
      data: {
        ...assessmentPackage,
        ...counts,
        questions: questions ?? [],
      },
    });
  } catch (err) {
    console.error("admin assessment package detail failed", err);
    return NextResponse.json(
      { success: false, error: "تعذر تحميل تفاصيل حزمة الاختبار" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  try {
    const parsed = packageUpdateSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "بيانات الحزمة غير صحيحة" }, { status: 400 });
    }

    const db = getAdminClient();
    const { data: existing, error: existingError } = await db
      .from("assessment_packages")
      .select("id, status")
      .eq("id", params.id)
      .maybeSingle();

    if (existingError) throw existingError;
    if (!existing) {
      return NextResponse.json({ success: false, error: "لم يتم العثور على حزمة الاختبار" }, { status: 404 });
    }

    if (existing.status === "archived" && parsed.data.status !== "draft" && parsed.data.status !== "published") {
      return NextResponse.json(
        { success: false, error: "الحزمة مؤرشفة. غيّر الحالة أولًا قبل تعديل البيانات." },
        { status: 400 }
      );
    }

    const { answer_key_json: answerKeyJson, ...body } = parsed.data;
    if (answerKeyJson) {
      parseWeeklyAnswerKey(answerKeyJson);
    }

    const payload = {
      ...body,
      description: body.description === undefined ? undefined : emptyToNull(body.description),
      start_date: body.start_date === undefined ? undefined : emptyToNull(body.start_date),
      end_date: body.end_date === undefined ? undefined : emptyToNull(body.end_date),
      student_pdf_url: body.student_pdf_url === undefined ? undefined : emptyToNull(body.student_pdf_url),
      questions_pdf_url: body.questions_pdf_url === undefined ? undefined : emptyToNull(body.questions_pdf_url) ?? emptyToNull(body.student_pdf_url),
      teacher_pdf_url: body.teacher_pdf_url === undefined ? undefined : emptyToNull(body.teacher_pdf_url),
      answer_sheet_pdf_url: body.answer_sheet_pdf_url === undefined ? undefined : emptyToNull(body.answer_sheet_pdf_url),
      answer_key_file_url: body.answer_key_file_url === undefined ? undefined : emptyToNull(body.answer_key_file_url),
    };

    const { data, error } = await db
      .from("assessment_packages")
      .update(payload)
      .eq("id", params.id)
      .select("*")
      .single();

    if (error) throw error;
    if (answerKeyJson) {
      await syncWeeklyQuestionsFromAnswerKey({
        db,
        authId: auth.user.id,
        assessmentPackage: {
          id: data.id,
          subject: data.subject,
          grade: data.grade,
          week_number: data.week_number,
          start_date: data.start_date,
        },
        answerKeyInput: answerKeyJson,
      });
    }

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error("admin assessment package update failed", err);
    if (err instanceof WeeklyAnswerKeyValidationError) {
      return NextResponse.json({ success: false, error: err.message }, { status: 400 });
    }
    return NextResponse.json(
      { success: false, error: "تعذر تحديث حزمة الاختبار" },
      { status: 500 }
    );
  }
}
