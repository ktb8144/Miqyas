import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminClient, requireAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const userCreateSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().trim().email(),
  role: z.enum(["admin", "principal", "teacher"]),
  school_id: z.string().uuid().nullable().optional(),
});

function normalizeUser(row: Record<string, unknown>) {
  const school = row.schools as { name?: string } | null | undefined;
  return {
    id: String(row.id),
    auth_id: row.auth_id ? String(row.auth_id) : null,
    name: String(row.name ?? ""),
    email: String(row.email ?? ""),
    role: String(row.role ?? "teacher"),
    school_id: row.school_id ? String(row.school_id) : null,
    school: school?.name ?? "كل المدارس",
    status: String(row.status ?? "نشط"),
  };
}

function createTemporaryPassword() {
  const suffix = Math.random().toString(36).slice(2, 10);
  return `Miqyas@${suffix}2026`;
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
      .from("users")
      .select("id, auth_id, name, email, role, school_id, schools(name)")
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: (data ?? []).map((row) => normalizeUser(row)),
    });
  } catch (err) {
    console.error("admin users list failed", err);
    return NextResponse.json(
      { success: false, error: "تعذر تحميل المستخدمين" },
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
    const parsed = userCreateSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "تحقق من بيانات المستخدم المطلوبة" },
        { status: 400 }
      );
    }

    const { name, role } = parsed.data;
    const email = parsed.data.email.toLowerCase();
    const schoolId = parsed.data.school_id ?? null;
    if (role !== "admin" && !schoolId) {
      return NextResponse.json(
        { success: false, error: "يجب ربط المدير أو المعلم بمدرسة" },
        { status: 400 }
      );
    }

    const db = getAdminClient();
    const temporaryPassword = createTemporaryPassword();
    const { data: authData, error: authError } = await db.auth.admin.createUser({
      email,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: { name, role },
    });

    if (authError) throw authError;

    const { data, error } = await db
      .from("users")
      .insert({
        auth_id: authData.user.id,
        name,
        email,
        role,
        school_id: role === "admin" ? null : schoolId,
      })
      .select("id, auth_id, name, email, role, school_id, schools(name)")
      .single();

    if (error) throw error;

    return NextResponse.json(
      {
        success: true,
        data: normalizeUser(data),
        temporaryPassword,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("admin user create failed", err);
    return NextResponse.json(
      { success: false, error: "تعذر إنشاء المستخدم" },
      { status: 500 }
    );
  }
}
