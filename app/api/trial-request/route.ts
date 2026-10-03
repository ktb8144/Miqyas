import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminClient } from "@/lib/supabase-admin";
import { errorJson, logDbError } from "@/lib/api";

export const dynamic = "force-dynamic";

const trialRequestSchema = z.object({
  name: z.string().trim().min(1),
  school_name: z.string().trim().min(1),
  phone: z.string().trim().min(1),
  email: z.string().trim().email(),
  message: z.string().trim().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const parsed = trialRequestSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "تحقق من بيانات طلب التجربة" },
        { status: 400 }
      );
    }

    const { name, school_name: schoolName, phone, email, message } = parsed.data;
    const { data, error } = await getAdminClient()
      .from("trial_requests")
      .insert({
        name,
        school_name: schoolName,
        phone,
        email: email.toLowerCase(),
        message: message || null,
        status: "new",
      })
      .select("id, status, created_at")
      .single();

    if (error) throw error;

    return NextResponse.json(
      { success: true, data },
      { status: 201 }
    );
  } catch (err) {
    logDbError("trial request create", err);
    return errorJson("تعذر إرسال طلب التجربة حاليًا");
  }
}
