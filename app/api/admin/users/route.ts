import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminClient } from "@/lib/supabase-admin";
import { requireAdmin, authErrorResponse } from "@/lib/auth";
import { normalizeUser } from "@/lib/admin/normalize";
import {
  deleteAuthUserQuietly,
  describeProfileInsertError,
  findProfileConflict,
  inviteOrCreateAuthUser,
} from "@/lib/invite";
import { emptyToNull } from "@/lib/api";

export const dynamic = "force-dynamic";

const userCreateSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().trim().email(),
  role: z.enum(["admin", "principal", "supervisor", "teacher"]),
  school_id: z.string().uuid().nullable().optional(),
  subject: z.string().trim().nullable().optional(),
  phone: z.string().trim().max(20).nullable().optional(),
});

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);

  if (!admin.ok) return authErrorResponse(admin);

  try {
    const { data, error } = await getAdminClient()
      .from("users")
      .select("id, auth_id, name, email, role, school_id, phone, schools(name)")
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

  if (!admin.ok) return authErrorResponse(admin);

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

    const phone = emptyToNull(parsed.data.phone);
    const conflict = await findProfileConflict(email, phone);
    if (conflict) {
      return NextResponse.json({ success: false, error: conflict }, { status: 409 });
    }

    const authUser = await inviteOrCreateAuthUser(email, name, role);

    const { data, error } = await db
      .from("users")
      .insert({
        auth_id: authUser.userId,
        name,
        email,
        role,
        school_id: role === "admin" ? null : schoolId,
        subject: role === "teacher" ? parsed.data.subject ?? null : null,
        phone,
        status: "invited",
      })
      .select("id, auth_id, name, email, role, school_id, phone, schools(name)")
      .single();

    if (error) {
      if (authUser.created) await deleteAuthUserQuietly(authUser.userId);
      const message = describeProfileInsertError(error);
      if (message) return NextResponse.json({ success: false, error: message }, { status: 409 });
      throw error;
    }

    return NextResponse.json(
      {
        success: true,
        data: normalizeUser(data),
        invite: {
          method: authUser.method,
          actionLink: authUser.actionLink,
        },
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
