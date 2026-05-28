"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import {
  BarChart3,
  Bot,
  CheckCircle2,
  ClipboardList,
  Download,
  Gauge,
  GraduationCap,
  LayoutDashboard,
  Lock,
  MessageCircle,
  Printer,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UsersRound,
} from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";

const initialTrialForm = {
  name: "",
  school_name: "",
  phone: "",
  email: "",
  message: "",
};

const navLinks = [
  { label: "الرئيسية", href: "#home" },
  { label: "المميزات", href: "#features" },
  { label: "الأسعار", href: "#pricing" },
  { label: "عن مقياس", href: "#about" },
  { label: "تواصل معنا", href: "#trial" },
];

const trustPoints = [
  {
    icon: Gauge,
    title: "قياس دقيق",
    desc: "مؤشرات واضحة لمستوى كل طالب.",
  },
  {
    icon: BarChart3,
    title: "تحليلات ذكية",
    desc: "قراءة سريعة للنتائج والمهارات.",
  },
  {
    icon: TrendingUp,
    title: "تحسين مستمر",
    desc: "متابعة أسبوعية تقود للتطور.",
  },
];

const features = [
  {
    icon: ClipboardList,
    title: "اختبارات أسبوعية ذكية",
    desc: "بناء اختبارات قصيرة ومنظمة تقيس المهارات الأساسية دون تعقيد.",
  },
  {
    icon: BarChart3,
    title: "تحليل نتائج",
    desc: "تقارير فورية تكشف نقاط القوة والضعف على مستوى الطالب والصف.",
  },
  {
    icon: LayoutDashboard,
    title: "لوحة تحكم متكاملة",
    desc: "نظرة واحدة لأداء المدرسة والمعلمين والطلاب عبر مؤشرات واضحة.",
  },
  {
    icon: UsersRound,
    title: "إدارة الطلاب والمعلمين",
    desc: "تنظيم المدارس والفصول والمستخدمين وربطهم بالمهام التعليمية.",
  },
  {
    icon: Bot,
    title: "الذكاء الاصطناعي",
    desc: "مساعدة في توليد الأسئلة والتقارير والخطط العلاجية بناء على البيانات.",
  },
  {
    icon: Printer,
    title: "تصدير وطباعة",
    desc: "طباعة الأوراق والتقارير وتصدير النتائج بصيغ مناسبة للعمل اليومي.",
  },
];

const trustItems = [
  {
    icon: GraduationCap,
    title: "متوافق مع المناهج",
    desc: "مصمم ليتماشى مع المهارات التعليمية.",
  },
  {
    icon: ShieldCheck,
    title: "أمان وخصوصية",
    desc: "حماية بيانات المدرسة والطلاب أولًا.",
  },
  {
    icon: MessageCircle,
    title: "دعم فني مميز",
    desc: "فريق يساعدك في الإعداد والاستخدام.",
  },
];

const pricingPlans = [
  {
    name: "البداية",
    price: "مجانًا",
    desc: "لتجربة مقياس مع مدرسة واحدة وفريق محدود.",
    features: ["مدرسة واحدة", "حتى 5 معلمين", "تقارير أساسية"],
  },
  {
    name: "المدرسة",
    price: "حسب الاحتياج",
    desc: "للمدارس التي تحتاج تشغيلًا أسبوعيًا كاملًا.",
    features: ["معلمون غير محدودين", "تقارير تفصيلية", "دعم في الإعداد"],
    highlighted: true,
  },
  {
    name: "المجموعة",
    price: "تعاقد سنوي",
    desc: "لإدارات التعليم أو المجموعات المدرسية.",
    features: ["عدة مدارس", "لوحات مقارنة", "تقارير تنفيذية"],
  },
];

