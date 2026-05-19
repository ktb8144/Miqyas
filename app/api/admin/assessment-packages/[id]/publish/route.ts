import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminClient, requireAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

const publishSchema = z.object({
  school_ids: z.array(z.string().uuid()).min(1, "اختر مدرسة واحدة على الأقل"),
});

export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  try {
    const parsed = publishSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "اختر مدرسة واحدة على الأقل للنشر" }, { status: 400 });
    }

    const db = getAdminClient();
    const { data: assessmentPackage, error: packageError } = await db
      .from("assessment_packages")
      .select("id, subject, grade, week_number, start_date, student_pdf_url, questions_pdf_url, published_at")
      .eq("id", params.id)
      .maybeSingle();

    if (packageError) throw packageError;
    if (!assessmentPackage) {
      return NextResponse.json({ success: false, error: "لم يتم العثور على حزمة الاختبار" }, { status: 404 });
    }

    if (!assessmentPackage.questions_pdf_url && !assessmentPackage.student_pdf_url) {
      return NextResponse.json(
        { success: false, error: "يجب إضافة ملف الأسئلة PDF قبل النشر" },
        { status: 400 }
      );
    }

    const { data: questions, error: questionsError } = await db
      .from("package_questions")
      .select("id, correct_option, nafs_domain_id, skill_id")
      .eq("package_id", params.id);

    if (questionsError) throw questionsError;
    const packageQuestions = questions ?? [];
    const assessmentDate = assessmentPackage.start_date ?? new Date().toISOString().slice(0, 10);
    const { data: weeklyQuestions, error: weeklyQuestionsError } = await db
      .from("weekly_questions")
      .select("id, sort_order, question_options(option_label, is_correct)")
      .eq("subject", assessmentPackage.subject)
      .eq("grade", assessmentPackage.grade)
      .eq("week_number", Number(assessmentPackage.week_number ?? 0))
      .eq("assessment_date", assessmentDate);
    if (weeklyQuestionsError) throw weeklyQuestionsError;

    const weeklyQuestionCount = new Set((weeklyQuestions ?? []).map((item) => Number(item.sort_order)).filter(Number.isFinite)).size;
    const weeklyHasCorrectOptions = (weeklyQuestions ?? []).some((item) => {
      const options = item.question_options as Array<{ option_label?: string; is_correct?: boolean }> | null;
      return options?.some((option) => option.is_correct && option.option_label);
    });

    if (packageQuestions.length <= 0 && weeklyQuestionCount <= 0) {
      return NextResponse.json({ success: false, error: "يجب استيراد مفتاح الإجابة قبل النشر" }, { status: 400 });
    }

    if (packageQuestions.length > 0 && packageQuestions.some((item) => !item.correct_option || !item.nafs_domain_id || !item.skill_id) && weeklyQuestionCount <= 0) {
      return NextResponse.json(
        { success: false, error: "كل سؤال يجب أن يحتوي إجابة صحيحة ومجال نافس ومهارة قبل النشر" },
        { status: 400 }
      );
    }

    if (weeklyQuestionCount > 0 && !weeklyHasCorrectOptions) {
      return NextResponse.json(
        { success: false, error: "مفتاح الإجابة لا يحتوي على خيار صحيح واحد على الأقل" },
        { status: 400 }
      );
    }

    const schoolIds = Array.from(new Set(parsed.data.school_ids));
    const { data: schools, error: schoolsError } = await db
      .from("schools")
      .select("id")
      .in("id", schoolIds)
      .eq("active", true);

    if (schoolsError) throw schoolsError;
    if ((schools ?? []).length !== schoolIds.length) {
      return NextResponse.json({ success: false, error: "بعض المدارس غير موجودة أو غير نشطة" }, { status: 400 });
    }

    const now = new Date().toISOString();
    const { data: updatedPackage, error: updateError } = await db
      .from("assessment_packages")
      .update({
        status: "published",
        published_at: assessmentPackage.published_at ?? now,
      })
      .eq("id", params.id)
      .select("*")
      .single();

    if (updateError) throw updateError;

    const { error: assignmentError } = await db
      .from("school_package_assignments")
      .upsert(
        schoolIds.map((schoolId) => ({
          package_id: params.id,
          school_id: schoolId,
          status: "available",
          assigned_at: now,
        })),
        { onConflict: "package_id,school_id" }
      );

    if (assignmentError) throw assignmentError;

    return NextResponse.json({
      success: true,
      data: updatedPackage,
      assignedSchoolCount: schoolIds.length,
    });
  } catch (err) {
    console.error("admin package publish failed", err);
    return NextResponse.json(
      { success: false, error: "تعذر نشر حزمة الاختبار" },
      { status: 500 }
    );
  }
}
