import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, requireAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const VALID_ROLES = new Set(["admin", "principal", "teacher"]);

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
    const body = await req.json();
    const updates: Record<string, string | null> = {};

    if (typeof body.name === "string") updates.name = body.name.trim();
    if (typeof body.email === "string") updates.email = body.email.trim().toLowerCase();
    if (typeof body.role === "string" && VALID_ROLES.has(body.role.trim())) updates.role = body.role.trim();
    if (typeof body.school_id === "string") updates.school_id = body.school_id.trim() || null;

    if (updates.role === "admin") {
      updates.school_id = null;
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
      .select("id, auth_id, name, email, role, school_id, status, schools(name)")
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: normalizeUser(data),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