function DashboardMockup() {
  const bars = [44, 62, 56, 72, 66, 84];
  const rows = [
    ["الصف الرابع", "86%", "متقن"],
    ["الصف الخامس", "74%", "يتحسن"],
  ];

  return (
    <div className="relative mx-auto w-full max-w-[540px] rounded-[2rem] border border-slate-100 bg-white/95 p-4 shadow-[0_22px_70px_rgba(15,35,55,0.07)]">
      <div className="rounded-[1.5rem] border border-slate-100 bg-slate-50/60 p-4">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-[#20b7a8]" />
            <span className="h-2.5 w-2.5 rounded-full bg-slate-200" />
            <span className="h-2.5 w-2.5 rounded-full bg-slate-200" />
          </div>
          <div className="text-xs font-bold text-slate-400">لوحة مقياس</div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {[
            ["1,246", "طالب"],
            ["84%", "متوسط الأداء"],
            ["24", "مهارة نشطة"],
          ].map(([value, label]) => (
            <div key={label} className="rounded-[1.25rem] border border-slate-100 bg-white p-4">
              <div className="text-xl font-extrabold text-[#0b2447]">{value}</div>
              <div className="mt-1 text-xs font-semibold text-slate-400">{label}</div>
            </div>
          ))}
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_0.8fr]">
          <div className="rounded-[1.25rem] border border-slate-100 bg-white p-4">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-sm font-extrabold text-[#0b2447]">تطور الأداء</span>
              <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-bold text-[#159f91]">+18%</span>
            </div>
            <div className="flex h-32 items-end gap-3">
              {bars.map((bar, index) => (
                <div key={index} className="flex flex-1 flex-col items-center gap-2">
                  <div
                    className="w-full rounded-t-xl bg-gradient-to-t from-[#159f91] to-[#b9efe8]"
                    style={{ height: `${bar}%` }}
                  />
                  <span className="h-1 w-1 rounded-full bg-slate-300" />
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[1.25rem] border border-slate-100 bg-white p-4">
            <div className="mb-4 text-sm font-extrabold text-[#0b2447]">جاهزية الأسبوع</div>
            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border-[10px] border-teal-50 border-t-[#159f91] text-xl font-extrabold text-[#0b2447]">
              86%
            </div>
            <div className="mt-4 rounded-xl bg-slate-50 px-3 py-2 text-center text-xs font-bold text-slate-400">
              جاهز للتقرير
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-[1.25rem] border border-slate-100 bg-white p-4">
          <div className="mb-3 text-sm font-extrabold text-[#0b2447]">ملخص الصفوف</div>
          <div className="space-y-2">
            {rows.map(([grade, score, status]) => (
              <div key={grade} className="grid grid-cols-3 rounded-xl bg-slate-50/80 px-3 py-2 text-xs font-bold text-slate-500">
                <span>{grade}</span>
                <span className="text-center text-[#0b2447]">{score}</span>
                <span className="text-left text-[#159f91]">{status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const [trialForm, setTrialForm] = useState(initialTrialForm);
  const [trialState, setTrialState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [trialMessage, setTrialMessage] = useState("");

  function updateTrialField(field: keyof typeof initialTrialForm, value: string) {
    setTrialForm((current) => ({ ...current, [field]: value }));
  }

  async function handleTrialSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTrialState("loading");
    setTrialMessage("");

    try {
      const res = await fetch("/api/trial-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(trialForm),
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        console.error("trial request API failed", json);
        const details = [json.error, json.code, json.details, json.hint].filter(Boolean).join(" - ");
        throw new Error(details || "تعذر إرسال الطلب");
      }

      setTrialForm(initialTrialForm);
      setTrialState("success");
      setTrialMessage("تم إرسال طلبك بنجاح، سيتواصل معك فريق مقياس قريبًا");
    } catch (error) {
      const message = error instanceof Error ? error.message : "تعذر إرسال الطلب";
      console.error("trial request submit failed", error);
      setTrialState("error");
      setTrialMessage(message);
    }
  }

  return (
    <main id="home" className="min-h-screen bg-white text-[#0b2447]" dir="rtl">
      <nav className="sticky top-0 z-50 border-b border-slate-100 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 lg:px-10">
          <BrandLogo contextTitle="مقياس" size="sm" />

          <div className="hidden items-center gap-5 md:flex lg:gap-8">
            {navLinks.map((link) => (
              <a key={link.href} href={link.href} className="text-xs font-bold text-slate-500 transition hover:text-[#0b2447] lg:text-sm">
                {link.label}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="inline-flex rounded-xl border border-slate-200 px-4 py-3 text-sm font-extrabold text-[#0b2447] transition hover:border-[#159f91] hover:text-[#159f91] sm:px-5"
            >
              تسجيل دخول
            </Link>
            <a
              href="#trial"
              className="rounded-xl bg-[#159f91] px-5 py-3 text-sm font-extrabold text-white shadow-[0_8px_20px_rgba(21,159,145,0.12)] transition hover:bg-[#10877b]"
            >
              اطلب تجربة
            </a>
          </div>
        </div>
      </nav>

      <section className="relative overflow-hidden px-5 py-20 md:py-28 lg:px-10 lg:py-32">
        <div className="absolute left-16 top-28 h-96 w-96 rounded-full bg-teal-50/80 blur-3xl" />
        <div className="absolute right-1/3 top-48 h-80 w-80 rounded-full bg-cyan-50/70 blur-3xl" />

        <div className="relative mx-auto grid max-w-7xl items-center gap-16 md:grid-cols-[0.95fr_1.05fr] lg:gap-20">
          <div className="text-center md:text-right">
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-teal-100 bg-teal-50/80 px-4 py-2 text-xs font-extrabold text-[#159f91]">
              <Sparkles className="h-4 w-4" />
              بيانات أوضح، قرار أسرع
            </div>
            <h1 className="text-5xl font-black leading-[1.12] tracking-normal text-[#0b2447] md:text-6xl lg:text-7xl">
              نقيس لنرتقي
            </h1>
            <p className="mx-auto mt-8 max-w-xl text-lg leading-10 text-slate-500 md:mx-0">
              مقياس منصة ذكية لقياس أداء الطلاب وتحليل نتائجهم بدقة، تساعد المدارس على اتخاذ قرارات تعليمية مبنية على البيانات.
            </p>
            <div className="mt-10 flex flex-wrap justify-center gap-4 md:justify-start">
              <a href="#trial" className="rounded-xl bg-[#159f91] px-8 py-4 text-base font-extrabold text-white shadow-[0_10px_24px_rgba(21,159,145,0.14)] transition hover:bg-[#10877b]">
                اطلب تجربة مجانية
              </a>
              <a href="#features" className="rounded-xl border border-[#159f91]/30 bg-white/70 px-8 py-4 text-base font-extrabold text-[#0b2447] transition hover:border-[#159f91] hover:text-[#159f91]">
                اعرف المزيد
              </a>
            </div>
          </div>

          <DashboardMockup />
        </div>
      </section>

      <section className="px-5 pb-24 lg:px-10">
        <div className="mx-auto grid max-w-4xl gap-10 md:grid-cols-3">
          {trustPoints.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="text-center">
                <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-50 text-[#159f91]">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="font-extrabold text-[#0b2447]">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">{item.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section id="features" className="border-y border-slate-100 bg-slate-50/30 px-5 py-28 lg:px-10">
        <div className="mx-auto max-w-6xl">
          <div className="text-center">
            <div className="text-sm font-extrabold text-[#159f91]">المميزات</div>
            <h2 className="mt-3 text-3xl font-black tracking-normal text-[#0b2447] md:text-4xl">
              كل ما تحتاجه في منصة واحدة
            </h2>
          </div>

          <div className="mt-16 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <article key={feature.title} className="rounded-[1.75rem] border border-slate-100 bg-white p-8 text-center shadow-[0_10px_34px_rgba(15,35,55,0.035)]">
                  <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-[#159f91]">
                    <Icon className="h-7 w-7" />
                  </div>
                  <h3 className="text-xl font-extrabold text-[#0b2447]">{feature.title}</h3>
                  <p className="mt-4 text-sm leading-8 text-slate-500">{feature.desc}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section id="about" className="bg-gradient-to-l from-teal-50/80 via-white to-cyan-50/70 px-5 py-24 lg:px-10">
        <div className="mx-auto grid max-w-6xl items-center gap-16 lg:grid-cols-2">
          <div className="order-2 lg:order-1">
            <div className="relative mx-auto h-72 max-w-sm">
              <div className="absolute bottom-4 right-8 h-48 w-32 rounded-t-3xl bg-[#159f91]" />
              <div className="absolute bottom-4 right-44 h-36 w-24 rounded-t-3xl bg-[#39c9b9]" />
              <div className="absolute bottom-4 right-72 h-24 w-20 rounded-t-3xl bg-[#8ee5dc]" />
              <div className="absolute bottom-0 right-2 h-5 w-80 rounded-full bg-slate-200/70" />
              <div className="absolute right-4 top-4 rounded-3xl border border-slate-100 bg-white p-6 shadow-[0_16px_50px_rgba(15,35,55,0.055)]">
                {[1, 2, 3, 4].map((item) => (
                  <div key={item} className="mb-4 flex items-center gap-3 last:mb-0">
                    <CheckCircle2 className="h-6 w-6 text-[#159f91]" />
                    <span className="h-3 w-32 rounded-full bg-slate-100" />
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="order-1 text-center lg:order-2 lg:text-right">
            <h2 className="text-3xl font-black leading-tight tracking-normal text-[#0b2447] md:text-5xl">
              من نتيجة الاختبار إلى خطة التحسين
            </h2>
            <p className="mt-6 max-w-xl text-lg leading-9 text-slate-500 lg:mr-0">
              تربط المنصة بين أداء الطلاب، عمل المعلمين، ومؤشرات المدرسة حتى تعرف أين يبدأ التدخل.
            </p>
            <a href="#trial" className="mt-9 inline-flex rounded-xl bg-[#159f91] px-8 py-4 text-base font-extrabold text-white shadow-[0_10px_24px_rgba(21,159,145,0.12)] transition hover:bg-[#10877b]">
              تحدث مع الفريق
            </a>
          </div>
        </div>
      </section>

      <section id="trust" className="px-5 py-24 lg:px-10">
        <div className="mx-auto max-w-6xl text-center">
          <h2 className="text-3xl font-black tracking-normal text-[#0b2447]">يثق بنا</h2>
          <p className="mt-4 text-slate-500">المدارس تختار مقياس لتحسين التعليم وقياس الأثر.</p>

          <div className="mt-16 grid gap-10 md:grid-cols-3">
            {trustItems.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="rounded-3xl bg-white p-6">
                  <div className="mx-auto mb-5 flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-50 text-[#159f91]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-extrabold text-[#0b2447]">{item.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-slate-500">{item.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section id="pricing" className="px-5 pb-24 lg:px-10">
        <div className="mx-auto max-w-6xl">
          <div className="text-center">
            <div className="text-sm font-extrabold text-[#159f91]">الأسعار</div>
            <h2 className="mt-3 text-3xl font-black tracking-normal text-[#0b2447] md:text-4xl">
              باقات مرنة حسب حجم المدرسة
            </h2>
            <p className="mx-auto mt-4 max-w-2xl leading-8 text-slate-500">
              اختر نقطة البداية المناسبة، وسيقترح فريقنا خطة تشغيل تناسب عدد المدارس والمعلمين.
            </p>
          </div>

          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {pricingPlans.map((plan) => (
              <article
                key={plan.name}
                className={`rounded-[1.75rem] border p-7 shadow-[0_10px_34px_rgba(15,35,55,0.03)] ${
                  plan.highlighted
                    ? "border-[#159f91]/25 bg-teal-50/50"
                    : "border-slate-100 bg-white"
                }`}
              >
                <h3 className="text-xl font-black text-[#0b2447]">{plan.name}</h3>
                <p className="mt-3 text-2xl font-black text-[#159f91]">{plan.price}</p>
                <p className="mt-4 min-h-16 text-sm leading-7 text-slate-500">{plan.desc}</p>
                <div className="mt-6 space-y-3">
                  {plan.features.map((feature) => (
                    <div key={feature} className="flex items-center gap-3 text-sm font-bold text-slate-500">
                      <CheckCircle2 className="h-4 w-4 text-[#159f91]" />
                      {feature}
                    </div>
                  ))}
                </div>
                <a
                  href="#trial"
                  className={`mt-8 inline-flex w-full justify-center rounded-xl px-5 py-3 text-sm font-extrabold transition ${
                    plan.highlighted
                      ? "bg-[#159f91] text-white hover:bg-[#10877b]"
                      : "border border-slate-200 bg-white text-[#0b2447] hover:border-[#159f91]/40 hover:text-[#159f91]"
                  }`}
                >
                  اطلب تفاصيل الباقة
                </a>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="trial" className="px-5 pb-24 lg:px-10">
        <div className="mx-auto grid max-w-6xl gap-10 rounded-[2rem] border border-slate-100 bg-slate-50/80 p-6 shadow-[0_14px_44px_rgba(15,35,55,0.035)] md:p-10 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="flex flex-col justify-center text-center lg:text-right">
            <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-[#159f91] lg:mx-0">
              <Lock className="h-6 w-6" />
            </div>
            <h2 className="text-3xl font-black tracking-normal text-[#0b2447]">
              طلب تجربة مجانية
            </h2>
            <p className="mt-4 leading-8 text-slate-500">
              اترك بياناتك وسيتواصل معك فريق مقياس لترتيب تجربة مناسبة لمدرستك.
            </p>
          </div>

          <form onSubmit={handleTrialSubmit} className="grid gap-4 rounded-[1.5rem] border border-slate-100 bg-white p-5 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-extrabold text-slate-500">الاسم</span>
              <input
                required
                type="text"
                value={trialForm.name}
                onChange={(event) => updateTrialField("name", event.target.value)}
                className="w-full rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-[#159f91]/40 focus:bg-white"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-extrabold text-slate-500">اسم المدرسة</span>
              <input
                required
                type="text"
                value={trialForm.school_name}
                onChange={(event) => updateTrialField("school_name", event.target.value)}
                className="w-full rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-[#159f91]/40 focus:bg-white"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-extrabold text-slate-500">رقم الجوال</span>
              <input
                required
                type="tel"
                value={trialForm.phone}
                onChange={(event) => updateTrialField("phone", event.target.value)}
                className="w-full rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-[#159f91]/40 focus:bg-white"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-extrabold text-slate-500">البريد الإلكتروني</span>
              <input
                required
                type="email"
                value={trialForm.email}
                onChange={(event) => updateTrialField("email", event.target.value)}
                className="w-full rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-[#159f91]/40 focus:bg-white"
              />
            </label>
            <label className="block md:col-span-2">
              <span className="mb-2 block text-sm font-extrabold text-slate-500">ملاحظة</span>
              <textarea
                rows={4}
                value={trialForm.message}
                onChange={(event) => updateTrialField("message", event.target.value)}
                className="w-full resize-none rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-[#159f91]/40 focus:bg-white"
              />
            </label>
            {trialMessage && (
              <div className={`rounded-xl border px-4 py-3 text-sm font-bold md:col-span-2 ${
                trialState === "success"
                  ? "border-emerald-100 bg-emerald-50 text-emerald-700"
                  : "border-rose-100 bg-rose-50 text-rose-700"
              }`}>
                {trialMessage}
              </div>
            )}
            <button
              type="submit"
              disabled={trialState === "loading"}
              className="rounded-xl bg-[#159f91] px-6 py-3 text-sm font-extrabold text-white transition hover:bg-[#10877b] disabled:opacity-60 md:col-span-2"
            >
              {trialState === "loading" ? "جارٍ الإرسال..." : "إرسال الطلب"}
            </button>
          </form>
        </div>
      </section>

      <footer className="border-t border-slate-100 px-5 py-14 lg:px-10">
        <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-4">
          <div>
            <BrandLogo contextTitle="مقياس" contextSubtitle="قياس تعليمي ذكي" size="sm" />
          </div>

          <div>
            <h3 className="mb-4 font-extrabold text-[#0b2447]">المنتج</h3>
            <div className="space-y-3 text-sm font-semibold text-slate-500">
              <a href="#features" className="block hover:text-[#159f91]">المميزات</a>
              <a href="#pricing" className="block hover:text-[#159f91]">الأسعار</a>
              <a href="#home" className="block hover:text-[#159f91]">لوحة القياس</a>
            </div>
          </div>

          <div>
            <h3 className="mb-4 font-extrabold text-[#0b2447]">الشركة</h3>
            <div className="space-y-3 text-sm font-semibold text-slate-500">
              <a href="#about" className="block hover:text-[#159f91]">عن مقياس</a>
              <a href="#trial" className="block hover:text-[#159f91]">تواصل معنا</a>
              <span className="block">الشروط والأحكام</span>
            </div>
          </div>

          <div>
            <h3 className="mb-4 font-extrabold text-[#0b2447]">الدعم</h3>
            <div className="space-y-3 text-sm font-semibold text-slate-500">
              <span className="block">مركز المساعدة</span>
              <span className="block">سياسة الخصوصية</span>
              <span className="flex items-center gap-2">
                <Download className="h-4 w-4 text-[#159f91]" />
                ملفات التقارير
              </span>
            </div>
          </div>
        </div>

        <div className="mx-auto mt-10 max-w-6xl border-t border-slate-100 pt-6 text-center text-sm font-semibold text-slate-400">
          © مقياس. جميع الحقوق محفوظة.
        </div>
      </footer>
    </main>
  );
}
