import { NextRequest, NextResponse } from "next/server";
import { requireUserRole, authErrorResponse } from "@/lib/auth";
import { generateJson, geminiConfigured, geminiModelName } from "@/lib/gemini";
import { claudeConfigured, claudeFailureNotice, generateClaudeJson } from "@/lib/claude";
import { loadClassDiagnosis, ReportAccessError } from "@/lib/reports/load-class-report";
import {
  buildClassReportUserMessage,
  buildReportPrompt,
  CLASS_REPORT_JSON_SCHEMA,
  CLASS_REPORT_SYSTEM,
  parseNarrative,
  rulesNarrative,
  type ReportNarrative,
} from "@/lib/reports/class-report-ai";

export const dynamic = "force-dynamic";
// Claude thinks before answering (effort "high" by default), which can take a minute or two.
// 300 s is the maximum on every Vercel plan; Claude stops at 200 s so Gemini and the rules
// still have time to answer if it fails.
export const maxDuration = 300;
const CLAUDE_TIMEOUT_MS = 200000;

/**
 * The class report: numbers from the class's saved results, explained by the AI.
 * The AI sees aggregated, anonymous data only (no names of students, teacher, class or school).
 * Order: Claude (deep analysis) → Gemini → fixed rules. The report always comes back.
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
    let ai: { provider: "claude" | "gemini"; model: string; effort?: string } | null = null;

    if (claudeConfigured()) {
      try {
        const reply = await generateClaudeJson({
          task: "class_report",
          system: CLASS_REPORT_SYSTEM,
          prompt: buildClassReportUserMessage(diagnosis),
          schema: CLASS_REPORT_JSON_SCHEMA,
          timeoutMs: CLAUDE_TIMEOUT_MS,
          context: { schoolId, userId: auth.profile.id },
        });
        narrative = parseNarrative(reply.data, diagnosis);
        if (narrative) ai = { provider: "claude", model: reply.model, effort: reply.effort };
        else console.warn("class report: Claude reply did not match the diagnosis");
      } catch (err) {
        console.error("class report Claude failed", err);
        notice = `${claudeFailureNotice(err)}، فكُتب التقرير بطريقة احتياطية.`;
      }
    }

    if (!narrative && geminiConfigured()) {
      try {
        narrative = parseNarrative(await generateJson(buildReportPrompt(diagnosis)), diagnosis);
        if (narrative) ai = { provider: "gemini", model: geminiModelName() };
        else notice = "لم تكتمل صياغة الذكاء الاصطناعي، فكُتب التقرير بالقواعد الثابتة.";
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
          // The Claude notice is only worth showing when nothing else used the AI either.
          notice: narrative ? null : notice,
          ai,
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
