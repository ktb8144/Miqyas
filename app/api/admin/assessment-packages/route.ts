import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminClient } from "@/lib/supabase-admin";
import { requireAdmin, authErrorResponse } from "@/lib/auth";
import { AssessmentValidationError, parsePackageAnswerKey, syncPackageQuestionsFromAnswerKey } from "@/lib/assessment";
import { emptyToNull } from "@/lib/api";
import { countPackageQuestions, countIncompletePackageQuestions, countRowsByPackage } from "@/lib/packages";
import type { AssessmentPackageRow } from "@/lib/db/rows";

export const dynamic = "force-dynamic";

const packageSchema = z.object({
  title: z.string().trim().min(1, "عنوان الحزمة مطلوب"),
  description: z.string().trim().optional().nullable(),
  subject: z.string().trim().min(1, "المادة مطلوبة"),
  grade: z.coerce.number().int().min(1).max(12),
  week_number: z.coerce.number().int().min(1).max(60).optional().nullable(),
  assessment_code: z.string().trim().optional().nullable(),
  start_date: z.string().trim().optional().nullable(),
  end_date: z.string().trim().optional().nullable(),
  duration_minutes: z.coerce.number().int().positive().optional().nullable(),
  package_type: z.string().trim().optional().default("weekly"),
  student_pdf_url: z.string().trim().url().optional().or(z.literal("")).nullable(),
  questions_pdf_url: z.string().trim().url().optional().or(z.literal("")).nullable(),
  teacher_pdf_url: z.string().trim().url().optional().or(z.literal("")).nullable(),
  answer_sheet_pdf_url: z.string().trim().url().optional().or(z.literal("")).nullable(),
  answer_key_file_url: z.string().trim().url().optional().or(z.literal("")).nullable(),
  answer_key_json: z.unknown().optional(),
  status: z.enum(["draft", "published", "archived"]).optional().default("draft"),
});

type PackageRow = Pick<AssessmentPackageRow, "id" | "title" | "description" | "subject" | "grade" | "week_number" | "assessment_code" | "duration_minutes" | "package_type" | "status" | "start_date" | "end_date" | "student_pdf_url" | "questions_pdf_url" | "teacher_pdf_url" | "answer_sheet_pdf_url" | "answer_key_file_url" | "published_at" | "created_at">;

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return authErrorResponse(auth);

  try {
    const db = getAdminClient();
    const { data, error } = await db
      .from("assessment_packages")
      .select(`
        id,
        title,
        description,
        subject,
        grade,
        week_number,
        assessment_code,
        duration_minutes,
        package_type,
        status,
        start_date,
        end_date,
        student_pdf_url,
        questions_pdf_url,
        teacher_pdf_url,
        answer_sheet_pdf_url,
        answer_key_file_url,
        published_at,
        created_at
      `)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const packages = (data ?? []) as PackageRow[];
    const packageIds = packages.map((item) => item.id);
    const [questionCounts, schoolCounts, incompleteQuestionCounts] = await Promise.all([
      countPackageQuestions(packageIds),
      countRowsByPackage("school_package_assignments", packageIds),
      countIncompletePackageQuestions(packageIds),
    ]);

    return NextResponse.json({
      success: true,
      data: packages.map((item) => ({
        ...item,
        package_type: item.package_type ?? "weekly",
        question_count: questionCounts.get(item.id) ?? 0,
        assigned_school_count: schoolCounts.get(item.id) ?? 0,
        incomplete_question_count: incompleteQuestionCounts.get(item.id) ?? 0,
      })),
    });
  } catch (err) {
    console.error("admin assessment packages list failed", err);
    return NextResponse.json(
      { success: false, error: "تعذر تحميل حزم الاختبارات" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return authErrorResponse(auth);

  try {
    const parsed = packageSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0]?.message ?? "بيانات الحزمة غير صحيحة" }, { status: 400 });
    }

    const body = parsed.data;
    if (body.answer_key_json) {
      parsePackageAnswerKey(body.answer_key_json);
    }

    const db = getAdminClient();
    const { data, error } = await db
      .from("assessment_packages")
      .insert({
        title: body.title,
        description: emptyToNull(body.description),
        subject: body.subject,
        grade: body.grade,
        week_number: body.week_number ?? null,
        assessment_code: emptyToNull(body.assessment_code),
        start_date: emptyToNull(body.start_date),
        end_date: emptyToNull(body.end_date),
        duration_minutes: body.duration_minutes ?? null,
        package_type: body.package_type || "weekly",
        student_pdf_url: emptyToNull(body.student_pdf_url),
        questions_pdf_url: emptyToNull(body.questions_pdf_url) ?? emptyToNull(body.student_pdf_url),
        teacher_pdf_url: emptyToNull(body.teacher_pdf_url),
        answer_sheet_pdf_url: emptyToNull(body.answer_sheet_pdf_url),
        answer_key_file_url: emptyToNull(body.answer_key_file_url),
        status: body.status ?? "draft",
      })
      .select("*")
      .single();

    if (error) throw error;
    if (body.answer_key_json) {
      await syncPackageQuestionsFromAnswerKey({
        db,
        assessmentPackage: {
          id: data.id,
          subject: data.subject,
          grade: data.grade,
        },
        answerKeyInput: body.answer_key_json,
      });
    }

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error("admin assessment package create failed", err);
    if (err instanceof AssessmentValidationError) {
      return NextResponse.json({ success: false, error: err.message }, { status: 400 });
    }
    return NextResponse.json(
      { success: false, error: "تعذر إنشاء حزمة الاختبار" },
      { status: 500 }
    );
  }
}
