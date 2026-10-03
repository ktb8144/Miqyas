import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminClient } from "@/lib/supabase-admin";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

const userUpdateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  email: z.string().trim().email().optional(),
  role: z.enum(["admin", "principal", "teacher"]).optional(),
  school_id: z.string().uuid().nullable().optional(),
});

type Params = {
  params: {
    id: string;
  };
};

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
    const parsed = userUpdateSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "تحقق من بيانات المستخدم" },
        { status: 400 }
      );
    }

    const body = parsed.data;
    const updates: Record<string, string | null> = {};

    if (body.name) updates.name = body.name;
    if (body.email) updates.email = body.email.toLowerCase();
    if (body.role) updates.role = body.role;
    if (body.school_id !== undefined) updates.school_id = body.school_id;

    if (updates.role === "admin") {
      updates.school_id = null;
    }
    if (updates.role && updates.role !== "admin" && updates.school_id === null) {
      return NextResponse.json(
        { success: false, error: "يجب ربط المدير أو المعلم بمدرسة" },
        { status: 400 }
      );
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { success: false, error: "No updates provided" },
        { status: 400 }
      );
    }

    const db = getAdminClient();
    const { data: existing, error: existingError } = await db
      .from("users")
      .select("auth_id")
      .eq("id", params.id)
      .single();

    if (existingError) throw existingError;

    if (existing?.auth_id && (updates.email || updates.name || updates.role)) {
      const { error: authError } = await db.auth.admin.updateUserById(String(existing.auth_id), {
        email: updates.email ?? undefined,
        user_metadata: {
          name: updates.name,
          role: updates.role,
        },
      });
      if (authError) throw authError;
    }

    const { data, error } = await db
      .from("users")
      .update(updates)
      .eq("id", params.id)
      .select("id, auth_id, name, email, role, school_id, schools(name)")
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: normalizeUser(data),
    });
  } catch (err) {
    console.error("admin user update failed", err);
    return NextResponse.json(
      { success: false, error: "تعذر تحديث المستخدم" },
      { status: 500 }
    );
  }
}
