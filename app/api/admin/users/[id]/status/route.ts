import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, requireAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

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
    const status = body.status === "موقوف" ? "موقوف" : "نشط";
    const db = getAdminClient();

    const { data, error } = await db
      .from("users")
      .update({ status })
      .eq("id", params.id)
      .select("id, auth_id, name, email, role, school_id, status, schools(name)")
      .single();

    if (error) throw error;

    if (data?.auth_id) {
      await db.auth.admin.updateUserById(String(data.auth_id), {
        ban_duration: status === "موقوف" ? "876000h" : "none",
      });
    }

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
