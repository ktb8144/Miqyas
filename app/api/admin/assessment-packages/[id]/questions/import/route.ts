import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminClient, requireAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

const questionSchema = z.object({
  question_number: z.coerce.number().int().positive(),
  correct_option: z.enum(["أ", "ب", "ج", "د", "blank", "unclear"]),
  nafs_domain_id: z.string().uuid(),
  skill_id: z.string().uuid(),
  difficulty_level: z.enum(["easy", "medium", "hard", "nafs_simulation"]).default("medium"),
  points: z.coerce.number().positive().default(1),
  question_text: z.string().trim().optional().nullable(),
});

const importSchema = z.array(questionSchema).min(1);

export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  try {
    const parsed = importSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "صيغة JSON غير صحيحة أو لا تحتوي على أسئلة" }, { status: 400 });
    }

    const questions = parsed.data;
    const numbers = questions.map((item) => item.question_number);
    if (new Set(numbers).size !== numbers.length) {
      return NextResponse.json({ success: false, error: "أرقام الأسئلة يجب ألا تتكرر داخل الحزمة" }, { status: 400 });
    }

    const db = getAdminClient();
    const { data: assessmentPackage, error: packageError } = await db
      .from("assessment_packages")
      .select("id")
      .eq("id", params.id)
      .maybeSingle();

    if (packageError) throw packageError;
    if (!assessmentPackage) {
      return NextResponse.json({ success: false, error: "لم يتم العثور على حزمة الاختبار" }, { status: 404 });
    }

    const domainIds = Array.from(new Set(questions.map((item) => item.nafs_domain_id)));
    const skillIds = Array.from(new Set(questions.map((item) => item.skill_id)));
    const [domainsResult, skillsResult] = await Promise.all([
      db.from("nafs_domains").select("id").in("id", domainIds),
      db.from("learning_skills").select("id, nafs_domain_id").in("id", skillIds),
    ]);

    if (domainsResult.error) throw domainsResult.error;
    if (skillsResult.error) throw skillsResult.error;

    const foundDomains = new Set((domainsResult.data ?? []).map((item) => item.id as string));
    const skillsById = new Map((skillsResult.data ?? []).map((item) => [item.id as string, item.nafs_domain_id as string | null]));

    const missingDomain = questions.find((item) => !foundDomains.has(item.nafs_domain_id));
    if (missingDomain) {
      return NextResponse.json({ success: false, error: `مجال نافس غير موجود للسؤال ${missingDomain.question_number}` }, { status: 400 });
    }

    const invalidSkill = questions.find((item) => !skillsById.has(item.skill_id));
    if (invalidSkill) {
      return NextResponse.json({ success: false, error: `المهارة غير موجودة للسؤال ${invalidSkill.question_number}` }, { status: 400 });
    }

    const mismatchedSkill = questions.find((item) => {
      const skillDomainId = skillsById.get(item.skill_id);
      return skillDomainId && skillDomainId !== item.nafs_domain_id;
    });
    if (mismatchedSkill) {
      return NextResponse.json(
        { success: false, error: `المهارة لا تتبع مجال نافس المحدد في السؤال ${mismatchedSkill.question_number}` },
        { status: 400 }
      );
    }

    const { error: deleteError } = await db
      .from("package_questions")
      .delete()
      .eq("package_id", params.id);
    if (deleteError) throw deleteError;

    const { data, error: insertError } = await db
      .from("package_questions")
      .insert(
        questions.map((item) => ({
          package_id: params.id,
          question_number: item.question_number,
          correct_option: item.correct_option,
          nafs_domain_id: item.nafs_domain_id,
          skill_id: item.skill_id,
          difficulty_level: item.difficulty_level,
          points: item.points,
          question_text: item.question_text?.trim() || null,
        }))
      )
      .select("id, question_number");

    if (insertError) throw insertError;

    return NextResponse.json({
      success: true,
      importedCount: data?.length ?? 0,
    });
  } catch (err) {
    console.error("admin package questions import failed", err);
    return NextResponse.json(
      { success: false, error: "تعذر استيراد مفتاح الإجابة وخريطة المهارات" },
      { status: 500 }
    );
  }
}
