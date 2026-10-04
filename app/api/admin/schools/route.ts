import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminClient } from "@/lib/supabase-admin";
import { requireAdmin, authErrorResponse } from "@/lib/auth";
import { normalizeSchool, schoolErrorResponse } from "@/lib/admin/normalize";
import { logDbError } from "@/lib/api";
import { fetchAllRows } from "@/lib/db/paginate";
import { average } from "@/lib/math";

export const dynamic = "force-dynamic";

const schoolCreateSchema = z.object({
  name: z.string().trim().min(1),
  city: z.string().trim().min(1),
  region: z.string().trim().min(1).nullable().optional(),
  type: z.string().trim().min(1).default("حكومية"),
  subscription_type: z.string().trim().min(1).default("trial"),
  subscription_start: z.string().trim().min(1).optional(),
  subscription_end: z.string().trim().min(1).optional(),
  active: z.boolean().default(true),
  trial: z.boolean().default(true),
});

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);

  if (!admin.ok) return authErrorResponse(admin);

  try {
    const db = getAdminClient();
    const [schoolsRes, staffRes, students, results] = await Promise.all([
      db.from("schools").select("*").order("created_at", { ascending: false }),
      db.from("users").select("school_id, name, role, status, auth_id").in("role", ["principal", "teacher"]).not("school_id", "is", null),
      fetchAllRows<{ school_id: string }>((from, to) => db.from("students").select("school_id").order("id").range(from, to)),
      fetchAllRows<{ school_id: string; percentage: number | string | null }>((from, to) =>
        db.from("student_package_results").select("school_id, percentage").order("id").range(from, to)
      ),
    ]);
    if (schoolsRes.error) throw schoolsRes.error;
    if (staffRes.error) throw staffRes.error;

    const count = (rows: { school_id: string }[]) => {
      const map = new Map<string, number>();
      for (const row of rows) map.set(row.school_id, (map.get(row.school_id) ?? 0) + 1);
      return map;
    };
    const staff = staffRes.data ?? [];
    const teacherCounts = count(staff.filter((row) => row.role === "teacher") as { school_id: string }[]);
    const studentCounts = count(students);
    // Prefer a principal who has an account they can sign in with.
    const principals = new Map<string, string>();
    for (const row of [...staff].sort((a, b) => Number(Boolean(b.auth_id)) - Number(Boolean(a.auth_id)))) {
      if (row.role === "principal" && row.school_id && !principals.has(row.school_id)) principals.set(row.school_id, row.name ?? "—");
    }
    const scores = new Map<string, number[]>();
    for (const row of results) {
      const pct = Number(row.percentage);
      if (Number.isFinite(pct)) scores.set(row.school_id, [...(scores.get(row.school_id) ?? []), pct]);
    }

    return NextResponse.json({
      success: true,
      data: (schoolsRes.data ?? []).map((row) => {
        const avg = average(scores.get(row.id) ?? []);
        return normalizeSchool({
          ...row,
          principal: principals.get(row.id) ?? null,
          teachers: teacherCounts.get(row.id) ?? 0,
          students: studentCounts.get(row.id) ?? 0,
          score: avg === null ? "—" : `${avg}%`,
        });
      }),
    });
  } catch (err) {
    logDbError("admin schools list", err);
    return schoolErrorResponse(err, "تعذر تنفيذ العملية على المدارس");
  }
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);

  if (!admin.ok) return authErrorResponse(admin);

  try {
    const parsed = schoolCreateSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "تحقق من بيانات المدرسة المطلوبة: اسم المدرسة والمدينة مطلوبان" },
        { status: 400 }
      );
    }

    const {
      name,
      city,
      region = null,
      type,
      subscription_type: subscriptionType,
      active,
      trial,
    } = parsed.data;
    const subscriptionStart = parsed.data.subscription_start ?? new Date().toISOString().slice(0, 10);
    const subscriptionEnd =
      parsed.data.subscription_end ?? new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const { data, error } = await getAdminClient()
      .from("schools")
      .insert({
        name,
        city,
        region,
        type,
        subscription_type: subscriptionType,
        subscription_start: subscriptionStart,
        subscription_end: subscriptionEnd,
        active,
        trial,
      })
      .select("*")
      .single();

    if (error) throw error;

    return NextResponse.json(
      { success: true, data: normalizeSchool(data) },
      { status: 201 }
    );
  } catch (err) {
    logDbError("admin schools create", err);
    return schoolErrorResponse(err, "تعذر إنشاء المدرسة في Supabase");
  }
}
