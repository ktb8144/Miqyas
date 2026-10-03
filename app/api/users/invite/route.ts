import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminClient } from "@/lib/supabase-admin";
import { requireUserRole, authErrorResponse } from "@/lib/auth";
import { getInviteRedirectTo } from "@/lib/api";

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

function randomTemporaryPassword() {
  const random = crypto.getRandomValues(new Uint32Array(2)).join("");
  return `Miqyas@${random}!`;
}

async function createAuthUser(db: ReturnType<typeof getAdminClient>, email: string, name: string, role: string) {
  const metadata = { name, role };
  const redirectTo = getInviteRedirectTo();
  const { data: invited, error: inviteError } = await db.auth.admin.inviteUserByEmail(email, {
    data: metadata,
    redirectTo,
  });

  if (!inviteError && invited.user) {
    return { userId: invited.user.id, inviteMethod: "email_invite" };
  }

  const temporaryPassword = randomTemporaryPassword();
  const { data: created, error: createError } = await db.auth.admin.createUser({
    email,
    password: temporaryPassword,
    email_confirm: false,
    user_metadata: metadata,
  });

  if (createError || !created.user) {
    throw createError ?? new Error("Failed to create auth user");
  }

  const { data: linkData, error: linkError } = await db.auth.admin.generateLink({
    type: "recovery",
    email,
    options: {
      redirectTo,
    },
  });

  return {
    userId: created.user.id,
    inviteMethod: linkError ? "temporary_password_created" : "password_reset_link",
    actionLink: linkData?.properties?.action_link ?? null,
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

    const { data: existing, error: existingError } = await db
      .from("users")
      .select("id, email")
      .ilike("email", email)
      .maybeSingle();

    if (existingError) throw existingError;
    if (existing) {
      return NextResponse.json(
        { success: false, error: "يوجد مستخدم بهذا البريد مسبقًا" },
        { status: 409 }
      );
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

    const authUser = await createAuthUser(db, email, parsed.data.name, requestedRole);

    const { data: userRow, error: insertError } = await db
      .from("users")
      .insert({
        auth_id: authUser.userId,
        name: parsed.data.name,
        email,
        role: requestedRole,
        school_id: requestedRole === "admin" ? null : targetSchoolId,
        subject: requestedRole === "teacher" ? parsed.data.subject ?? null : null,
        phone: parsed.data.phone ?? null,
        status: "invited",
      })
      .select("id, auth_id, name, email, role, school_id, subject, phone, status")
      .single();

    if (insertError) throw insertError;

    return NextResponse.json(
      {
        success: true,
        user: publicUser(userRow),
        invite: {
          method: authUser.inviteMethod,
          actionLink: authUser.actionLink ?? null,
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
