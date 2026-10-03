import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminClient } from "@/lib/supabase-admin";
import { requireAdmin, authErrorResponse } from "@/lib/auth";
import { normalizeUser } from "@/lib/admin/normalize";
import { getInviteRedirectTo } from "@/lib/api";

export const dynamic = "force-dynamic";

const userCreateSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().trim().email(),
  role: z.enum(["admin", "principal", "supervisor", "teacher"]),
  school_id: z.string().uuid().nullable().optional(),
  subject: z.string().trim().nullable().optional(),
  phone: z.string().trim().max(20).nullable().optional(),
});

function createTemporaryPassword() {
  const random = crypto.getRandomValues(new Uint32Array(2)).join("");
  return `Miqyas@${random}!`;
}

async function createInvitedAuthUser(db: ReturnType<typeof getAdminClient>, email: string, name: string, role: string) {
  const metadata = { name, role };
  const redirectTo = getInviteRedirectTo();
  const { data: invited, error: inviteError } = await db.auth.admin.inviteUserByEmail(email, {
    data: metadata,
    redirectTo,
  });

  if (!inviteError && invited.user) {
    return { userId: invited.user.id, method: "email_invite", actionLink: null as string | null };
  }

  const { data: created, error: createError } = await db.auth.admin.createUser({
    email,
    password: createTemporaryPassword(),
    email_confirm: false,
    user_metadata: metadata,
  });

  if (createError || !created.user) throw createError ?? new Error("Failed to create auth user");

  const { data: linkData, error: linkError } = await db.auth.admin.generateLink({
    type: "recovery",
    email,
    options: {
      redirectTo,
    },
  });

  return {
    userId: created.user.id,
    method: linkError ? "temporary_password_created" : "password_reset_link",
    actionLink: linkData?.properties?.action_link ?? null,
  };
}

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

    const { data: existing, error: existingError } = await db
      .from("users")
      .select("id")
      .ilike("email", email)
      .maybeSingle();

    if (existingError) throw existingError;
    if (existing) {
      return NextResponse.json(
        { success: false, error: "يوجد مستخدم بهذا البريد مسبقًا" },
        { status: 409 }
      );
    }

    const authUser = await createInvitedAuthUser(db, email, name, role);

    const { data, error } = await db
      .from("users")
      .insert({
        auth_id: authUser.userId,
        name,
        email,
        role,
        school_id: role === "admin" ? null : schoolId,
        subject: role === "teacher" ? parsed.data.subject ?? null : null,
        phone: parsed.data.phone ?? null,
        status: "invited",
      })
      .select("id, auth_id, name, email, role, school_id, phone, schools(name)")
      .single();

    if (error) throw error;

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
