/**
 * Reading photos with an AI model (answer sheets, name lists) is OFF unless this flag is set.
 * Default off: Dala reads its own answer sheets on the device, and children's papers and
 * names are not sent to an outside model. Turn on only with a provider whose terms allow it.
 */
export const AI_READING_ENABLED = process.env.NEXT_PUBLIC_AI_READING_ENABLED === "true";

export const AI_READING_DISABLED_MESSAGE =
  "القراءة بالذكاء الاصطناعي متوقفة. استخدم ورقة إجابة دالة أو أدخل الإجابات يدويًا.";
