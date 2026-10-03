import { GoogleGenerativeAI } from "@google/generative-ai";
import { normalizeStudentCode, toEnglishDigits } from "@/lib/format";

// Pin an explicit model version. Aliases such as "gemini-flash-latest" are
// silently re-pointed by Google, which changes grading accuracy and cost
// without any code change. Override per environment with GEMINI_MODEL.
const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

function getModel() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error("GEMINI_API_KEY is not configured");
  }
  const genAI = new GoogleGenerativeAI(key);
  return genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL });
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OMRResult {
  [key: string]: string; // e.g. { q1: "ب", q2: "أ", ... }
}

function stripCodeFence(text: string) {
  return text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
}

function normalizeQuestionKey(key: string) {
  const englishDigits = toEnglishDigits(key);
  const match = englishDigits.match(/(?:q|س|السؤال)?\s*([0-9]+)/i);
  return match ? `q${match[1]}` : null;
}

function normalizeOption(value: unknown) {
  if (typeof value !== "string") return null;
  const option = value.trim().replace(/^ا$/, "أ");
  if (["أ", "ب", "ج", "د", "blank", "unclear"].includes(option)) return option;
  if (["فارغ", "بدون إجابة"].includes(option)) return "blank";
  if (["غير واضح", "غير مؤكدة", "غير مؤكد"].includes(option)) return "unclear";
  return null;
}

function normalizeScannedAnswers(raw: unknown, totalQuestions: number): OMRResult {
  const source = raw && typeof raw === "object" && "answers" in raw
    ? (raw as { answers?: unknown }).answers
    : raw;
  const result: OMRResult = {
    studentName: raw && typeof raw === "object" && typeof (raw as { studentName?: unknown }).studentName === "string"
      ? String((raw as { studentName: string }).studentName).trim()
      : "",
  };
  if (raw && typeof raw === "object") {
    const object = raw as Record<string, unknown>;
    result.studentCode = normalizeStudentCode(
      object.studentCode ?? object.student_code ?? object["رقم الطالب"] ?? object["رقم_الطالب"]
    );
  } else {
    result.studentCode = "";
  }
  let detectedAnswerCount = 0;

  if (source && typeof source === "object" && !Array.isArray(source)) {
    Object.entries(source as Record<string, unknown>).forEach(([key, value]) => {
      if (["studentName", "studentCode", "student_code", "رقم الطالب", "رقم_الطالب"].includes(key)) return;
      const normalizedKey = normalizeQuestionKey(key);
      const normalizedOption = normalizeOption(value);
      if (!normalizedKey || !normalizedOption) return;
      const questionNumber = Number(normalizedKey.slice(1));
      if (!Number.isInteger(questionNumber) || questionNumber < 1 || questionNumber > totalQuestions) return;
      result[normalizedKey] = normalizedOption;
      if (normalizedOption !== "blank") detectedAnswerCount += 1;
    });
  }

  for (let i = 1; i <= totalQuestions; i++) {
    if (!result[`q${i}`]) result[`q${i}`] = "blank";
  }

  result._detectedAnswerCount = String(detectedAnswerCount);
  return result;
}

export interface StudentResult {
  name: string;
  score: number;
  total: number;
  level: string;
}

export interface ClassReport {
  summary: string;
  strengths: string;
  weaknesses: string;
  interventionPlan: string;
  recommendations: string;
}


// ─── Function 1: Scan answer sheet image ─────────────────────────────────────

export async function scanAnswerSheet(
  imageBase64: string,
  totalQuestions: number,
  mimeType: string = "image/jpeg"
): Promise<OMRResult> {
  const model = getModel();

  const prompt = `You are analyzing a physical paper answer sheet from a Saudi school exam.

The sheet has exactly ${totalQuestions} questions.
Each question has 4 answer circles labeled:
أ  ب  ج  د
(right to left order on the Arabic paper)

Your task:
1. Look at each question row carefully
2. Identify which single circle has been filled in, shaded, or marked with a pen
3. A filled circle will appear darker or have a mark inside it

Also look for the student name field at the top of the paper. It usually says:
اسم الطالب: ___________
Extract whatever is written in that field.

CRITICAL RULES:
- Never assume all answers are the same letter
- Look at EACH question independently
- If a circle is clearly darker/marked = that letter is the answer
- If no circle is marked for a question = write "blank"
- If the marking is unclear = write "unclear"
- Return ONLY valid JSON, nothing else

Return this exact format (all ${totalQuestions} questions + studentName):
{"studentName":"اسم الطالب هنا","q1":"ب","q2":"أ","q3":"ج","q4":"د","q5":"ب","q6":"أ","q7":"ج","q8":"د","q9":"ب","q10":"أ"}

Each answer value must be exactly one of: أ ب ج د blank unclear
If no student name is found, use empty string "" for studentName.
Return the JSON object only — no markdown, no explanation.`;

  const result = await model.generateContent([
    prompt,
    { inlineData: { mimeType, data: imageBase64 } },
  ]);

  const text = result.response.text().trim();
  const jsonText = stripCodeFence(text);

  try {
    return JSON.parse(jsonText) as OMRResult;
  } catch {
    const partial: OMRResult = { studentName: "" };
    for (let i = 1; i <= totalQuestions; i++) {
      partial[`q${i}`] = "unclear";
    }
    return partial;
  }
}

// ─── Function 1B: Scan answers from a marked question paper ─────────────────

