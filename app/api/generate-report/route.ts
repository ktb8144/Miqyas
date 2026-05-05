import { NextRequest, NextResponse } from "next/server";
import { generateClassReport } from "@/lib/gemini";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { teacherName, skill, grade, subject, results } = body;

    if (!teacherName || !skill || !grade || !subject || !results) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const report = await generateClassReport(teacherName, skill, grade, subject, results);
    return NextResponse.json({ success: true, report });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
