import { z } from "zod";
import { getLevelFromPercentage, MASTERY_THRESHOLD } from "@/lib/levels";
import type { ClassDiagnosis, FocusSkill } from "./class-diagnosis";

/**
 * The written part of the class report. The AI explains the diagnosis — above all, it infers
 * the likely misconception behind the wrong answers students chose — but every number shown
 * to the teacher comes from the diagnosis itself. When the AI is unavailable, the same
 * sections are written from fixed rules, so the report always works.
 */

export type Confidence = "عالية" | "متوسطة" | "منخفضة";

export type ReportNarrative = {
  source: "ai" | "rules";
  summary: string;
  strengths: string[];
  priorities: Array<{ skill: string; why: string; likelyCause: string; confidence: Confidence }>;
  actions: Array<{ title: string; detail: string; target: string; duration: string }>;
  nextCheck: string;
};

const CONFIDENCE: Confidence[] = ["عالية", "متوسطة", "منخفضة"];

/** Everything the AI sees. Built from a whitelist: no student, teacher, class or school names. */
export function reportPayload(d: ClassDiagnosis) {
  return {
    الصف: d.grade,
    المادة: d.subject,
    عدد_الطلاب: d.studentCount,
    عدد_من_اختبروا: d.testedCount,
    الاختبارات: d.tests.map((t) => ({ العنوان: t.title, الأسبوع: t.week, المتوسط: t.average, عدد_المختبرين: t.tested, المستويات: t.levels })),
    الاتجاه: d.trend ? { أول_اختبار: d.trend.first, آخر_اختبار: d.trend.latest, التغير: d.trend.change } : null,
    المهارات: d.skills.slice(0, 20).map((s) => ({
      المهارة: s.skill,
      المجال: s.domain,
      الإتقان: s.mastery,
      عدد_الأسئلة: s.questionCount,
      لم_يتقنها: `${s.studentsMissed} من ${s.studentsMeasured}`,
      سابقًا: s.earlierMastery,
      آخر_قياس: s.latestMastery,
      الخيار_الخاطئ_الأكثر: s.topWrong ? { السؤال: s.topWrong.question, الخيار: s.topWrong.option, قيمته: s.topWrong.value, نسبته_من_أخطاء_السؤال: s.topWrong.share } : null,
      خطأ_مسجل: s.misconception?.text ?? null,
    })),
    مهارات_التركيز: d.focus.map((s) => ({
      المهارة: s.skill,
      المجال: s.domain,
      الإتقان: s.mastery,
      الأسئلة: s.questions.map((q) => ({
        رقم: q.number,
        النص: q.text,
        الخيارات: q.options,
        الصحيح: q.correct,
        نسبة_الصواب: q.mastery,
        اختيارات_الطلاب: q.choices,
        تظليل_جزئي_احتُسب: q.partialMarks,
        خطأ_مسجل_للخيار_الأكثر: q.recordedMisconception,
        ملاحظة_المعالجة: q.remediation,
      })),
    })),
    أسئلة_يُشك_في_مفتاحها: d.keyChecks.map((k) => ({
      الاختبار: k.test,
      السؤال: k.question,
      المهارة: k.skill,
      المفتاح: `${k.keyOption}${k.keyValue ? ` = ${k.keyValue}` : ""}`,
      الخيار_الأكثر: `${k.popularOption}${k.popularValue ? ` = ${k.popularValue}` : ""}`,
      نسبة_من_اختاره: k.popularShare,
      نسبة_الصواب: k.mastery,
    })),
    ملاحظات_التظليل: d.marks.recorded
      ? { عدد_الإجابات_المسجلة: d.marks.recorded, فارغة: d.marks.blank, أكثر_من_دائرة_حُسبت_خطأ: d.marks.multiple, تظليل_جزئي_احتُسب: d.marks.partial, عدّلها_المعلم: d.marks.manual }
      : null,
    ملاحظات_على_البيانات: d.gaps,
  };
}

