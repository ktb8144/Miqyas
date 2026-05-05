import { NextRequest, NextResponse } from "next/server";
import { registerSchool } from "@/lib/supabase-admin";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { principalName, schoolName, city, schoolType, phone } = body;

    if (!principalName || !schoolName || !city || !phone) {
      return NextResponse.json({ error: "جميع الحقول مطلوبة" }, { status: 400 });
    }

    const result = await registerSchool({
      principal_name: principalName,
      school_name: schoolName,
      city,
      school_type: schoolType || "حكومية",
      phone,
    });

    return NextResponse.json({ success: true, school: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "خطأ في الخادم";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
