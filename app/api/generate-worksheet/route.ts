import { NextRequest, NextResponse } from "next/server";
import { generateWorksheet } from "@/lib/gemini";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { weakSkills, unit, grade, subject, studentName } = body;

    if (!weakSkills || !Array.isArray(weakSkills) || weakSkills.length === 0) {
      return NextResponse.json({ error: "weakSkills array is required" }, { status: 400 });
    }

    const exercises = await generateWorksheet(
      weakSkills,
      unit ?? "الكسور",
      grade ?? "الثالث",
      subject ?? "الرياضيات",
      studentName
    );

    return NextResponse.json({ success: true, exercises });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
