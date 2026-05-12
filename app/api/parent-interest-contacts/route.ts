import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminClient } from "@/lib/supabase-admin";
import { hashParentReportToken } from "@/lib/parent-report";

export const dynamic = "force-dynamic";

const CONSENT_TEXT =
  "أوافق على استخدام رقم الواتساب أو البريد الإلكتروني للتواصل معي بخصوص خطة التدريب الإضافية في مِقياس لهذا الطالب فقط.";

const schema = z.object({
  token: z.string().trim().min(20),
  eventId: z.string().uuid(),
  whatsappPhone: z.string().trim().max(30).optional().or(z.literal("")),
  email: z.string().trim().max(180).optional().or(z.literal("")),
  relation: z.string().trim().max(40).optional().or(z.literal("")),
  consentAccepted: z.boolean().optional().default(false),
});

function cleanPhone(value: string) {
  return value.replace(/[\s-]/g, "");
}

function isValidSaudiPhone(value: string) {
  const phone = cleanPhone(value);
  return /^(\+9665\d{8}|05\d{8})$/.test(phone);
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(req: NextRequest) {
  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "بيانات التواصل غير مكتملة" }, { status: 400 });
    }

    const whatsappPhone = parsed.data.whatsappPhone?.trim() ?? "";
    const email = parsed.data.email?.trim() ?? "";
    const relation = parsed.data.relation?.trim() ?? null;

    if (!whatsappPhone && !email) {
      return NextResponse.json(
        { success: false, error: "أدخل رقم واتساب أو بريدًا إلكترونيًا لحفظ بيانات التواصل" },
        { status: 400 }
      );
    }

    if (!parsed.data.consentAccepted) {
      return NextResponse.json(
        { success: false, error: "يجب الموافقة على استخدام بيانات التواصل لهذا الغرض قبل الحفظ" },
        { status: 400 }
      );
    }

    if (whatsappPhone && !isValidSaudiPhone(whatsappPhone)) {
      return NextResponse.json(
        { success: false, error: "أدخل رقم واتساب سعودي صحيح يبدأ بـ 05 أو +966" },
        { status: 400 }
      );
    }

    if (email && !isValidEmail(email)) {
      return NextResponse.json({ success: false, error: "أدخل بريدًا إلكترونيًا صحيحًا" }, { status: 400 });
    }

    const db = getAdminClient();
    const now = new Date().toISOString();
    const { data: tokenRow, error: tokenError } = await db
      .from("parent_report_tokens")
      .select("id")
      .eq("token_hash", hashParentReportToken(parsed.data.token))
      .gt("expires_at", now)
      .is("revoked_at", null)
      .maybeSingle();

    if (tokenError) throw tokenError;
    if (!tokenRow) {
      return NextResponse.json({ success: false, error: "رابط التدريب غير صالح أو منتهي" }, { status: 404 });
    }

    const { data: eventRow, error: eventError } = await db
      .from("parent_report_events")
      .select("id, token_id, event_type")
      .eq("id", parsed.data.eventId)
      .eq("token_id", tokenRow.id)
      .eq("event_type", "subscription_interest")
      .maybeSingle();

    if (eventError) throw eventError;
    if (!eventRow) {
      return NextResponse.json({ success: false, error: "تعذر ربط بيانات التواصل بطلب اهتمام صحيح" }, { status: 400 });
    }

    const { error: insertError } = await db
      .from("parent_interest_contacts")
      .insert({
        event_id: eventRow.id,
        token_id: tokenRow.id,
        whatsapp_phone: whatsappPhone ? cleanPhone(whatsappPhone) : null,
        email: email || null,
        relation,
        consent_text: CONSENT_TEXT,
      });

    if (insertError) throw insertError;

    return NextResponse.json({ success: true, message: "تم حفظ بيانات التواصل بنجاح" });
  } catch (err) {
    console.error("parent interest contact failed", err);
    return NextResponse.json({ success: false, error: "تعذر حفظ بيانات التواصل" }, { status: 500 });
  }
}
