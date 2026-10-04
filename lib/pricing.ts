// Prices shown on the public site — change them here only.

/** Shown at the bottom of the teacher and school plans only. */
export const FREE_TRIAL_NOTE = "جرّب الباقة لمدة شهر مجانًا بدون بطاقة ائتمانية";

export const TEACHER_PRICING = {
  yearly: 149,
  term: 79,
};

export const SCHOOL_PRICING = {
  yearly: 889,
  monthly: 139,
};

/** Yearly saving vs paying monthly for 12 months, rounded down. */
export const SCHOOL_YEARLY_SAVING_PCT = Math.floor(
  (1 - SCHOOL_PRICING.yearly / (SCHOOL_PRICING.monthly * 12)) * 100
);

/** Saudi schools run two terms a year (from 1447/2025). */
export const TERMS_PER_YEAR = 2;

/** Teacher yearly saving vs paying per term for a full year, rounded down. */
export const TEACHER_YEARLY_SAVING_PCT = Math.floor(
  (1 - TEACHER_PRICING.yearly / (TEACHER_PRICING.term * TERMS_PER_YEAR)) * 100
);

export type PricingPlan = {
  name: string;
  price: string;
  period: string;
  alt?: string;
  /** Small pill next to `alt`, e.g. "وفّر 46%". */
  saving?: string;
  desc: string;
  features: string[];
  href: string;
  cta: string;
  highlighted?: boolean;
  freeTrial?: boolean;
  badge?: string;
};

export const PRICING_PLANS: PricingPlan[] = [
  {
    name: "المعلم",
    // Lead with the smaller payment; the yearly option sits underneath.
    price: String(TEACHER_PRICING.term),
    period: "ريال / الفصل الدراسي",
    alt: `أو ${TEACHER_PRICING.yearly} ريالًا للسنة كاملة`,
    saving: TEACHER_YEARLY_SAVING_PCT > 0 ? `وفّر ${TEACHER_YEARLY_SAVING_PCT}%` : undefined,
    desc: "للمعلم الذي يريد الاشتراك بنفسه، مع ملف شواهد جاهز لتقييمه السنوي.",
    features: ["الاختبارات الأسبوعية لمادتك وصفك", "حتى 4 فصول", "ملف شواهد قابل للطباعة"],
    href: "/teachers",
    cta: "تفاصيل باقة المعلم",
    freeTrial: true,
  },
  {
    name: "المدرسة",
    price: String(SCHOOL_PRICING.monthly),
    period: "ريال / شهريًا",
    alt: `أو ${SCHOOL_PRICING.yearly} ريالًا للسنة كاملة`,
    saving: `وفّر ${SCHOOL_YEARLY_SAVING_PCT}%`,
    desc: "تشغيل أسبوعي كامل لكل معلمي المدرسة، مع لوحة القائد وتقارير نواتج التعلم.",
    features: [
      "جميع معلمي المدرسة",
      "لوحة قائد المدرسة",
      "تقارير نواتج التعلم والاستعداد لنافس",
      "ملف شواهد لكل معلم",
      "دعم في الإعداد",
    ],
    href: "/signup?type=school",
    cta: "ابدأ شهرك المجاني",
    freeTrial: true,
    highlighted: true,
    badge: "موصى بها",
  },
  {
    name: "المجموعات",
    price: "عرض خاص",
    period: "حسب عدد المدارس",
    desc: "للمجموعات المدرسية والشركات التعليمية التي تدير أكثر من مدرسة.",
    features: ["تسعير حسب عدد المدارس", "تفعيل وتدريب لكل مدرسة", "متابعة مخصصة"],
    href: "/#trial",
    cta: "تواصل معنا",
  },
];
