import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminClient } from "@/lib/supabase-admin";
import { requireAdmin, authErrorResponse } from "@/lib/auth";
import { normalizeUser } from "@/lib/admin/normalize";

export const dynamic = "force-dynamic";

type Params = {
  params: {
    id: string;
  };
};

const statusSchema = z.object({
  status: z.enum(["نشط", "موقوف"]),
});

export async function PATCH(req: NextRequest, { params }: Params) {
  const admin = await requireAdmin(req);

  if (!admin.ok) return authErrorResponse(admin);

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
