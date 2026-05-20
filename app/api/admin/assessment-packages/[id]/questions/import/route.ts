import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, requireAdmin } from "@/lib/supabase-admin";
import { AssessmentValidationError, parsePackageAnswerKey, syncPackageQuestionsFromAnswerKey } from "@/lib/assessment";

export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  try {
    const body = await req.json();
    const parsed = parsePackageAnswerKey(body);
    const db = getAdminClient();
    const { data: assessmentPackage, error: packageError } = await db
      .from("assessment_packages")
      .select("id, subject, grade")
      .eq("id", params.id)
      .maybeSingle();

    if (packageError) throw packageError;
    if (!assessmentPackage) {
      return NextResponse.json({ success: false, error: "لم يتم العثور على حزمة الاختبار" }, { status: 404 });
    }

    const synced = await syncPackageQuestionsFromAnswerKey({
      db,
      assessmentPackage,
      answerKeyInput: body,
    });

    return NextResponse.json({
      success: true,
      importedCount: synced.syncedQuestionCount || parsed.questions.length,
    });
  } catch (err) {
    console.error("admin package questions import failed", err);
    if (err instanceof AssessmentValidationError) {
      return NextResponse.json({ success: false, error: err.message }, { status: 400 });
    }
    return NextResponse.json(
      { success: false, error: "تعذر استيراد مفتاح الإجابة وخريطة المهارات" },
      { status: 500 }
    );
  }
}
