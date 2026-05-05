export const ETEC_LEVELS = {
  متقدم: { min: 90, max: 100, color: "#7F77DD", bg: "bg-purple-100", text: "text-purple-700", border: "border-purple-300" },
  متمكن: { min: 70, max: 89, color: "#1D9E75", bg: "bg-green-100", text: "text-green-700", border: "border-green-300" },
  أساسي: { min: 50, max: 69, color: "#BA7517", bg: "bg-amber-100", text: "text-amber-700", border: "border-amber-300" },
  "دون الأساسي": { min: 0, max: 49, color: "#E24B4A", bg: "bg-red-100", text: "text-red-700", border: "border-red-300" },
};

export function getLevel(score: number, total: number) {
  const pct = (score / total) * 100;
  if (pct >= 90) return "متقدم";
  if (pct >= 70) return "متمكن";
  if (pct >= 50) return "أساسي";
  return "دون الأساسي";
}

export const school = {
  name: "مدرسة الأمير محمد الابتدائية — الدمام",
  principal: "محمد بن عبدالله القحطاني",
};

export const teachers = [
  { id: 1, name: "عبدالله السالم", grade: "الثالث", subject: "الرياضيات", activation: 95, submission: 100, improvement: 12, belowBasic: 20, speed: "سريع" },
  { id: 2, name: "فهد العمري", grade: "الثالث", subject: "اللغة العربية", activation: 70, submission: 60, improvement: -5, belowBasic: 35, speed: "بطيء" },
  { id: 3, name: "سعد الغامدي", grade: "الرابع", subject: "الرياضيات", activation: 88, submission: 90, improvement: 8, belowBasic: 15, speed: "عادي" },
  { id: 4, name: "خالد الشهري", grade: "الرابع", subject: "اللغة العربية", activation: 75, submission: 80, improvement: 3, belowBasic: 25, speed: "عادي" },
  { id: 5, name: "تركي الحربي", grade: "الخامس", subject: "العلوم", activation: 60, submission: 50, improvement: 0, belowBasic: 40, speed: "بطيء" },
  { id: 6, name: "راشد المطيري", grade: "السادس", subject: "الرياضيات", activation: 65, submission: 70, improvement: -2, belowBasic: 30, speed: "بطيء" },
];

export const students = [
  { id: 1, name: "أحمد محمد السلمي", score: 8, total: 10 },
  { id: 2, name: "عبدالرحمن خالد", score: 4, total: 10 },
  { id: 3, name: "سلطان فهد العنزي", score: 10, total: 10 },
  { id: 4, name: "ماجد عبدالله", score: 6, total: 10 },
  { id: 5, name: "نواف سعد الدوسري", score: 7, total: 10 },
  { id: 6, name: "فيصل محمد الزهراني", score: 5, total: 10 },
  { id: 7, name: "عمر خالد الرشيدي", score: 9, total: 10 },
  { id: 8, name: "يوسف أحمد الشمري", score: 3, total: 10 },
  { id: 9, name: "بندر عبدالعزيز", score: 7, total: 10 },
  { id: 10, name: "تركي ناصر القرني", score: 6, total: 10 },
];

export const assessments = [
  { id: 1, skill: "الكسور", grade: "الثالث", teacher: "عبدالله السالم", status: "completed" },
  { id: 2, skill: "الفهم القرائي", grade: "الثالث", teacher: "فهد العمري", status: "overdue", overdueDays: 3 },
  { id: 3, skill: "الضرب والقسمة", grade: "الرابع", teacher: "سعد الغامدي", status: "completed" },
  { id: 4, skill: "الأعداد الكسرية", grade: "الخامس", teacher: "تركي الحربي", status: "not_started" },
  { id: 5, skill: "المعادلات", grade: "السادس", teacher: "راشد المطيري", status: "overdue", overdueDays: 1 },
];

export const nafisSkills = {
  الرياضيات: [
    { name: "الكسور", score: 72 },
    { name: "الضرب والقسمة", score: 85 },
    { name: "الأعداد الكسرية", score: 45 },
    { name: "المعادلات", score: 68 },
    { name: "الهندسة", score: 78 },
  ],
  "اللغة العربية": [
    { name: "الفهم القرائي", score: 55 },
    { name: "القواعد النحوية", score: 70 },
    { name: "الإملاء", score: 82 },
    { name: "التعبير الكتابي", score: 60 },
  ],
  العلوم: [
    { name: "الأحياء", score: 48 },
    { name: "الفيزياء", score: 65 },
    { name: "الكيمياء", score: 73 },
  ],
};

export const DEMO_SUB_SKILLS: Record<string, string> = {
  q1: "قراءة الكسر وتحديد البسط والمقام",
  q2: "الكسور المتكافئة",
  q3: "مقارنة الكسور وترتيبها",
  q4: "جمع كسور بنفس المقام",
  q5: "جمع كسور بمقامات مختلفة",
  q6: "طرح الكسور",
  q7: "الكسر كجزء من كمية كاملة",
  q8: "حل مسألة حياتية بخطوة",
  q9: "حل مسألة حياتية بخطوتين",
  q10: "التقدير والتحقق من المنطقية",
};

export const monthlyData = [
  { month: "يناير", متقدم: 15, متمكن: 35, أساسي: 30, "دون الأساسي": 20 },
  { month: "فبراير", متقدم: 18, متمكن: 38, أساسي: 28, "دون الأساسي": 16 },
  { month: "مارس", متقدم: 20, متمكن: 40, أساسي: 25, "دون الأساسي": 15 },
  { month: "أبريل", متقدم: 22, متمكن: 42, أساسي: 24, "دون الأساسي": 12 },
  { month: "مايو", متقدم: 25, متمكن: 45, أساسي: 20, "دون الأساسي": 10 },
];