export function buildReportPrompt(d: ClassDiagnosis) {
  return `أنت مختص في التقويم التربوي للمرحلة الابتدائية في السعودية، وتعرف اختبارات نافس ومجالاتها.
أمامك نتائج فصل في اختبارات دالة الأسبوعية، محسوبة مسبقًا (لا تعد حسابها):

${JSON.stringify(reportPayload(d))}

المطلوب: تقرير قصير وعملي للمعلم بالعربية الفصحى البسيطة، بصيغة JSON فقط بهذا الشكل:
{
  "summary": "فقرة من 2-4 جمل: أين يقف الفصل، وهل يتحسن، وأين المشكلة الأهم",
  "strengths": ["حتى 3 نقاط قوة، كل منها مهارة أتقنها الفصل مع سبب قصير"],
  "priorities": [
    {
      "skill": "اسم المهارة كما ورد في مهارات_التركيز حرفيًا",
      "why": "لماذا هي أولوية، بالأرقام الواردة في البيانات",
      "likelyCause": "الخطأ المفاهيمي المرجّح وراء الإجابات الخاطئة",
      "confidence": "عالية أو متوسطة أو منخفضة"
    }
  ],
  "actions": [
    { "title": "عنوان قصير", "detail": "ماذا يفعل المعلم في الحصة القادمة خطوة بخطوة", "target": "الفصل كاملًا أو مجموعة صغيرة", "duration": "مثل: 10 دقائق" }
  ],
  "nextCheck": "كيف يتحقق المعلم أن المعالجة نجحت (سؤال خروج أو إعادة قياس)"
}

قواعد مهمة:
- أولويات من مهارات_التركيز فقط (حتى 3)، وإجراءات حتى 4، كل إجراء مرتبط بأولوية.
- لاستنتاج likelyCause: انظر إلى قيمة الخيار الخاطئ الأكثر اختيارًا مقارنة بالصحيح، واستنتج ما الذي فعله الطالب ليصل إليه (مثال: إذا كان الصحيح 64 لسؤال 4 أُس 3 واختار كثيرون 12، فالطالب ضرب الأساس في الأس). استفد من خطأ_مسجل وملاحظة_المعالجة إن وُجدا.
- متوسطات الاختبارات المختلفة لا تقارن مباشرة لأنها تقيس مهارات مختلفة؛ عند الحديث عن التحسن أو التراجع اعتمد على إتقان المهارة نفسها (سابقًا ← آخر_قياس).
- confidence: «عالية» فقط إذا تكرر خيار خاطئ واحد بوضوح في أكثر من سؤال أو وُجد خطأ مسجل يطابقه؛ «منخفضة» إذا قيست المهارة بسؤال واحد أو كانت الأخطاء موزعة.
- إذا ورد سؤال في أسئلة_يُشك_في_مفتاحها فقد يكون مفتاح الإجابة نفسه خطأ: اذكر ذلك صراحة في likelyCause للمهارة المرتبطة، واجعل الثقة «منخفضة»، واجعل أول إجراء مراجعة المفتاح مع نص السؤال قبل أي معالجة.
- في اختيارات_الطلاب: blank = لم يظلل شيئًا، multiple = ظلل أكثر من دائرة فحُسبت خطأ. هذان ليسا تصورًا خاطئًا عن المحتوى؛ لا تبنِ عليهما likelyCause إلا إذا كثرا (ضيق وقت أو تعليمات تظليل).
- لا تخترع أرقامًا أو مهارات أو أسئلة غير موجودة في البيانات. إذا لم يكفِ شيء للحكم فقل ذلك.
- لا تذكر أسماء طلاب، ولا تستخدم كلمات: ضعيف، فاشل، موهوب، غبي.
- اجعل الإجراءات واقعية لحصة مدتها 45 دقيقة وفصل من 25-35 طالبًا.`;
}

// ─── Claude (deep analysis) ───────────────────────────────────────────────────

