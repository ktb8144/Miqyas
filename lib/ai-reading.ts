/**
 * Reading photos with an AI model (answer sheets, name lists) is OFF unless this flag is set.
 * Default off: Dala reads its own answer sheets on the device, and children's papers and
 * names are not sent to an outside model. Turn on only with a provider whose terms allow it.
 */
export const AI_READING_ENABLED = process.env.NEXT_PUBLIC_AI_READING_ENABLED === "true";

/**
 * Reading a photo of a class list (to add students) with Claude. On by default: names are the
 * point of that photo, and Anthropic does not train on API data by default. Set
 * NEXT_PUBLIC_NAME_PHOTO_READING=false to hide it. Gemini is used for it only when AI_READING_ENABLED.
 */
export const NAME_PHOTO_ENABLED = AI_READING_ENABLED || process.env.NEXT_PUBLIC_NAME_PHOTO_READING !== "false";

export const AI_READING_DISABLED_MESSAGE =
  "القراءة بالذكاء الاصطناعي متوقفة. استخدم ورقة إجابة دالة أو أدخل الإجابات يدويًا.";
