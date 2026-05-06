import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, requireAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const VALID_ROLES = new Set(["admin", "principal", "teacher"]);

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
      .select("id, auth_id, name, email, role, school_id, status, schools(name)")
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: (data ?? []).map((row) => normalizeUser(row)),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: message },
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
    const body = await req.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const role = typeof body.role === "string" ? body.role.trim() : "";
    const schoolId = typeof body.school_id === "string" && body.school_id.trim() ? body.school_id.trim() : null;

    if (!name || !email || !VALID_ROLES.has(role)) {
      return NextResponse.json(
        { success: false, error: "name, email and valid role are required" },
        { status: 400 }
      );
    }

    if (role !== "admin" && !schoolId) {
      return NextResponse.json(
        { success: false, error: "school_id is required for principal and teacher users" },
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
        status: "نشط",
      })
      .select("id, auth_id, name, email, role, school_id, status, schools(name)")
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
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
