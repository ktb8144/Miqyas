import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminClient, requireAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

const questionSchema = z.object({
  question_number: z.coerce.number().int().positive(),
  correct_option: z.enum(["أ", "ب", "ج", "د", "blank", "unclear"]),
  nafs_domain_id: z.string().uuid().optional(),
  skill_id: z.string().uuid().optional(),
  nafs_domain_code: z.string().trim().optional(),
  skill_code: z.string().trim().optional(),
  difficulty_level: z.enum(["easy", "medium", "hard", "nafs_simulation"]).default("medium"),
  points: z.coerce.number().positive().default(1),
  question_text: z.string().trim().optional().nullable(),
  remediation_note: z.string().trim().optional().nullable(),
}).refine((item) => {
  return Boolean(item.nafs_domain_id && item.skill_id) || Boolean(item.nafs_domain_code && item.skill_code);
}, {
  message: "يجب توفير UUID للمجال والمهارة أو كود المجال وكود المهارة",
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
      .select("id, subject, grade")
      .eq("id", params.id)
      .maybeSingle();

    if (packageError) throw packageError;
    if (!assessmentPackage) {
      return NextResponse.json({ success: false, error: "لم يتم العثور على حزمة الاختبار" }, { status: 404 });
    }

    const packageSubject = String(assessmentPackage.subject);
    const packageGrade = Number(assessmentPackage.grade);
    const domainIds = Array.from(new Set(questions.map((item) => item.nafs_domain_id).filter(Boolean))) as string[];
    const skillIds = Array.from(new Set(questions.map((item) => item.skill_id).filter(Boolean))) as string[];
    const domainCodes = Array.from(new Set(questions.map((item) => item.nafs_domain_code?.trim()).filter(Boolean))) as string[];
    const skillCodes = Array.from(new Set(questions.map((item) => item.skill_code?.trim()).filter(Boolean))) as string[];
    const [domainsByIdResult, domainsByCodeResult, skillsByIdResult, skillsByCodeResult] = await Promise.all([
      domainIds.length
        ? db.from("nafs_domains").select("id, domain_code").eq("subject", packageSubject).eq("grade", packageGrade).in("id", domainIds)
        : Promise.resolve({ data: [], error: null }),
      domainCodes.length
        ? db.from("nafs_domains").select("id, domain_code").eq("subject", packageSubject).eq("grade", packageGrade).in("domain_code", domainCodes)
        : Promise.resolve({ data: [], error: null }),
      skillIds.length
        ? db.from("learning_skills").select("id, skill_code, nafs_domain_id").eq("subject", packageSubject).eq("grade", packageGrade).in("id", skillIds)
        : Promise.resolve({ data: [], error: null }),
      skillCodes.length
        ? db.from("learning_skills").select("id, skill_code, nafs_domain_id").eq("subject", packageSubject).eq("grade", packageGrade).in("skill_code", skillCodes)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (domainsByIdResult.error) throw domainsByIdResult.error;
    if (domainsByCodeResult.error) throw domainsByCodeResult.error;
    if (skillsByIdResult.error) throw skillsByIdResult.error;
    if (skillsByCodeResult.error) throw skillsByCodeResult.error;

    const domainRows = [...(domainsByIdResult.data ?? []), ...(domainsByCodeResult.data ?? [])];
    const skillRows = [...(skillsByIdResult.data ?? []), ...(skillsByCodeResult.data ?? [])];
    const domainsById = new Map(domainRows.map((item) => [item.id as string, item.id as string]));
    const domainsByCode = new Map(domainRows.map((item) => [item.domain_code as string, item.id as string]));
    const skillsById = new Map(skillRows.map((item) => [item.id as string, { id: item.id as string, nafsDomainId: item.nafs_domain_id as string | null }]));
    const skillsByCode = new Map(skillRows.map((item) => [item.skill_code as string, { id: item.id as string, nafsDomainId: item.nafs_domain_id as string | null }]));

    const resolvedQuestions = questions.map((item) => {
      const domainId = item.nafs_domain_id
        ? domainsById.get(item.nafs_domain_id)
        : domainsByCode.get(item.nafs_domain_code?.trim() ?? "");
      const skill = item.skill_id
        ? skillsById.get(item.skill_id)
        : skillsByCode.get(item.skill_code?.trim() ?? "");

      return {
        ...item,
        resolvedDomainId: domainId,
        resolvedSkillId: skill?.id,
        resolvedSkillDomainId: skill?.nafsDomainId,
      };
    });

    const missingDomain = resolvedQuestions.find((item) => !item.resolvedDomainId);
    if (missingDomain) {
      return NextResponse.json({ success: false, error: `مجال نافس غير موجود للسؤال ${missingDomain.question_number}` }, { status: 400 });
    }

    const invalidSkill = resolvedQuestions.find((item) => !item.resolvedSkillId);
    if (invalidSkill) {
      return NextResponse.json({ success: false, error: `المهارة غير موجودة للسؤال ${invalidSkill.question_number}` }, { status: 400 });
    }

    const mismatchedSkill = resolvedQuestions.find((item) => item.resolvedSkillDomainId !== item.resolvedDomainId);
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
        resolvedQuestions.map((item) => ({
          package_id: params.id,
          question_number: item.question_number,
          correct_option: item.correct_option,
          nafs_domain_id: item.resolvedDomainId,
          skill_id: item.resolvedSkillId,
          difficulty_level: item.difficulty_level,
          points: item.points,
          question_text: item.question_text?.trim() || null,
          remediation_note: item.remediation_note?.trim() || null,
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
