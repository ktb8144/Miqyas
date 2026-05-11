import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, requireUserRole } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

type PackageRow = {
  id: string;
  title: string;
  description: string | null;
  subject: string;
  grade: number;
  week_number: number | null;
  start_date: string | null;
  end_date: string | null;
  status: string;
  student_pdf_url: string | null;
  teacher_pdf_url: string | null;
  answer_sheet_pdf_url: string | null;
  published_at: string | null;
  created_at: string;
};

async function countPackageQuestions(packageIds: string[]) {
  if (!packageIds.length) return new Map<string, number>();

  const counts = await Promise.all(
    packageIds.map(async (packageId) => {
      const { count, error } = await getAdminClient()
        .from("package_questions")
        .select("id", { count: "exact", head: true })
        .eq("package_id", packageId);

      if (error) throw error;
      return [packageId, count ?? 0] as const;
    })
  );

  return new Map(counts);
}

export async function GET(req: NextRequest) {
  const auth = await requireUserRole(req, ["admin", "principal", "teacher"]);
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  try {
    const db = getAdminClient();
    const { searchParams } = new URL(req.url);
    const subject = searchParams.get("subject")?.trim();
    const grade = Number(searchParams.get("grade") ?? 0);

    let packageIds: string[] | null = null;
    if (auth.profile.role !== "admin") {
      const { data: assignments, error: assignmentsError } = await db
        .from("school_package_assignments")
        .select("package_id")
        .eq("school_id", auth.profile.school_id)
        .in("status", ["available", "active", "completed"]);

      if (assignmentsError) throw assignmentsError;
      packageIds = (assignments ?? []).map((assignment) => String(assignment.package_id));
      if (!packageIds.length) {
        return NextResponse.json({ success: true, packages: [] });
      }
    }

    let query = db
      .from("assessment_packages")
      .select(`
        id,
        title,
        description,
        subject,
        grade,
        week_number,
        start_date,
        end_date,
        status,
        student_pdf_url,
        teacher_pdf_url,
        answer_sheet_pdf_url,
        published_at,
        created_at
      `)
      .order("week_number", { ascending: true })
      .order("created_at", { ascending: false });

    if (auth.profile.role !== "admin") query = query.eq("status", "published");
    if (packageIds) query = query.in("id", packageIds);
    if (subject) query = query.eq("subject", subject);
    if (Number.isInteger(grade) && grade > 0) query = query.eq("grade", grade);

    const { data, error } = await query;
    if (error) throw error;

    const rows = (data ?? []) as PackageRow[];
    const counts = await countPackageQuestions(rows.map((row) => row.id));

    return NextResponse.json({
      success: true,
      packages: rows.map((row) => ({
        ...row,
        question_count: counts.get(row.id) ?? 0,
      })),
    });
  } catch (err) {
    console.error("packages list failed", err);
    return NextResponse.json(
      { success: false, error: "تعذر تحميل حزم التقييم" },
      { status: 500 }
    );
  }
}
