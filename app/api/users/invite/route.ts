import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminClient } from "@/lib/supabase-admin";
import { requireUserRole, authErrorResponse } from "@/lib/auth";
import {
  deleteAuthUserQuietly,
  describeProfileInsertError,
  findProfileConflict,
  inviteOrCreateAuthUser,
} from "@/lib/invite";
import { emptyToNull } from "@/lib/api";

export const dynamic = "force-dynamic";

const inviteUserSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email(),
  role: z.enum(["admin", "principal", "supervisor", "teacher"]),
  school_id: z.string().uuid().nullable().optional(),
  subject: z.string().trim().max(80).nullable().optional(),
  phone: z.string().trim().max(20).nullable().optional(),
});

function publicUser(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    auth_id: row.auth_id ? String(row.auth_id) : null,
    name: String(row.name ?? ""),
    email: String(row.email ?? ""),
    role: String(row.role ?? "teacher"),
    school_id: row.school_id ? String(row.school_id) : null,
    subject: row.subject ? String(row.subject) : null,
    phone: row.phone ? String(row.phone) : null,
    status: String(row.status ?? "invited"),
  };
}

export async function POST(req: NextRequest) {
  const auth = await requireUserRole(req, ["admin", "principal"]);
  if (!auth.ok) return authErrorResponse(auth);

  try {
    const parsed = inviteUserSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "تحقق من بيانات المستخدم المطلوبة" },
        { status: 400 }
      );
    }

    const db = getAdminClient();
    const email = parsed.data.email.toLowerCase();
    const requestedRole = parsed.data.role;
    const currentRole = auth.profile.role;
    const currentSchoolId = auth.profile.school_id as string | null;

    let targetSchoolId = parsed.data.school_id ?? null;
    if (currentRole === "principal") {
      if (requestedRole !== "teacher") {
        return NextResponse.json(
          { success: false, error: "قائد المدرسة يستطيع إضافة معلمين فقط" },
          { status: 403 }
        );
      }
      if (!currentSchoolId) {
        return NextResponse.json(
          { success: false, error: "حسابك غير مرتبط بمدرسة" },
          { status: 403 }
        );
      }
      targetSchoolId = currentSchoolId;
    }

    if (currentRole === "admin" && requestedRole !== "admin" && !targetSchoolId) {
      return NextResponse.json(
        { success: false, error: "يجب ربط المستخدم بمدرسة" },
        { status: 400 }
      );
    }

    const phone = emptyToNull(parsed.data.phone);
    const conflict = await findProfileConflict(email, phone);
    if (conflict) {
      return NextResponse.json({ success: false, error: conflict }, { status: 409 });
    }

    if (targetSchoolId) {
      const { data: school, error: schoolError } = await db
        .from("schools")
        .select("id")
        .eq("id", targetSchoolId)
        .maybeSingle();

      if (schoolError) throw schoolError;
      if (!school) {
        return NextResponse.json(
          { success: false, error: "المدرسة غير موجودة" },
          { status: 400 }
        );
      }
    }

    const authUser = await inviteOrCreateAuthUser(email, parsed.data.name, requestedRole);

    const { data: userRow, error: insertError } = await db
      .from("users")
      .insert({
        auth_id: authUser.userId,
        name: parsed.data.name,
        email,
        role: requestedRole,
        school_id: requestedRole === "admin" ? null : targetSchoolId,
        subject: requestedRole === "teacher" ? parsed.data.subject ?? null : null,
        phone,
        status: "invited",
      })
      .select("id, auth_id, name, email, role, school_id, subject, phone, status")
      .single();

    if (insertError) {
      if (authUser.created) await deleteAuthUserQuietly(authUser.userId);
      const message = describeProfileInsertError(insertError);
      if (message) return NextResponse.json({ success: false, error: message }, { status: 409 });
      throw insertError;
    }

    return NextResponse.json(
      {
        success: true,
        user: publicUser(userRow),
        invite: {
          method: authUser.method,
          actionLink: authUser.actionLink,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("invite user failed", err);
    return NextResponse.json(
      { success: false, error: "تعذر إرسال الدعوة حاليًا" },
      { status: 500 }
    );
  }
}
