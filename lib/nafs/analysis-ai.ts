import { createHash } from "crypto";
import { z } from "zod";
import { NAFS_SUBJECTS, type NafsBaseline } from "./baseline";
import type { NafsPlan } from "./plan";

/**
 * The deep NAFS analysis: Claude reads the school's previous NAFS results (and the rule-based
 * plan already computed from them) and writes the interpretation a principal needs — what the
 * numbers mean together, the likely root causes, and a first 90-day plan tied to Dala's cycle.
 *
 * Every number on the page still comes from the report itself (lib/nafs/plan.ts). Claude only
 * explains them, and its reply is checked against the data before it is shown.
 */

/** Bump when the prompt or schema changes, so cached analyses are rebuilt. */
export const NAFS_ANALYSIS_VERSION = "v2";

export type Confidence = "عالية" | "متوسطة" | "منخفضة";
const CONFIDENCE: Confidence[] = ["عالية", "متوسطة", "منخفضة"];

export type NafsAnalysis = {
  executiveSummary: string;
  keyInsights: Array<{ title: string; detail: string; evidence: string }>;
  rootCauses: Array<{
    hypothesis: string;
    confidence: Confidence;
    howToVerify: string;
    relatedDomains: Array<{ grade: number; subject: string; domain: string }>;
  }>;
  plan90Days: Array<{ period: string; focus: string; actions: string[]; measure: string }>;
  quickWins: string[];
  dataCaveats: string[];
  teacherBrief: string;
};

/** Same inputs → same hash, so an analysis is generated once per set of results. */
export function nafsInputHash(baselines: NafsBaseline[]) {
  const canonical = [...baselines]
    .sort((a, b) => a.year - b.year || a.grade - b.grade || a.subject.localeCompare(b.subject, "ar"))
    .map((b) => ({ ...b, domains: [...b.domains].sort((x, y) => x.name.localeCompare(y.name, "ar")) }));
  return createHash("sha256").update(`${NAFS_ANALYSIS_VERSION}|${JSON.stringify(canonical)}`).digest("hex");
}

/** Everything Claude sees. Built from a whitelist: no school, principal, teacher or student names. */
export function nafsAnalysisPayload(baselines: NafsBaseline[], plan: NafsPlan) {
  return {
    السنوات_المتاحة: Array.from(new Set(baselines.map((b) => b.year))).sort(),
    النتائج_حسب_السنة: [...baselines]
      .sort((a, b) => a.year - b.year || a.grade - b.grade || a.subject.localeCompare(b.subject, "ar"))
      .map((b) => ({
        السنة: b.year,
        الصف: b.grade,
        المادة: b.subject,
        متوسط_الأداء: b.overallPercent,
        نسبة_التمكن: b.masteryPercent,
        عدد_المختبرين: b.testedCount,
        عدد_الغائبين: b.absentCount,
        المجالات: b.domains.map((d) => ({ المجال: d.name, النسبة: d.percent })),
        ...(b.levels.length ? { توزيع_الطلاب_على_مستويات_الأداء: b.levels.map((l) => ({ المستوى: l.name, النسبة: l.percent })) } : {}),
      })),
    آخر_سنة: plan.year,
    السنة_السابقة: plan.previousYear,
    حالة_آخر_سنة: plan.subjects.map((s) => ({
      الصف: s.grade,
      المادة: s.subject,
      مادة_دالة: s.dalaSubject,
      متوسط_الأداء: s.overall,
      التغير_عن_السابقة: s.change,
      نسبة_التمكن: s.mastery,
      نسبة_التمكن_السابقة: s.previousMastery,
      المجالات: s.domains.map((d) => ({ المجال: d.name, النسبة: d.percent, السابقة: d.previous, التغير: d.change, الأولوية_بالقواعد: d.priority, الهدف_المقترح: d.target })),
    })),
    الحضور_يوم_الاختبار: plan.attendance.map((a) => ({ الصف: a.grade, المختبرون: a.tested, الغائبون: a.absent, نسبة_الغياب: a.rate })),
    أولويات_القواعد: plan.priorities.map((p) => ({ الصف: p.grade, المادة: p.subject, المجال: p.domain, النسبة: p.percent, الهدف: p.target, الأولوية: p.priority })),
    دورة_دالة: plan.cycle.map((w) => ({ الأسبوع: w.week, المادة: w.subject, التركيز: w.focus })),
  };
}

