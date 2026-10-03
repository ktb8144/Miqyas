import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminClient } from "@/lib/supabase-admin";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

type Params = {
  params: {
    id: string;
  };
};

const statusSchema = z.object({
  status: z.enum(["نشط", "موقوف"]),
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

export async function PATCH(req: NextRequest, { params }: Params) {
  const admin = await requireAdmin(req);

  if (!admin.ok) {
    return NextResponse.json(
      { success: false, error: admin.error },
      { status: admin.status }
    );
  }

  try {
    const parsed = statusSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "حالة المستخدم غير صحيحة" },
        { status: 400 }
      );
    }

    const { status } = parsed.data;
    const db = getAdminClient();

    const { data: existingUser, error: existingError } = await db
      .from("users")
      .select("id, auth_id")
      .eq("id", params.id)
      .single();

    if (existingError) throw existingError;

    if (existingUser?.auth_id) {
      const { error: authError } = await db.auth.admin.updateUserById(String(existingUser.auth_id), {
        ban_duration: status === "موقوف" ? "876000h" : "none",
      });
      if (authError) throw authError;
    }

    const { data, error } = await db
      .from("users")
      .update({ status })
      .eq("id", params.id)
      .select("id, auth_id, name, email, role, school_id, status, schools(name)")
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: normalizeUser(data),
    });
  } catch (err) {
    console.error("admin user status update failed", err);
    return NextResponse.json(
      { success: false, error: "تعذر تحديث حالة المستخدم" },
      { status: 500 }
    );
  }
}