/**
 * Same report and rules as the Gemini prompt, split for Claude: fixed instructions (cached across
 * classes) in the system prompt, the class's numbers in the user message. Claude also gets an
 * explicit method, because it thinks before answering and uses that time best with a procedure.
 */
export const CLASS_REPORT_SYSTEM = `أنت مختص في التقويم التربوي للمرحلة الابتدائية في السعودية، وتعرف اختبارات نافس ومجالاتها وأخطاء الطلاب الشائعة في الرياضيات والقراءة والعلوم.
ستصلك نتائج فصل في اختبارات دالة الأسبوعية، محسوبة مسبقًا بالكود. كل الأرقام صحيحة: لا تعد حسابها ولا تقدّرها، واستخدمها كما هي.

مهمتك: تقرير قصير وعملي للمعلم بالعربية الفصحى البسيطة، في الحقول المطلوبة:
- summary: فقرة من 2-4 جمل: أين يقف الفصل، وهل يتحسن، وأين المشكلة الأهم.
- strengths: حتى 3 نقاط قوة، كل منها مهارة أتقنها الفصل مع سبب قصير.
- priorities: حتى 3 أولويات من مهارات_التركيز فقط، واسم المهارة منسوخ حرفيًا كما ورد. لكل أولوية: why (لماذا هي أولوية، بالأرقام الواردة)، وlikelyCause (الخطأ المفاهيمي المرجّح)، وconfidence (عالية أو متوسطة أو منخفضة).
- actions: حتى 4 إجراءات، كل منها مرتبط بأولوية: title قصير، وdetail خطوات الحصة القادمة، وtarget (الفصل كاملًا أو مجموعة صغيرة)، وduration (مثل: 10 دقائق).
- nextCheck: كيف يتحقق المعلم أن المعالجة نجحت (سؤال خروج أو إعادة قياس).

طريقة التحليل قبل الكتابة:
1. لكل سؤال في مهارات_التركيز: حل السؤال بنفسك، ثم لكل خيار خاطئ اختاره عدد ملحوظ من الطلاب استنتج الخطوة الخاطئة المحددة التي توصل إلى قيمته بالضبط (مثال: إذا كان الصحيح 64 لسؤال 4 أُس 3 واختار كثيرون 12، فالطالب ضرب الأساس في الأس). إن لم توجد خطوة معقولة توصل إليه فقل إن السبب غير واضح.
2. ابحث عن خطأ مفاهيمي واحد يفسّر أخطاء أكثر من سؤال أو أكثر من مهارة؛ هذا أهم ما يحتاجه المعلم.
3. فرّق بين هذه الأسباب: تصور خاطئ مشترك (خيار خاطئ واحد يتكرر بوضوح)، أو فجوة في المتطلب السابق، أو تخمين وعدم فهم (أخطاء موزعة أو إجابات فارغة كثيرة)، أو مشكلة في السؤال نفسه أو صياغته.
4. استفد من خطأ_مسجل وملاحظة_المعالجة إن وُجدا، لكن قدّم ما تدل عليه اختيارات الطلاب الفعلية إن خالفتهما.
5. صمّم الإجراء ليعالج السبب الذي استنتجته تحديدًا، لا مراجعة عامة للمهارة.

قواعد مهمة:
- متوسطات الاختبارات المختلفة لا تقارن مباشرة لأنها تقيس مهارات مختلفة؛ عند الحديث عن التحسن أو التراجع اعتمد على إتقان المهارة نفسها (سابقًا ← آخر_قياس).
- confidence: «عالية» فقط إذا تكرر خيار خاطئ واحد بوضوح في أكثر من سؤال أو وُجد خطأ مسجل يطابقه؛ «منخفضة» إذا قيست المهارة بسؤال واحد أو كانت الأخطاء موزعة.
- إذا ورد سؤال في أسئلة_يُشك_في_مفتاحها فقد يكون مفتاح الإجابة نفسه خطأ: اذكر ذلك صراحة في likelyCause للمهارة المرتبطة، واجعل الثقة «منخفضة»، واجعل أول إجراء مراجعة المفتاح مع نص السؤال قبل أي معالجة.
- في اختيارات_الطلاب: blank = لم يظلل شيئًا، وmultiple = ظلل أكثر من دائرة فحُسبت خطأ. هذان ليسا تصورًا خاطئًا عن المحتوى، فلا تستنتج منهما خطأً مفاهيميًا. لكن إن كثرا في أسئلة بعينها فقد يدلان على ضيق الوقت أو صعوبة السؤال أو الحاجة لتدريب على التظليل (انظر ملاحظات_التظليل). وتظليل_جزئي_احتُسب يعني أن الطالب ظلل الدائرة جزئيًا فاحتُسبت إجابته؛ كثرته في سؤال قد تدل على تردد.
- لا تخترع أرقامًا أو مهارات أو أسئلة غير موجودة في البيانات. إذا لم يكفِ شيء للحكم فقل ذلك.
- في الرياضيات اكتب الكسور العشرية بالفاصلة العربية (٫) لا بالنقطة.
- لا تذكر أسماء طلاب، ولا تستخدم كلمات: ضعيف، فاشل، موهوب، غبي.
- اجعل الإجراءات واقعية لحصة مدتها 45 دقيقة وفصل من 25-35 طالبًا.`;