export const NAFS_ANALYSIS_SYSTEM = `أنت خبير في التقويم التربوي وتحسين نواتج التعلم في المرحلة الابتدائية بالسعودية، وتعرف اختبارات نافس (الصف الثالث: رياضيات وقراءة؛ الصف السادس: رياضيات وقراءة وعلوم) ومجالاتها ومناهجها.
ستصلك نتائج نافس السابقة لمدرسة واحدة كما وردت في تقريرها، مع حالة آخر سنة وأولويات وأهداف محسوبة مسبقًا بقواعد ثابتة، ودورة دالة الأسبوعية (أسبوع لكل مادة ثم أسبوع محاكاة نافس). كل الأرقام صحيحة كما هي: لا تعد حسابها ولا تقدّرها.

مهمتك: تحليل معمّق يقرؤه قائد المدرسة، يتجاوز ما تقوله الجداول إلى ما تعنيه، في الحقول المطلوبة:
- executiveSummary: 3-5 جمل: أين تقف المدرسة، وما الاتجاه، وما القرار الأهم الآن.
- keyInsights: 3-5 استنتاجات لا تظهر من جدول واحد. لكل استنتاج: title قصير، وdetail شرح، وevidence الأرقام التي يستند إليها منسوخة من البيانات.
- rootCauses: 2-4 أسباب جذرية مرجّحة. لكل سبب: hypothesis، وconfidence (عالية أو متوسطة أو منخفضة)، وhowToVerify (كيف تتحقق منه المدرسة خلال أسابيع بتدريبات دالة التشخيصية)، وrelatedDomains: المجالات التي يفسّرها، كل منها بالصف والمادة واسم المجال منسوخًا حرفيًا من البيانات.
- plan90Days: 3 مراحل متتالية (مثل: الأسابيع 1-4، 5-8، 9-12). لكل مرحلة: period، وfocus، وactions (2-4 إجراءات محددة)، وmeasure (مؤشر قياس من تدريبات دالة).
- quickWins: حتى 3 إجراءات تنفَّذ هذا الأسبوع بلا تكلفة.
- dataCaveats: حدود هذه البيانات وما لا يمكن استنتاجه منها.
- teacherBrief: فقرة قصيرة يرسلها القائد لمعلميه تشرح الأولويات بلغة محفّزة.

طريقة التحليل قبل الكتابة:
1. افصل الاتجاه الحقيقي عن التذبذب: التغير بنقطة أو نقطتين قد يكون اختلاف دفعة لا تراجعًا فعليًا، خاصة مع عدد مختبرين صغير. وتغير متسق في كل المواد أو عبر أكثر من سنة أقوى دلالة.
2. ابحث عن نمط مشترك عبر المواد: مثلًا ضعف فهم المقروء يخفض أداء المسائل اللفظية في الرياضيات وأسئلة العلوم، فقد يكون سببًا جذريًا واحدًا لا ثلاث مشكلات منفصلة.
3. قارن الصف الثالث بالسادس إن وُجدا: الثالث إنذار مبكر لما سيصل إلى السادس بعد ثلاث سنوات.
4. لكل مجال ضعيف استحضر المهارات الفرعية التي يتعثر فيها طلاب هذا العمر عادة في المنهج السعودي (مثل: في الهندسة والقياس الخلط بين المحيط والمساحة وتحويل الوحدات)، وحوّلها إلى فرضيات قابلة للتحقق بتدريب تشخيصي.
5. الغياب يوم الاختبار: اذكر أثره المحتمل على تمثيل النتائج بحذر، دون أن تفترض كيف تحتسبه هيئة التقويم.
6. اربط الخطة بدورة دالة الفعلية: ماذا يُقاس في أسبوع كل مادة، ومتى يُعاد القياس، وما الذي يراجعه القائد نهاية كل دورة.
7. توزيع الطلاب على مستويات الأداء (إن وُجد): نسبة الطلاب في المستويين الأدنى تقيس حجم الحاجة إلى التأسيس، ونسبة الأعلى تقيس فرصة الإثراء؛ استخدمه لتحديد هل الأولوية علاج واسع لكل الفصل أم مجموعات صغيرة.

قواعد مهمة:
- نتائج نافس تصل للمدرسة أرقامًا مجمّعة: لا تستنتج شيئًا عن فصل أو معلم أو طالب بعينه.
- لا تخترع أرقامًا أو مجالات غير موجودة في البيانات. إذا لم تكفِ البيانات لحكم فقل ذلك في dataCaveats.
- لا تَلُم المعلمين ولا الطلاب؛ اكتب بلغة مهنية بنّاءة.
- اكتب بالعربية الفصحى البسيطة، وجملًا قصيرة واضحة.`;

export function buildNafsAnalysisUserMessage(baselines: NafsBaseline[], plan: NafsPlan) {
  return `نتائج نافس السابقة للمدرسة:\n${JSON.stringify(nafsAnalysisPayload(baselines, plan))}`;
}

const stringArray = { type: "array", items: { type: "string" } } as const;

