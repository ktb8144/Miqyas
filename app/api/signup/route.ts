import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminClient } from "@/lib/supabase-admin";
import { emptyToNull } from "@/lib/api";
import { normalizeSaudiMobile, toEnglishDigits } from "@/lib/format";
import {
  deleteAuthUserQuietly,
  describeEmailRateLimit,
  describeProfileInsertError,
  findProfileConflict,
  inviteOrCreateAuthUser,
} from "@/lib/invite";
import { normalizeJoinCode, provisionSchool } from "@/lib/schools";

export const dynamic = "force-dynamic";

const base = {
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email(),
  phone: z.string().trim().max(20).optional(),
  acceptTerms: z.literal(true),
  /** Honeypot: real people never fill it. */
  website: z.string().max(0).optional(),
};

const schema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("school"),
    ...base,
    schoolName: z.string().trim().min(2).max(160),
    city: z.string().trim().min(2).max(80),
    ministryNumber: z.string().trim().min(3).max(12),
    gender: z.enum(["boys", "girls"]),
  }),
  z.object({
    type: z.literal("join"),
    ...base,
    joinCode: z.string().trim().min(4).max(12),
    subject: z.string().trim().max(80).optional(),
  }),
  z.object({
    type: z.literal("individual"),
    ...base,
    schoolName: z.string().trim().min(2).max(160),
    city: z.string().trim().min(2).max(80),
    subject: z.string().trim().max(80).optional(),
  }),
]);

const SENT = "أرسلنا رابط التفعيل إلى بريدك. افتحه لتختار كلمة المرور وتبدأ مباشرة. تحقق من البريد غير المرغوب فيه إن لم تجده.";

/**
 * Self-signup for a school principal, a teacher joining with the school's code, or an
 * independent teacher. Email ownership is proven by the activation link (same flow as
 * invitations), and nothing is created unless every step succeeds.
 */
export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const missingTerms = parsed.error.issues.some((issue) => issue.path[0] === "acceptTerms");
    return NextResponse.json(
      { success: false, error: missingTerms ? "يجب الموافقة على الشروط وسياسة الخصوصية" : "تحقق من البيانات المطلوبة" },
      { status: 400 }
    );
  }

  const input = parsed.data;
  const db = getAdminClient();
  const email = input.email.toLowerCase();
  const phone = input.phone?.trim() ? normalizeSaudiMobile(input.phone) : null;
  if (phone && !/^05\d{8}$/.test(phone)) {
    return NextResponse.json({ success: false, error: "اكتب رقم الجوال بصيغة 05xxxxxxxx أو اتركه فارغًا" }, { status: 400 });
  }

  let createdSchoolId: string | null = null;
  let createdAuthId: string | null = null;

  try {
    const conflict = await findProfileConflict(email, phone);
    if (conflict) {
      const message = conflict.includes("البريد")
        ? "هذا البريد مسجّل في دالة. سجّل الدخول، أو استخدم «نسيت كلمة المرور»."
        : conflict;
      return NextResponse.json({ success: false, error: message }, { status: 409 });
    }

    // ── Where the account belongs ──────────────────────────────────────────
    let schoolId: string;
    let role: "principal" | "teacher";
    let subject: string | null = null;

    if (input.type === "join") {
      const code = normalizeJoinCode(input.joinCode);
      const { data: school, error } = await db
        .from("schools")
        .select("id, active")
        .eq("join_code", code)
        .eq("kind", "school")
        .maybeSingle();
      if (error) throw error;
      if (!school) {
        return NextResponse.json({ success: false, error: "رمز المدرسة غير صحيح. اطلبه من قائد مدرستك." }, { status: 404 });
      }
      if (school.active === false) {
        return NextResponse.json({ success: false, error: "حساب هذه المدرسة موقوف حاليًا." }, { status: 403 });
      }
      schoolId = school.id;
      role = "teacher";
      subject = emptyToNull(input.subject);
    } else if (input.type === "school") {
      const ministryNumber = toEnglishDigits(input.ministryNumber).replace(/\D/g, "");
      if (ministryNumber.length < 3) {
        return NextResponse.json({ success: false, error: "اكتب الرقم الوزاري للمدرسة بالأرقام" }, { status: 400 });
      }
      const { data: existing, error } = await db.from("schools").select("id").eq("ministry_number", ministryNumber).maybeSingle();
      if (error) throw error;
      if (existing) {
        return NextResponse.json(
          { success: false, error: "هذه المدرسة مسجّلة في دالة. اطلب من قائد المدرسة رمز الانضمام، أو تواصل معنا إن كنت أنت قائدها." },
          { status: 409 }
        );
      }
      const school = await provisionSchool(db, {
        name: input.schoolName,
        city: input.city,
        kind: "school",
        ministryNumber,
        gender: input.gender,
      });
      createdSchoolId = school.id;
      schoolId = school.id;
      role = "principal";
    } else {
      const school = await provisionSchool(db, { name: input.schoolName, city: input.city, kind: "individual" });
      createdSchoolId = school.id;
      schoolId = school.id;
      role = "teacher";
      subject = emptyToNull(input.subject);
    }

    // ── Account + activation email ─────────────────────────────────────────
    const authUser = await inviteOrCreateAuthUser(email, input.name, role);
    if (authUser.created) createdAuthId = authUser.userId;

    const { error: insertError } = await db.from("users").insert({
      auth_id: authUser.userId,
      name: input.name,
      email,
      role,
      school_id: schoolId,
      subject,
      phone,
      status: "invited",
    });
    if (insertError) {
      const message = describeProfileInsertError(insertError);
      if (message) {
        await rollback(db, createdAuthId, createdSchoolId);
        return NextResponse.json({ success: false, error: message }, { status: 409 });
      }
      throw insertError;
    }

    return NextResponse.json({ success: true, message: SENT });
  } catch (err) {
    await rollback(db, createdAuthId, createdSchoolId);
    const rateLimited = describeEmailRateLimit(err);
    if (rateLimited) return NextResponse.json({ success: false, error: rateLimited }, { status: 429 });
    console.error("signup failed", err);
    return NextResponse.json({ success: false, error: "تعذر إكمال التسجيل حاليًا. حاول بعد قليل." }, { status: 500 });
  }
}

/** Removes only what this request created (a brand-new, empty school and auth account). */
async function rollback(db: ReturnType<typeof getAdminClient>, authId: string | null, schoolId: string | null) {
  if (authId) await deleteAuthUserQuietly(authId);
  if (schoolId) {
    await db.from("school_package_assignments").delete().eq("school_id", schoolId);
    const { error } = await db.from("schools").delete().eq("id", schoolId);
    if (error) console.error("signup rollback: school delete failed", schoolId, error);
  }
}
