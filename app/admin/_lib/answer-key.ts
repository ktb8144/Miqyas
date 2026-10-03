import { toEnglishDigits } from "@/lib/format";
import type { AnswerKeyValidationResult } from "./types";

const ANSWER_KEY_OPTION_LABELS = ["أ", "ب", "ج", "د"] as const;

export function validateAnswerKeyJson(rawValue: string): AnswerKeyValidationResult {
  const raw = rawValue.trim();
  if (!raw) {
    return { count: 0, summary: [] };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("صيغة JSON غير صحيحة.");
  }

  const questions = Array.isArray(parsed)
    ? parsed as Array<Record<string, unknown>>
    : parsed && typeof parsed === "object" && !Array.isArray(parsed) && Array.isArray((parsed as { questions?: unknown }).questions)
      ? (parsed as { questions: Array<Record<string, unknown>> }).questions
      : null;

  if (!questions) {
    throw new Error("صيغة JSON غير صحيحة. يجب أن يحتوي الملف على questions كمصفوفة.");
  }

  if (questions.length === 0) {
    throw new Error("مفتاح الإجابة لا يحتوي على أسئلة.");
  }

  const summary = questions.map((question, index) => {
    const number = Number(question.question_number || index + 1);
    const correctAnswer = typeof question.correct_answer === "string" ? question.correct_answer.trim() : "";
    const skill = typeof question.skill === "string" ? question.skill.trim() : "";
    const domain = typeof question.domain === "string" ? question.domain.trim() : "";
    const difficulty = typeof question.difficulty === "string" ? question.difficulty.trim() : "";
    const options = question.options && typeof question.options === "object" && !Array.isArray(question.options)
      ? question.options as Record<string, unknown>
      : null;

    if (!question.question_number || !Number.isFinite(number)) {
      throw new Error(`السؤال رقم ${number || index + 1} لا يحتوي على رقم سؤال صحيح.`);
    }
    if (!correctAnswer) {
      throw new Error(`السؤال رقم ${number} لا يحتوي على إجابة صحيحة.`);
    }
    if (!ANSWER_KEY_OPTION_LABELS.includes(correctAnswer as (typeof ANSWER_KEY_OPTION_LABELS)[number])) {
      throw new Error(`الإجابة الصحيحة في السؤال رقم ${number} يجب أن تكون أ أو ب أو ج أو د.`);
    }
    if (!skill) {
      throw new Error(`السؤال رقم ${number} لا يحتوي على المهارة.`);
    }
    if (!domain) {
      throw new Error(`السؤال رقم ${number} لا يحتوي على المجال.`);
    }
    if (!difficulty) {
      throw new Error(`السؤال رقم ${number} لا يحتوي على مستوى الصعوبة.`);
    }
    if (!options || ANSWER_KEY_OPTION_LABELS.some((label) => typeof options[label] !== "string" || !String(options[label]).trim())) {
      throw new Error(`السؤال رقم ${number} لا يحتوي على الخيارات الأربعة.`);
    }

    return `سؤال ${toEnglishDigits(number)}: ${correctAnswer} - ${skill}`;
  });

  return { count: questions.length, summary };
}

export const ANSWER_KEY_JSON_EXAMPLE = `{
  "questions": [
    {
      "question_number": 1,
      "correct_answer": "ب",
      "skill": "المتوسط الحسابي",
      "domain": "الإحصاء والاحتمال",
      "difficulty": "easy",
      "explanation": "ملاحظة علاجية أو تفسير",
      "options": {
        "أ": "٥",
        "ب": "٦",
        "ج": "٧",
        "د": "٨"
      }
    }
  ]
}`;
