import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminClient } from "@/lib/supabase-admin";
import { requireUserRole, authErrorResponse } from "@/lib/auth";
import { describeEmailRateLimit, inviteOrCreateAuthUser, resendAccessEmail } from "@/lib/invite";

export const dynamic = "force-dynamic";

const schema = z.object({ user_id: z.string().uuid() });

/** Sends a fresh invitation (or password-reset) link to a user the caller manages. */
export async function POST(req: NextRequest) {
  const auth = await requireUserRole(req, ["admin", "principal"]);
  if (!auth.ok) return authErrorResponse(auth);

  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "طلب غير صالح" }, { status: 400 });
    }

    const db = getAdminClient();
    const { data: target, error } = await db
      .from("users")
      .select("id, auth_id, name, email, role, school_id")
      .eq("id", parsed.data.user_id)
      .maybeSingle();
    if (error) throw error;

    const allowed =
      target &&
      (auth.profile.role === "admin" ||
        (target.role === "teacher" && target.school_id && target.school_id === auth.profile.school_id));
    if (!allowed) {
      return NextResponse.json({ success: false, error: "المستخدم غير موجود" }, { status: 404 });
    }

    const email = target.email?.trim().toLowerCase();
    if (!email) {
      return NextResponse.json({ success: false, error: "لا يوجد بريد إلكتروني لهذا المستخدم" }, { status: 400 });
    }

    if (!target.auth_id) {
      const authUser = await inviteOrCreateAuthUser(email, target.name ?? "", target.role);
      const { error: linkError } = await db.from("users").update({ auth_id: authUser.userId }).eq("id", target.id);
      if (linkError) throw linkError;
    } else {
      await resendAccessEmail(email, target.name ?? "", target.role);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const rateLimited = describeEmailRateLimit(err);
    if (rateLimited) return NextResponse.json({ success: false, error: rateLimited }, { status: 429 });
    console.error("resend invite failed", err);
    return NextResponse.json({ success: false, error: "تعذر إرسال الرابط حاليًا" }, { status: 500 });
  }
}
