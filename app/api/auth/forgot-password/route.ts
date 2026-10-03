import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminClient } from "@/lib/supabase-admin";
import { describeEmailRateLimit, getInviteRedirectTo } from "@/lib/invite";

export const dynamic = "force-dynamic";

const schema = z.object({ email: z.string().trim().email() });

// Same answer whether or not the email has an account, so the form can't be used to look up users.
const SENT = { success: true, message: "إذا كان البريد مسجّلًا لدينا فستصلك رسالة خلال دقائق. تحقق من البريد غير المرغوب فيه أيضًا." };

/**
 * Sends a password-reset link from the server, so the link works on any device
 * (a browser-initiated PKCE reset only works in the browser that requested it).
 */
export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "اكتب بريدًا إلكترونيًا صحيحًا" }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase();
  const db = getAdminClient();

  try {
    const { data: profile, error } = await db
      .from("users")
      .select("id, auth_id")
      .ilike("email", email)
      .not("auth_id", "is", null)
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!profile) return NextResponse.json(SENT);

    const { error: resetError } = await db.auth.resetPasswordForEmail(email, { redirectTo: getInviteRedirectTo() });
    if (resetError) throw resetError;
    return NextResponse.json(SENT);
  } catch (err) {
    const rateLimited = describeEmailRateLimit(err);
    if (rateLimited) return NextResponse.json({ success: false, error: rateLimited }, { status: 429 });
    console.error("forgot password failed", err);
    return NextResponse.json({ success: false, error: "تعذر إرسال الرابط حاليًا. حاول بعد قليل." }, { status: 500 });
  }
}
