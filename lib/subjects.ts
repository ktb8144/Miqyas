export function normalizeSubject(subject: string | null | undefined) {
  const value = (subject ?? "").trim();
  if (["لغة عربية", "اللغة العربية", "عربية", "قراءة", "لغتي"].includes(value)) return "لغة عربية";
  if (value === "رياضيات" || value === "الرياضيات") return "رياضيات";
  if (value === "علوم" || value === "العلوم") return "علوم";
  return value;
}
