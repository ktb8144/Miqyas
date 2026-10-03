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

export type PricingPlan = {
  name: string;
  price: string;
  period: string;
  alt?: string;
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
    price: String(TEACHER_PRICING.yearly),
    period: "ريال / سنة",
    alt: `أو ${TEACHER_PRICING.term} ريالًا للفصل الدراسي`,
    desc: "للمعلم الذي يريد الاشتراك بنفسه، مع ملف شواهد جاهز لتقييمه السنوي.",
    features: ["الاختبارات الأسبوعية لمادتك وصفك", "حتى 4 فصول", "ملف شواهد قابل للطباعة"],
    href: "/teachers",
    cta: "تفاصيل باقة المعلم",
    freeTrial: true,
  },
  {
    name: "المدرسة",
    price: String(SCHOOL_PRICING.yearly),
    period: "ريال / سنة",
    alt: `أو ${SCHOOL_PRICING.monthly} ريالًا شهريًا`,
    desc: "تشغيل أسبوعي كامل لكل معلمي المدرسة، مع لوحة القائد وتقارير نواتج التعلم.",
    features: [
      "جميع معلمي المدرسة",
      "لوحة قائد المدرسة",
      "تقارير نواتج التعلم والاستعداد لنافس",
      "ملف شواهد لكل معلم",
      "دعم في الإعداد",
    ],
    href: "/#trial",
    cta: "ابدأ شهرك المجاني",
    freeTrial: true,
    highlighted: true,
    badge: `وفّر ${SCHOOL_YEARLY_SAVING_PCT}% سنويًا`,
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