export function buildClassReportUserMessage(d: ClassDiagnosis) {
  return `نتائج الفصل (محسوبة مسبقًا):\n${JSON.stringify(reportPayload(d))}`;
}

/** JSON schema for Claude's structured output. parseNarrative still checks every item against the data. */
export const CLASS_REPORT_JSON_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    strengths: { type: "array", items: { type: "string" } },
    priorities: {
      type: "array",
      items: {
        type: "object",
        properties: {
          skill: { type: "string" },
          why: { type: "string" },
          likelyCause: { type: "string" },
          confidence: { type: "string", enum: CONFIDENCE },
        },
        required: ["skill", "why", "likelyCause", "confidence"],
        additionalProperties: false,
      },
    },
    actions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          detail: { type: "string" },
          target: { type: "string" },
          duration: { type: "string" },
        },
        required: ["title", "detail", "target", "duration"],
        additionalProperties: false,
      },
    },
    nextCheck: { type: "string" },
  },
  required: ["summary", "strengths", "priorities", "actions", "nextCheck"],
  additionalProperties: false,
} as const;

// Items are checked one by one, so a single malformed item doesn't throw away the whole reply.
const narrativeSchema = z.object({
  summary: z.string().trim().min(10).max(1200),
  strengths: z.array(z.unknown()).default([]),
  priorities: z.array(z.unknown()).default([]),
  actions: z.array(z.unknown()).default([]),
  nextCheck: z.unknown().optional(),
});
const strengthSchema = z.string().trim().min(2).max(400);
const prioritySchema = z.object({
  skill: z.string().trim().min(1).max(200),
  why: z.string().trim().min(2).max(600),
  likelyCause: z.string().trim().min(2).max(600),
  confidence: z.string().trim().default("متوسطة"),
});
const actionSchema = z.object({
  title: z.string().trim().min(2).max(120),
  detail: z.string().trim().min(2).max(700),
  target: z.string().trim().max(80).default(""),
  duration: z.string().trim().max(40).default(""),
});
const nextCheckSchema = z.string().trim().min(2).max(500);

