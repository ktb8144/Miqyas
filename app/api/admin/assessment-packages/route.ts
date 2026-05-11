import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminClient, requireAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const packageSchema = z.object({
  title: z.string().trim().min(1, "عنوان الحزمة مطلوب"),
  description: z.string().trim().optional().nullable(),
  subject: z.string().trim().min(1, "المادة مطلوبة"),
  grade: z.coerce.number().int().min(1).max(12),
  week_number: z.coerce.number().int().min(1).max(60).optional().nullable(),
  start_date: z.string().trim().optional().nullable(),
  end_date: z.string().trim().optional().nullable(),
  duration_minutes: z.coerce.number().int().positive().optional().nullable(),
  package_type: z.string().trim().optional().default("weekly"),
  student_pdf_url: z.string().trim().url().optional().or(z.literal("")).nullable(),
  questions_pdf_url: z.string().trim().url().optional().or(z.literal("")).nullable(),
  teacher_pdf_url: z.string().trim().url().optional().or(z.literal("")).nullable(),
  answer_sheet_pdf_url: z.string().trim().url().optional().or(z.literal("")).nullable(),
  answer_key_file_url: z.string().trim().url().optional().or(z.literal("")).nullable(),
  status: z.enum(["draft", "published", "archived"]).optional().default("draft"),
});

type PackageRow = {
  id: string;
  title: string;
  description: string | null;
  subject: string;
  grade: number;
  week_number: number | null;
  duration_minutes: number | null;
  package_type: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
  student_pdf_url: string | null;
  questions_pdf_url: string | null;
  teacher_pdf_url: string | null;
  answer_sheet_pdf_url: string | null;
  answer_key_file_url: string | null;
  published_at: string | null;
  created_at: string;
};

function emptyToNull(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

async function countPackageRows(packageIds: string[], table: "package_questions" | "school_package_assignments") {
  const db = getAdminClient();
  const entries = await Promise.all(
    packageIds.map(async (packageId) => {
      const { count, error } = await db
        .from(table)
        .select("id", { count: "exact", head: true })
        .eq("package_id", packageId);
      if (error) throw error;
      return [packageId, count ?? 0] as const;
    })
  );
  return new Map(entries);
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

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
    const [questionCounts, schoolCounts] = await Promise.all([
      countPackageRows(packageIds, "package_questions"),
      countPackageRows(packageIds, "school_package_assignments"),
    ]);

    return NextResponse.json({
      success: true,
      data: packages.map((item) => ({
        ...item,
        package_type: item.package_type ?? "weekly",
        question_count: questionCounts.get(item.id) ?? 0,
        assigned_school_count: schoolCounts.get(item.id) ?? 0,
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
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  try {
    const parsed = packageSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0]?.message ?? "بيانات الحزمة غير صحيحة" }, { status: 400 });
    }

    const body = parsed.data;
    const { data, error } = await getAdminClient()
      .from("assessment_packages")
      .insert({
        title: body.title,
        description: emptyToNull(body.description),
        subject: body.subject,
        grade: body.grade,
        week_number: body.week_number ?? null,
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
    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error("admin assessment package create failed", err);
    return NextResponse.json(
      { success: false, error: "تعذر إنشاء حزمة الاختبار" },
      { status: 500 }
    );
  }
}
