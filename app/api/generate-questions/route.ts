import { NextRequest, NextResponse } from "next/server";
import { generateQuestions } from "@/lib/gemini";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      grade,
      subject,
      skill,
      bloomLevel = "التطبيق",
      count = 10,
    } = body;

    if (!grade || !subject || !skill) {
      return NextResponse.json({ error: "grade, subject, and skill are required" }, { status: 400 });
    }

    const questions = await generateQuestions(grade, subject, skill, bloomLevel, count);
    return NextResponse.json({ success: true, questions });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
