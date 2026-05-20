import { GoogleGenerativeAI } from "@google/generative-ai";
import { createHash } from "crypto";

const GEMINI_VISION_MODEL = process.env.GEMINI_VISION_MODEL || "gemini-2.5-flash";
const scanCache = new Map<string, OMRResult>();

export function getGeminiVisionModelName() {
  return GEMINI_VISION_MODEL;
}

function getModel() {
  const key = process.env.GEMINI_API_KEY;
  if (!key || key === "your_gemini_key_here") {
    throw new Error("GEMINI_API_KEY is not configured");
  }
  const genAI = new GoogleGenerativeAI(key);
  return genAI.getGenerativeModel({
    model: GEMINI_VISION_MODEL,
    generationConfig: {
      temperature: 0,
      topP: 0.1,
      responseMimeType: "application/json",
    },
  });
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OMRResult {
  [key: string]: string; // e.g. { q1: "ب", q2: "أ", ... }
}

const ARABIC_DIGITS: Record<string, string> = {
  "٠": "0",
  "١": "1",
  "٢": "2",
  "٣": "3",
  "٤": "4",
  "٥": "5",
  "٦": "6",
  "٧": "7",
  "٨": "8",
  "٩": "9",
};

function stripCodeFence(text: string) {
  return text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
}

function cloneOmrResult(result: OMRResult): OMRResult {
  return { ...result };
}

function computeImageHash(imageBase64: string) {
  return createHash("sha256").update(imageBase64).digest("hex");
}

function getCachedScan(cacheKey: string, imageHash: string): OMRResult | null {
  const cached = scanCache.get(cacheKey);
  return cached ? { ...cloneOmrResult(cached), _imageHash: imageHash, _modelName: GEMINI_VISION_MODEL, _cacheHit: "true" } : null;
}

function setCachedScan(cacheKey: string, result: OMRResult) {
  if (scanCache.size > 100) {
    const oldestKey = scanCache.keys().next().value as string | undefined;
    if (oldestKey) scanCache.delete(oldestKey);
  }
  scanCache.set(cacheKey, cloneOmrResult(result));
}

function normalizeQuestionKey(key: string) {
  const englishDigits = key.replace(/[٠-٩]/g, (digit) => ARABIC_DIGITS[digit] ?? digit);
  const match = englishDigits.match(/(?:q|س|السؤال)?\s*([0-9]+)/i);
  return match ? `q${match[1]}` : null;
}

function toEnglishDigitString(value: string) {
  return value.replace(/[٠-٩]/g, (digit) => ARABIC_DIGITS[digit] ?? digit);
}

function normalizeStudentCode(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number") return "";
  const digits = toEnglishDigitString(String(value)).replace(/[^\d]/g, "");
  if (!digits) return "";
  const numeric = Number(digits);
  return Number.isFinite(numeric) ? String(numeric) : digits;
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

export interface Question {
  text: string;
  options: { أ: string; ب: string; ج: string; د: string };
  correct: "أ" | "ب" | "ج" | "د";
  bloomLevel: string;
  explanation: string;
}

// ─── Function 1: Scan answer sheet image ─────────────────────────────────────

export async function scanAnswerSheet(
  imageBase64: string,
  totalQuestions: number,
  mimeType: string = "image/jpeg"
): Promise<OMRResult> {
  const imageHash = computeImageHash(imageBase64);
  const cacheKey = `answer_sheet:${GEMINI_VISION_MODEL}:${mimeType}:${totalQuestions}:${imageHash}`;
  const cached = getCachedScan(cacheKey, imageHash);
  if (cached) return cached;

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
    const parsed = JSON.parse(jsonText) as OMRResult;
    parsed._imageHash = imageHash;
    parsed._modelName = GEMINI_VISION_MODEL;
    parsed._cacheHit = "false";
    setCachedScan(cacheKey, parsed);
    return parsed;
  } catch {
    const partial: OMRResult = { studentName: "" };
    for (let i = 1; i <= totalQuestions; i++) {
      partial[`q${i}`] = "unclear";
    }
    partial._imageHash = imageHash;
    partial._modelName = GEMINI_VISION_MODEL;
    partial._cacheHit = "false";
    setCachedScan(cacheKey, partial);
    return partial;
  }
}

// ─── Function 1B: Scan answers from a marked question paper ─────────────────

export async function scanQuestionPaperAnswers(
  imageBase64: string,
  totalQuestions: number,
  mimeType: string = "image/jpeg"
): Promise<OMRResult> {
  const imageHash = computeImageHash(imageBase64);
  const cacheKey = `question_paper:${GEMINI_VISION_MODEL}:${mimeType}:${totalQuestions}:${imageHash}`;
  const cached = getCachedScan(cacheKey, imageHash);
  if (cached) return cached;

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
    normalized._imageHash = imageHash;
    normalized._modelName = GEMINI_VISION_MODEL;
    normalized._cacheHit = "false";
    setCachedScan(cacheKey, normalized);
    return normalized;
  } catch {
    const normalized = normalizeScannedAnswers({}, totalQuestions);
    normalized._parseableJson = "false";
    normalized._geminiReturnedText = text ? "true" : "false";
    normalized._rawTextPreview = text.slice(0, 300);
    normalized._imageHash = imageHash;
    normalized._modelName = GEMINI_VISION_MODEL;
    normalized._cacheHit = "false";
    setCachedScan(cacheKey, normalized);
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
  const jsonText = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

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

// ─── Function 3: Generate NAFIS-style MCQ questions ──────────────────────────

export async function generateQuestions(
  grade: string,
  subject: string,
  skill: string,
  bloomLevel: string,
  count: number
): Promise<Question[]> {
  const model = getModel();

  const prompt = `أنت متخصص في إعداد الاختبارات وفق معايير هيئة تقويم التعليم والتدريب (هيئة نافس) في المملكة العربية السعودية.

أعد ${count} أسئلة اختيار من متعدد (MCQ) باللغة العربية للمواصفات التالية:
- الصف: ${grade} ابتدائي
- المادة: ${subject}
- المهارة: ${skill}
- مستوى بلوم: ${bloomLevel}

شروط الأسئلة:
1. كل سؤال له 4 خيارات (أ، ب، ج، د)
2. خيار صحيح واحد فقط
3. الأسئلة مناسبة للمرحلة الدراسية
4. متنوعة وتقيس المهارة بطرق مختلفة
5. واضحة ولا تحتمل التأويل

أعد النتيجة بصيغة JSON فقط:
[
  {
    "text": "نص السؤال",
    "options": {
      "أ": "الخيار الأول",
      "ب": "الخيار الثاني",
      "ج": "الخيار الثالث",
      "د": "الخيار الرابع"
    },
    "correct": "أ",
    "bloomLevel": "${bloomLevel}",
    "explanation": "شرح مختصر للإجابة الصحيحة"
  }
]

أعد JSON فقط بدون markdown أو نص إضافي.`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();
  const jsonText = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

  try {
    return JSON.parse(jsonText) as Question[];
  } catch {
    return [];
  }
}

// ─── Function 4: Generate remedial worksheet ─────────────────────────────────

export interface WorksheetExercise {
  questionNumber: number;
  skill: string;
  question: string;
  options?: string[];
  type: "mcq" | "open" | "fill";
}

export async function generateWorksheet(
  weakSkills: string[],
  unit: string,
  grade: string = "الثالث",
  subject: string = "الرياضيات",
  studentName?: string
): Promise<WorksheetExercise[]> {
  const model = getModel();

  const target = studentName ? `الطالب: ${studentName}` : "فصل كامل";

  const prompt = `أنت معلم رياضيات خبير في المرحلة الابتدائية في المملكة العربية السعودية.

اعداد ورقة عمل علاجية مخصصة لـ ${target}:
- الصف: ${grade} ابتدائي
- المادة: ${subject}
- الوحدة: ${unit}
- المهارات المستهدفة (نقاط الضعف):
${weakSkills.map((s, i) => `${i + 1}. ${s}`).join("\n")}

أعد ورقة عمل تحتوي على ${weakSkills.length * 2} تمرين (تمرينان لكل مهارة):
- نوع التمارين: اختيار من متعدد، أو ملء الفراغ، أو مسألة مفتوحة
- اجعل التمارين تدريجية من السهل للصعب
- استخدم أمثلة حياتية مناسبة لطلاب الثالث الابتدائي

أعد النتيجة كـ JSON فقط:
[
  {
    "questionNumber": 1,
    "skill": "اسم المهارة المستهدفة",
    "question": "نص السؤال",
    "type": "mcq",
    "options": ["أ. الخيار الأول", "ب. الخيار الثاني", "ج. الخيار الثالث", "د. الخيار الرابع"]
  },
  {
    "questionNumber": 2,
    "skill": "اسم المهارة المستهدفة",
    "question": "أكمل الفراغ: ١/٢ = ___ / ٤",
    "type": "fill"
  },
  {
    "questionNumber": 3,
    "skill": "اسم المهارة المستهدفة",
    "question": "حل المسألة وأظهر خطواتك:",
    "type": "open"
  }
]

JSON فقط، بدون markdown أو نص إضافي.`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();
  const jsonText = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

  try {
    return JSON.parse(jsonText) as WorksheetExercise[];
  } catch {
    return [];
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
  const jsonText = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

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
