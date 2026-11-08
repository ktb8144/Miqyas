import "server-only";
import { generateClaudeJson, type UsageContext } from "@/lib/claude";

/**
 * Reads the student names off a teacher's photo of a class list (a Noor printout, a handwritten
 * list, a screenshot) with Claude. The teacher reviews and edits the list before anything is saved.
 */

export const STUDENT_NAMES_SYSTEM = `أنت تقرأ صورة كشف أسماء طلاب فصل في مدرسة سعودية (مطبوع من نظام نور، أو مكتوب بخط اليد، أو لقطة شاشة).
المطلوب: أسماء الطلاب فقط، بترتيبها في الكشف من الأعلى إلى الأسفل.
- انسخ كل اسم كما هو مكتوب حرفيًا، بالعربية، دون تصحيح الإملاء أو إكمال اسم ناقص.
- تجاهل: الأرقام التسلسلية، وأرقام الهوية والسجل، والعناوين ورؤوس الأعمدة (مثل: اسم الطالب، م، الفصل)، واسم المدرسة والمعلم، والتواقيع والملاحظات.
- إذا لم تستطع قراءة اسم بثقة فاتركه ولا تخمّنه.
- إذا كانت الصورة لا تحتوي كشف أسماء، أرجع قائمة فارغة.`;

const SCHEMA = {
  type: "object",
  properties: { names: { type: "array", items: { type: "string" } } },
  required: ["names"],
  additionalProperties: false,
} as const;

const MEDIA_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

/** Clean list: trimmed, no digits-only or one-word noise, no duplicates, at most 80. */
export function cleanNames(raw: unknown): string[] {
  const names = (raw as { names?: unknown } | null)?.names;
  if (!Array.isArray(names)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of names) {
    if (typeof value !== "string") continue;
    const name = value
      .replace(/[0-9٠-٩]+/g, "")
      .replace(/\s+/g, " ")
      .replace(/^[\s\-–—.)(:،,]+|[\s\-–—.)(:،,]+$/g, "")
      .trim();
    if (name.length < 3 || name.length > 80 || !/[؀-ۿa-zA-Z]/.test(name)) continue;
    if (seen.has(name)) continue;
    seen.add(name);
    out.push(name);
    if (out.length >= 80) break;
  }
  return out;
}

export async function readNamesWithClaude(imageBase64: string, mimeType: string, context: UsageContext) {
  const reply = await generateClaudeJson({
    task: "student_names",
    system: STUDENT_NAMES_SYSTEM,
    prompt: "اقرأ أسماء الطلاب من صورة الكشف.",
    images: [{ mediaType: MEDIA_TYPES.has(mimeType) ? mimeType : "image/jpeg", data: imageBase64 }],
    schema: SCHEMA,
    maxTokens: 8000,
    timeoutMs: 50000,
    context,
  });
  return cleanNames(reply.data);
}
