import { GoogleGenerativeAI } from "@google/generative-ai";

function getModel() {
  const key = process.env.GEMINI_API_KEY;
  if (!key || key === "your_gemini_key_here") {
    throw new Error("GEMINI_API_KEY is not configured");
  }
  const genAI = new GoogleGenerativeAI(key);
  return genAI.getGenerativeModel({ model: "gemini-flash-latest" });
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OMRResult {
  [key: string]: string; // e.g. { q1: "ب", q2: "أ", ... }
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
  const jsonText = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

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
