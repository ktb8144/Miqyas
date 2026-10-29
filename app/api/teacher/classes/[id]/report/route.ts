import { NextRequest, NextResponse } from "next/server";
import { requireUserRole, authErrorResponse } from "@/lib/auth";
import { generateJson, geminiConfigured } from "@/lib/gemini";
import { loadClassDiagnosis, ReportAccessError } from "@/lib/reports/load-class-report";
import { buildReportPrompt, parseNarrative, rulesNarrative, type ReportNarrative } from "@/lib/reports/class-report-ai";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * The class report: numbers from the class's saved results, explained by the AI.
 * The AI sees aggregated, anonymous data only (no names of students, teacher, class or school).
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUserRole(req, ["teacher"]);
  if (!auth.ok) return authErrorResponse(auth);
  const schoolId = auth.profile.school_id;
  if (!schoolId) {
    return NextResponse.json({ success: false, error: "حساب المعلم غير مرتبط بمدرسة" }, { status: 400 });
  }

  try {
    const diagnosis = await loadClassDiagnosis({ classId: params.id, schoolId, teacherId: auth.profile.id });
    if (!diagnosis.tests.length) {
      return NextResponse.json({
        success: false,
        error: "لا توجد نتائج محفوظة لهذا الفصل بعد. صحّح أوراق اختبار واحد على الأقل ثم أنشئ التقرير.",
      }, { status: 400 });
    }

    let narrative: ReportNarrative | null = null;
    let notice: string | null = null;
    if (geminiConfigured()) {
      try {
        narrative = parseNarrative(await generateJson(buildReportPrompt(diagnosis)), diagnosis);
        if (!narrative) notice = "لم تكتمل صياغة الذكاء الاصطناعي، فكُتب التقرير بالقواعد الثابتة.";
      } catch (err) {
        console.error("class report AI failed", err);
        notice = "الذكاء الاصطناعي غير متاح الآن، فكُتب التقرير بالقواعد الثابتة.";
      }
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          diagnosis,
          narrative: narrative ?? rulesNarrative(diagnosis),
          notice,
          generatedAt: new Date().toISOString(),
        },
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    if (err instanceof ReportAccessError) {
      return NextResponse.json({ success: false, error: err.message }, { status: 404 });
    }
    console.error("class report failed", err);
    return NextResponse.json({ success: false, error: "تعذر إنشاء تقرير الفصل حاليًا" }, { status: 500 });
  }
}
