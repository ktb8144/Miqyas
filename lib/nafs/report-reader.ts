import "server-only";
import { generateClaudeJson, type UsageContext } from "@/lib/claude";
import { NAFS_SUBJECTS } from "@/lib/nafs/baseline";
import { parseNafsReport, type NafsReportReading } from "@/lib/nafs/report-parse";

/**
 * Reads a school's NAFS results report (PDF or photos) with Claude. The principal reviews and
 * corrects every number before anything is saved; the file itself is never stored.
 * Reports come in several layouts (ETEC's report, school or education-office analysis cards),
 * and the text layer of these PDFs is often broken, so Claude reads the pages as it sees them.
 */

export const NAFS_REPORT_SYSTEM = `أنت تقرأ تقرير نتائج اختبارات نافس الوطنية لمدرسة ابتدائية سعودية (ملف PDF أو صور). قد يكون التقرير الرسمي من هيئة تقويم التعليم والتدريب، أو بطاقة تحليل تعبّئها المدرسة أو مكتب التعليم بقالب خاص. النص داخل ملفات PDF قد يكون مكسورًا (حروف ساقطة)، فاعتمد على ما تراه في الصفحة.

المطلوب الأرقام فقط: نتيجة واحدة في results لكل سنة × صف × مادة:
- year: سنة الاختبار الميلادية المكتوبة بجانب الرقم (مثل 2024). عبارة مثل "2023 - 2024" في العنوان تعني أن التقرير يقارن سنتين؛ خذ سنة كل رقم من موضعه. إذا كانت السنة هجرية فحوّلها لسنة الاختبار الميلادية (1445هـ ← 2024، 1446هـ ← 2025) واذكر ذلك في warnings.
- grade: 3 أو 6 (الصف المستهدف).
- subject: رياضيات، أو قراءة (وتشمل: لغتي، اللغة العربية، القراءة)، أو علوم.
- masteryPercent: نسبة الطلاب الذين اجتازوا الحد الأدنى للإتقان (أو حققوا التمكن) في المادة. إذا ظهرت فقط نسبة من لم يجتازوا، فالقيمة = 100 ناقص تلك النسبة.
- overallPercent: متوسط أداء المدرسة في المادة كنسبة مئوية، فقط إن ذكره التقرير صراحة باسم المتوسط أو الأداء العام. لا تشتقه من نسبة الإتقان.
- testedCount وabsentCount: عدد الطلاب المختبرين والغائبين في هذا الصف. إذا ذُكرت للصف كله لا لكل مادة، فضعها في كل مادة من مواد تلك السنة.
- domains: المجالات الفرعية للمادة باسمها في التقرير (صحّح الحروف الساقطة فقط) ونسبتها المئوية المكتوبة (لا عدد الطلاب).
- levels: توزيع الطلاب على مستويات الأداء بأسمائها في التقرير (مثل: مرتفع، متوسط، منخفض، منخفض جدًا)، من الأعلى إلى الأدنى، بالنسبة المئوية لا بالعدد.
- إذا لم يحدد التقرير سنة المجالات أو المستويات أو أعداد المختبرين، فهي لأحدث سنة فيه.

قواعد:
- انسخ الأرقام كما هي مطبوعة ولا تحسب غيرها (عدا 100 ناقص نسبة عدم الاجتياز). الأرقام العربية مثل ٣١٫١٥ تُكتب 31.15، وبلا علامة %.
- أي رقم غير موجود أو غير مقروء بثقة: ضع -1، والمجالات أو المستويات غير الموجودة: قائمة فارغة. واذكر في warnings ما لم تستطع قراءته.
- تجاهل تمامًا: أسماء الأشخاص (القائد والمعلمين وفرق العمل)، واسم المدرسة، والرقم الوزاري، والخطط والنصوص الوصفية، والنسب المجمّعة لكل المواد معًا.
- warnings: حتى 5 ملاحظات قصيرة بالعربية عمّا يحتاج أن يراجعه القائد، بلا أسماء أشخاص. لا تذكر القيمة -1 ولا تكتب ملاحظة لمجرد أن رقمًا غير موجود؛ الخانة الفارغة تكفي.
- إذا لم يكن الملف تقرير نتائج نافس، فاجعل isNafsReport = false وresults قائمة فارغة.`;

const namedPercent = {
  type: "array",
  items: {
    type: "object",
    properties: { name: { type: "string" }, percent: { type: "number" } },
    required: ["name", "percent"],
    additionalProperties: false,
  },
} as const;

export const NAFS_REPORT_JSON_SCHEMA = {
  type: "object",
  properties: {
    isNafsReport: { type: "boolean" },
    results: {
      type: "array",
      items: {
        type: "object",
        properties: {
          year: { type: "integer" },
          grade: { type: "integer", enum: [3, 6] },
          subject: { type: "string", enum: [...NAFS_SUBJECTS] },
          overallPercent: { type: "number" },
          masteryPercent: { type: "number" },
          testedCount: { type: "integer" },
          absentCount: { type: "integer" },
          domains: namedPercent,
          levels: namedPercent,
        },
        required: ["year", "grade", "subject", "overallPercent", "masteryPercent", "testedCount", "absentCount", "domains", "levels"],
        additionalProperties: false,
      },
    },
    warnings: { type: "array", items: { type: "string" } },
  },
  required: ["isNafsReport", "results", "warnings"],
  additionalProperties: false,
} as const;

export type ReportFile = { mediaType: string; data: string };

export async function readNafsReport(files: ReportFile[], context: UsageContext): Promise<NafsReportReading> {
  const reply = await generateClaudeJson({
    task: "nafs_report",
    system: NAFS_REPORT_SYSTEM,
    prompt: "اقرأ نتائج نافس من التقرير المرفق.",
    documents: files.filter((f) => f.mediaType === "application/pdf").map((f) => ({ data: f.data })),
    images: files.filter((f) => f.mediaType !== "application/pdf"),
    schema: NAFS_REPORT_JSON_SCHEMA,
    maxTokens: 16000,
    timeoutMs: 110000,
    context,
  });
  return parseNafsReport(reply.data);
}