function validItems<T>(items: unknown[], schema: z.ZodType<T, z.ZodTypeDef, unknown>): T[] {
  return items.flatMap((item) => {
    const parsed = schema.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
}

const normalize = (value: string) => value.replace(/[ً-ْـ]/g, "").replace(/[أإآ]/g, "ا").replace(/\s+/g, " ").trim();

/** Validates the model's reply against the diagnosis; returns null when it can't be used. */
export function parseNarrative(raw: unknown, d: ClassDiagnosis): ReportNarrative | null {
  const parsed = narrativeSchema.safeParse(raw);
  if (!parsed.success) return null;
  const focusByName = new Map(d.focus.map((s) => [normalize(s.skill), s.skill]));
  // Only keep priorities about skills that are actually in the data.
  const priorities = validItems(parsed.data.priorities, prioritySchema)
    .map((p) => ({ ...p, skill: focusByName.get(normalize(p.skill)) ?? "" }))
    .filter((p) => p.skill)
    .filter((p, index, all) => all.findIndex((other) => other.skill === p.skill) === index)
    .slice(0, 3)
    .map((p) => ({ ...p, confidence: (CONFIDENCE.includes(p.confidence as Confidence) ? p.confidence : "متوسطة") as Confidence }));
  if (d.focus.length && !priorities.length) return null;
  const nextCheck = nextCheckSchema.safeParse(parsed.data.nextCheck);
  return {
    source: "ai",
    summary: parsed.data.summary,
    strengths: validItems(parsed.data.strengths, strengthSchema).slice(0, 3),
    priorities,
    actions: validItems(parsed.data.actions, actionSchema).slice(0, 4).map((a) => ({ ...a, target: a.target || "الفصل كاملًا", duration: a.duration || "10 دقائق" })),
    nextCheck: nextCheck.success ? nextCheck.data : rulesNextCheck(d),
  };
}

// ─── Rule-based text (no AI) ─────────────────────────────────────────────────

function keyCheckFor(d: ClassDiagnosis, skill: string) {
  return d.keyChecks.find((k) => k.skill === skill) ?? null;
}

function rulesCause(s: FocusSkill, d: ClassDiagnosis): { text: string; confidence: Confidence } {
  const key = keyCheckFor(d, s.skill);
  if (key) {
    return {
      text: `قد يكون مفتاح الإجابة للسؤال ${key.question} خطأ: المفتاح ${key.keyOption}${key.keyValue ? ` (${key.keyValue})` : ""}، ونسبة الصواب ${key.mastery}%، بينما اختار ${key.popularShare}% من الطلاب ${key.popularOption}${key.popularValue ? ` (${key.popularValue})` : ""}. راجع المفتاح قبل الحكم على المهارة.`,
      confidence: "منخفضة",
    };
  }
  if (s.misconception && s.misconception.count >= 2) return { text: `الخطأ المسجّل الأكثر تكرارًا: ${s.misconception.text}.`, confidence: s.questionCount >= 2 ? "عالية" : "متوسطة" };
  if (s.topWrong && s.topWrong.share >= 40) {
    const value = s.topWrong.value ? ` (${s.topWrong.value})` : "";
    const option = s.topWrong.option === "blank" ? "ترك السؤال دون إجابة" : s.topWrong.option === "multiple" ? "تظليل أكثر من دائرة" : `اختيار ${s.topWrong.option}${value}`;
    return { text: `في السؤال ${s.topWrong.question} تكرر ${option} في ${s.topWrong.share}% من الإجابات الخاطئة، وهذا يدل على تصور خاطئ مشترك يحتاج مراجعة.`, confidence: s.questionCount >= 2 ? "متوسطة" : "منخفضة" };
  }
  return { text: "الأخطاء موزعة على أكثر من خيار، فالسبب غير مؤكد ويحتاج سؤالًا تشخيصيًا قصيرًا.", confidence: "منخفضة" };
}

function rulesNextCheck(d: ClassDiagnosis) {
  if (!d.focus.length) return "استمر في الاختبار الأسبوعي، وراقب أي مهارة تنزل عن 70%.";
  return `أعد قياس ${d.focus.map((s) => s.skill).join("، ")} بسؤالين قصيرين في اختبار الأسبوع القادم، وقارن النسبة بهذا التقرير.`;
}

export function rulesNarrative(d: ClassDiagnosis): ReportNarrative {
  const latest = d.tests[d.tests.length - 1];
  const parts: string[] = [];
  if (latest) {
    parts.push(`اختُبر ${d.testedCount} من ${d.studentCount} طالبًا في ${d.tests.length === 1 ? "اختبار واحد" : `${d.tests.length} اختبارات`}، ومتوسط آخر اختبار ${latest.average}% (${getLevelFromPercentage(latest.average)}).`);
  }
  // Different tests measure different skills, so the fair comparison is a skill against itself.
  const remeasured = d.skills.filter((s) => s.earlierMastery !== null && s.latestMastery !== null);
  const improved = remeasured.filter((s) => s.latestMastery! - s.earlierMastery! >= 5);
  const declined = remeasured.filter((s) => s.earlierMastery! - s.latestMastery! >= 5);
  const fmt = (s: (typeof remeasured)[number]) => `${s.skill} (${s.earlierMastery}% ← ${s.latestMastery}%)`;
  if (improved.length) parts.push(`تحسن إتقان: ${improved.map(fmt).join("، ")}.`);
  if (declined.length) parts.push(`تراجع إتقان: ${declined.map(fmt).join("، ")}.`);
  if (remeasured.length && !improved.length && !declined.length) parts.push("لم يتغير إتقان المهارات التي أعيد قياسها تغيرًا يُذكر.");
  if (d.trend && !remeasured.length) {
    parts.push(`متوسط آخر اختبار ${d.trend.change >= 0 ? "أعلى" : "أقل"} من أول اختبار بـ${Math.abs(d.trend.change)} نقطة، مع أن الاختبارين يقيسان مهارات مختلفة.`);
  }
  if (d.focus.length) parts.push(`المهارات الأحوج للتدخل: ${d.focus.map((s) => `${s.skill} (${s.mastery}%)`).join("، ")}.`);
  else if (d.skills.length) parts.push("كل المهارات المقيسة عند مستوى الإتقان أو أعلى.");

  const strengths = d.skills
    .filter((s) => s.mastery >= MASTERY_THRESHOLD && s.skill !== "مهارة غير محددة")
    .sort((a, b) => b.mastery - a.mastery)
    .slice(0, 3)
    .map((s) => `${s.skill}: إتقان ${s.mastery}%.`);

  const priorities = d.focus.map((s) => {
    const cause = rulesCause(s, d);
    return {
      skill: s.skill,
      why: `نسبة الإتقان ${s.mastery}%، ولم يتقنها ${s.studentsMissed} من ${s.studentsMeasured} طالبًا.`,
      likelyCause: cause.text,
      confidence: cause.confidence,
    };
  });

  const actions = d.focus.map((s) => {
    const classWide = s.studentsMeasured > 0 && s.studentsMissed / s.studentsMeasured >= 0.5;
    const remediation = s.questions.find((q) => q.remediation)?.remediation;
    const key = keyCheckFor(d, s.skill);
    if (key) {
      return {
        title: `راجع مفتاح السؤال ${key.question} أولًا`,
        detail: `قارن نص السؤال ${key.question} في «${key.test}» بالمفتاح (${key.keyOption}). إن كان المفتاح خطأ فاطلب تصحيحه من فريق دالة ثم أعد التصحيح؛ وإن كان صحيحًا فعالج مهارة «${s.skill}» مع الفصل كاملًا.`,
        target: "المعلم",
        duration: "5 دقائق",
      };
    }
    return {
      title: `معالجة: ${s.skill}`,
      detail: remediation
        ? `${remediation} ثم سؤال تحقق فردي في نهاية النشاط.`
        : classWide
          ? "ابدأ بمثال محلول على السبورة، ثم تدريب موجّه في أزواج، ثم سؤال فردي سريع."
          : "اجمع الطلاب المستهدفين في نشاط قصير يراجع الخطأ الشائع، ثم سؤال تحقق.",
      target: classWide ? "الفصل كاملًا" : "مجموعة صغيرة",
      duration: classWide ? "15 دقيقة" : "10 دقائق",
    };
  });

  return {
    source: "rules",
    summary: parts.join(" ") || "لا توجد نتائج كافية لكتابة ملخص.",
    strengths,
    priorities,
    actions,
    nextCheck: rulesNextCheck(d),
  };
}