/** JSON schema for Claude's structured output. parseNafsAnalysis still checks it against the data. */
export const NAFS_ANALYSIS_JSON_SCHEMA = {
  type: "object",
  properties: {
    executiveSummary: { type: "string" },
    keyInsights: {
      type: "array",
      items: {
        type: "object",
        properties: { title: { type: "string" }, detail: { type: "string" }, evidence: { type: "string" } },
        required: ["title", "detail", "evidence"],
        additionalProperties: false,
      },
    },
    rootCauses: {
      type: "array",
      items: {
        type: "object",
        properties: {
          hypothesis: { type: "string" },
          confidence: { type: "string", enum: CONFIDENCE },
          howToVerify: { type: "string" },
          relatedDomains: {
            type: "array",
            items: {
              type: "object",
              properties: {
                grade: { type: "integer", enum: [3, 6] },
                subject: { type: "string", enum: [...NAFS_SUBJECTS] },
                domain: { type: "string" },
              },
              required: ["grade", "subject", "domain"],
              additionalProperties: false,
            },
          },
        },
        required: ["hypothesis", "confidence", "howToVerify", "relatedDomains"],
        additionalProperties: false,
      },
    },
    plan90Days: {
      type: "array",
      items: {
        type: "object",
        properties: { period: { type: "string" }, focus: { type: "string" }, actions: stringArray, measure: { type: "string" } },
        required: ["period", "focus", "actions", "measure"],
        additionalProperties: false,
      },
    },
    quickWins: stringArray,
    dataCaveats: stringArray,
    teacherBrief: { type: "string" },
  },
  required: ["executiveSummary", "keyInsights", "rootCauses", "plan90Days", "quickWins", "dataCaveats", "teacherBrief"],
  additionalProperties: false,
} as const;

// ─── Validation against the data ──────────────────────────────────────────────

const text = (max: number) => z.string().trim().min(2).max(max);
const replySchema = z.object({
  executiveSummary: z.string().trim().min(20).max(1500),
  keyInsights: z.array(z.unknown()).default([]),
  rootCauses: z.array(z.unknown()).default([]),
  plan90Days: z.array(z.unknown()).default([]),
  quickWins: z.array(z.unknown()).default([]),
  dataCaveats: z.array(z.unknown()).default([]),
  teacherBrief: z.unknown().optional(),
});
const insightSchema = z.object({ title: text(150), detail: text(900), evidence: text(500) });
const rootCauseSchema = z.object({
  hypothesis: text(900),
  confidence: z.string().trim().default("متوسطة"),
  howToVerify: text(700),
  relatedDomains: z.array(z.object({ grade: z.coerce.number().int(), subject: z.string().trim(), domain: z.string().trim() })).default([]),
});
const phaseSchema = z.object({ period: text(60), focus: text(300), actions: z.array(z.unknown()).default([]), measure: text(400) });

function validItems<T>(items: unknown[], schema: z.ZodType<T, z.ZodTypeDef, unknown>): T[] {
  return items.flatMap((item) => {
    const parsed = schema.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
}

const normalize = (value: string) => value.replace(/[ً-ْـ]/g, "").replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/\s+/g, " ").trim();

/** Validates Claude's reply; keeps only domains that exist in the school's latest results. Null when unusable. */
export function parseNafsAnalysis(raw: unknown, plan: NafsPlan): NafsAnalysis | null {
  const parsed = replySchema.safeParse(raw);
  if (!parsed.success) return null;

  const known = new Map<string, { grade: number; subject: string; domain: string }>();
  plan.subjects.forEach((s) => s.domains.forEach((d) => {
    known.set(`${s.grade}|${s.subject}|${normalize(d.name)}`, { grade: s.grade, subject: s.subject, domain: d.name });
  }));

  const rootCauses = validItems(parsed.data.rootCauses, rootCauseSchema)
    .map((cause) => {
      const relatedDomains = cause.relatedDomains
        .map((d) => known.get(`${d.grade}|${d.subject}|${normalize(d.domain)}`))
        .filter((d): d is { grade: number; subject: string; domain: string } => Boolean(d))
        .filter((d, index, all) => all.findIndex((o) => o.grade === d.grade && o.subject === d.subject && o.domain === d.domain) === index);
      return {
        hypothesis: cause.hypothesis,
        confidence: (CONFIDENCE.includes(cause.confidence as Confidence) ? cause.confidence : "متوسطة") as Confidence,
        howToVerify: cause.howToVerify,
        relatedDomains,
      };
    })
    // A cause must explain at least one domain that is really in the data.
    .filter((cause) => cause.relatedDomains.length > 0)
    .slice(0, 4);

  const keyInsights = validItems(parsed.data.keyInsights, insightSchema).slice(0, 5);
  if (!keyInsights.length) return null;

  const plan90Days = validItems(parsed.data.plan90Days, phaseSchema)
    .map((phase) => ({ ...phase, actions: validItems(phase.actions, text(400)).slice(0, 4) }))
    .filter((phase) => phase.actions.length)
    .slice(0, 4);

  const teacherBrief = text(1200).safeParse(parsed.data.teacherBrief);

  return {
    executiveSummary: parsed.data.executiveSummary,
    keyInsights,
    rootCauses,
    plan90Days,
    quickWins: validItems(parsed.data.quickWins, text(400)).slice(0, 3),
    dataCaveats: validItems(parsed.data.dataCaveats, text(400)).slice(0, 4),
    teacherBrief: teacherBrief.success ? teacherBrief.data : "",
  };
}