export async function scanQuestionPaperAnswers(
  imageBase64: string,
  totalQuestions: number,
  mimeType: string = "image/jpeg"
): Promise<OMRResult> {
  const model = getModel();

  const prompt = `You are analyzing a full printed Arabic question paper from a Saudi school exam.

This is NOT a separate OMR answer sheet.
The student marks or shades one option directly on the same question paper.

The paper has exactly ${totalQuestions} multiple-choice questions on one A4 page.
Each question has four options labeled exactly:
أ، ب، ج، د
There may be circles or bubbles next to the options.

Your task:
1. Read the student's visible markings only.
2. Identify which option the student selected, shaded, circled, ticked, or marked for each question.
3. Extract the student name from the top of the paper if clearly visible.
4. Extract the student code/number from the top of the paper if clearly visible.

CRITICAL RULES:
- Do NOT solve the math/science/reading questions.
- Do NOT infer the answer from correctness.
- Do NOT use your knowledge to choose the correct option.
- Only report what the student physically selected or shaded.
- If no clear mark exists for a question, return "blank".
- If multiple options are marked, or the shading is unclear, return "unclear".
- If a corner marker is missing, ignore it and still inspect the page.
- The student code is usually a number from 1 to 40.
- The student code may be written in Arabic digits or English digits.
- Normalize the student code to English digits in the returned JSON.
- Return strict JSON only. No markdown. No explanation.

Valid answer values are exactly: أ ب ج د blank unclear

Return this exact shape:
{
  "studentName": "أحمد محمد",
  "studentCode": "17",
  "answers": {
    "q1": "أ",
    "q2": "ب",
    "q3": "blank",
    "q4": "unclear"
  }
}`;

  const result = await model.generateContent([
    prompt,
    { inlineData: { mimeType, data: imageBase64 } },
  ]);

  const text = result.response.text().trim();
  const jsonText = stripCodeFence(text);

  try {
    const normalized = normalizeScannedAnswers(JSON.parse(jsonText), totalQuestions);
    normalized._parseableJson = "true";
    normalized._geminiReturnedText = text ? "true" : "false";
    normalized._rawTextPreview = text.slice(0, 300);
    return normalized;
  } catch {
    const normalized = normalizeScannedAnswers({}, totalQuestions);
    normalized._parseableJson = "false";
    normalized._geminiReturnedText = text ? "true" : "false";
    normalized._rawTextPreview = text.slice(0, 300);
    return normalized;
  }
}

// ─── Function 2: Generate class report ───────────────────────────────────────

export async function generateClassReport(
  teacherName: string,
  skill: string,
  grade: string,
  subject: string,
  results: StudentResult[]
): Promise<ClassReport> {
  const model = getModel();

  const summary = results
    .map((r) => `- ${r.name}: ${r.score}/${r.total} (${r.level})`)
    .join("\n");

  const advanced = results.filter((r) => r.level === "متقدم").length;
  const proficient = results.filter((r) => r.level === "متمكن").length;
  const basic = results.filter((r) => r.level === "أساسي").length;
  const belowBasic = results.filter((r) => r.level === "دون الأساسي").length;

  const prompt = `أنت خبير تربوي متخصص في تحليل نتائج الطلاب وإعداد التقارير التعليمية.

بيانات التقييم:
- المعلم: ${teacherName}
- المهارة: ${skill}
- الصف: ${grade}
- المادة: ${subject}
- عدد الطلاب: ${results.length}

توزيع المستويات (وفق معايير هيئة تقويم التعليم ETEC):
- متقدم (90-100%): ${advanced} طلاب
- متمكن (70-89%): ${proficient} طلاب
- أساسي (50-69%): ${basic} طلاب
- دون الأساسي (0-49%): ${belowBasic} طلاب

نتائج الطلاب:
${summary}

أعد تقريراً تعليمياً شاملاً باللغة العربية بصيغة JSON فقط:
{
  "summary": "ملخص شامل لأداء الفصل (فقرة واحدة)",
  "strengths": "نقاط القوة في الفصل والمهارات المتقنة",
  "weaknesses": "نقاط الضعف والمهارات التي تحتاج تحسيناً",
  "interventionPlan": "خطة تدخل مقترحة للطلاب دون الأساسي والأساسي (خطوات عملية)",
  "recommendations": "توصيات للمعلم لتحسين نتائج نافس"
}

أعد JSON فقط بدون markdown أو نص إضافي. التقرير يجب أن يكون احترافياً ومفيداً ومحفزاً.
لا تستخدم كلمات: ضعيف، فاشل، موهوب.`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();
  const jsonText = stripCodeFence(text);

  try {
    return JSON.parse(jsonText) as ClassReport;
  } catch {
    return {
      summary: text,
      strengths: "—",
      weaknesses: "—",
      interventionPlan: "—",
      recommendations: "—",
    };
  }
}

// ─── Function 5: Extract student names from attendance sheet image ────────────

export async function extractStudentNames(
  imageBase64: string,
  mimeType: string = "image/jpeg"
): Promise<string[]> {
  const model = getModel();

  const prompt = `This is a Saudi school student attendance sheet written in Arabic.
Extract all student names from the list.
Names are typically written as:
رقم - اسم الطالب

Rules:
- Return ONLY the names, not numbers
- Keep names in Arabic exactly as written
- If you see unclear text, skip it
- Return valid JSON array only:
["أحمد محمد السالم", "خالد عبدالله", ...]

Return the JSON array only, no other text, no markdown.`;

  const result = await model.generateContent([
    prompt,
    { inlineData: { mimeType, data: imageBase64 } },
  ]);

  const text = result.response.text().trim();
  const jsonText = stripCodeFence(text);

  try {
    const parsed = JSON.parse(jsonText);
    if (Array.isArray(parsed)) {
      return parsed.filter((n): n is string => typeof n === "string" && n.trim().length > 0);
    }
    return [];
  } catch {
    return [];
  }
}
