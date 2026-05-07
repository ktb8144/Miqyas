import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { registerSchool } from "@/lib/supabase-admin";

const registerSchoolSchema = z.object({
  principalName: z.string().trim().min(1),
  schoolName: z.string().trim().min(1),
  city: z.string().trim().min(1),
  schoolType: z.string().trim().min(1).default("حكومية"),
  phone: z.string().trim().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const parsed = registerSchoolSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "جميع الحقول مطلوبة" }, { status: 400 });
    }

    const { principalName, schoolName, city, schoolType, phone } = parsed.data;
    const result = await registerSchool({
      principal_name: principalName,
      school_name: schoolName,
      city,
      school_type: schoolType || "حكومية",
      phone,
    });

    return NextResponse.json({ success: true, school: result });
  } catch (err) {
    console.error("register school failed", err);
    return NextResponse.json({ error: "تعذر إرسال طلب التسجيل حاليًا" }, { status: 500 });
  }
}
