"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { BrandLogo } from "@/components/brand-logo";

const initialTrialForm = {
  name: "",
  school_name: "",
  phone: "",
  email: "",
  message: "",
};

const sections = [
  {
    id: "problem",
    title: "ليست المشكلة في الاختبار. بل فيما نعرفه بعده.",
    text: "الدرجة وحدها لا تكفي. مقياس يكشف المهارة التي تحتاج إلى دعم، والفصل الذي يحتاج إلى متابعة، والطالب الذي يحتاج إلى تدخل مبكر.",
  },
  {
    id: "outcomes",
    title: "من النتيجة. إلى قرار.",
    text: "يحوّل مقياس إجابات الطلاب إلى مؤشرات واضحة: مهارات متقنة، مهارات تحتاج دعمًا، وفصول تحتاج متابعة.",
  },
  {
    id: "nafs",
    title: "نافس يبدأ قبل يوم الاختبار.",
    text: "ابنِ خطة استعداد أسبوعية مبنية على بيانات فعلية، لا على الانطباع.",
  },
  {
    id: "scan",
    title: "صوّر الأوراق. ودع مقياس يقرأ الباقي.",
    text: "تصحيح آلي سريع، مع مراجعة للحالات غير الواضحة لضمان نتائج أكثر موثوقية.",
  },
  {
    id: "reports",
    title: "تقرير جاهز. بلغة المدرسة.",
    text: "تقارير دورية تساعد قائد المدرسة على توثيق الجهود، متابعة التحسن، وبناء خطة رفع نواتج التعلم.",
  },
];

function MockPanel() {
  return (
    <div className="mx-auto w-full max-w-[520px] rounded-[2rem] border border-slate-100 bg-white p-4 shadow-[0_24px_80px_rgba(15,35,55,0.06)]">
      <div className="rounded-[1.5rem] bg-slate-50 p-5">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-slate-400">جاهزية المدرسة</div>
            <div className="mt-1 text-3xl font-black text-[#0b2447]">84%</div>
          </div>
          <div className="rounded-full bg-white px-4 py-2 text-xs font-black text-[#159f91]">خطة هذا الأسبوع</div>
        </div>
        <div className="space-y-3">
          {[
            ["نواتج التعلم", "واضحة"],
            ["مهارات تحتاج دعمًا", "6"],
            ["فصول تحتاج متابعة", "2"],
          ].map(([label, value]) => (
            <div key={label} className="flex items-center justify-between rounded-2xl bg-white px-4 py-4">
              <span className="text-sm font-bold text-slate-500">{label}</span>
              <span className="text-lg font-black text-[#0b2447]">{value}</span>
            </div>
          ))}
        </div>
        <div className="mt-5 h-2 overflow-hidden rounded-full bg-white">
          <div className="h-full w-[72%] rounded-full bg-[#159f91]" />
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
      if (!res.ok || !json.success) throw new Error(json.error || "تعذر إرسال الطلب");
      setTrialForm(initialTrialForm);
      setTrialState("success");
      setTrialMessage("تم إرسال طلبك بنجاح. سيتواصل معك فريق مقياس قريبًا.");
    } catch (error) {
      setTrialState("error");
      setTrialMessage(error instanceof Error ? error.message : "تعذر إرسال الطلب");
    }
  }

  return (
    <main id="home" className="w-full overflow-x-hidden bg-white text-[#0b2447]" dir="rtl">
      <nav className="sticky top-0 z-50 border-b border-slate-100 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-5 py-4 lg:px-8">
          <BrandLogo contextTitle="مقياس" size="sm" />
          <div className="hidden items-center gap-8 md:flex">
            <a href="#outcomes" className="text-sm font-bold text-slate-500 hover:text-[#0b2447]">نواتج التعلم</a>
            <a href="#nafs" className="text-sm font-bold text-slate-500 hover:text-[#0b2447]">نافس</a>
            <a href="#reports" className="text-sm font-bold text-slate-500 hover:text-[#0b2447]">التقارير</a>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link href="/login" className="rounded-full border border-slate-200 px-4 py-2 text-sm font-black text-[#0b2447]">
              دخول
            </Link>
            <a href="#trial" className="rounded-full bg-[#159f91] px-4 py-2 text-sm font-black text-white">
              ابدأ التجربة
            </a>
          </div>
        </div>
      </nav>

      <section className="px-5 py-20 sm:py-28 lg:px-8">
        <div className="mx-auto grid w-full max-w-7xl items-center gap-14 lg:grid-cols-[1fr_0.85fr]">
          <div className="mx-auto max-w-3xl text-center lg:mx-0 lg:text-right">
            <h1 className="text-5xl font-black leading-[1.12] tracking-normal text-[#0b2447] sm:text-6xl lg:text-7xl">
              نواتج تعلم أوضح. واستعداد أذكى لنافس.
            </h1>
            <p className="mx-auto mt-7 max-w-2xl text-lg font-medium leading-9 text-slate-500 lg:mx-0">
              مقياس يساعد المدرسة على تنفيذ اختبارات محاكية، تصحيحها آليًا، وتحويل النتائج إلى خطة تحسين قابلة للتنفيذ.
            </p>
            <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
              <a href="#trial" className="rounded-full bg-[#159f91] px-8 py-4 text-center text-base font-black text-white shadow-[0_12px_30px_rgba(21,159,145,0.14)]">
                ابدأ التجربة
              </a>
              <a href="#problem" className="rounded-full border border-slate-200 px-8 py-4 text-center text-base font-black text-[#0b2447]">
                شاهد كيف يعمل
              </a>
            </div>
          </div>
          <MockPanel />
        </div>
      </section>

      <section className="px-5 py-10 lg:px-8">
        <div className="mx-auto grid w-full max-w-6xl gap-5 md:grid-cols-2">
          {sections.map((item, index) => (
            <article
              id={item.id}
              key={item.id}
              className={`rounded-[2rem] border border-slate-100 bg-slate-50/60 p-8 shadow-[0_14px_44px_rgba(15,35,55,0.03)] ${index === 0 ? "md:col-span-2" : ""}`}
            >
              <div className="mb-8 h-2 w-12 rounded-full bg-[#159f91]" />
              <h2 className="text-3xl font-black leading-tight tracking-normal text-[#0b2447] md:text-4xl">
                {item.title}
              </h2>
              <p className="mt-5 max-w-3xl text-base font-medium leading-8 text-slate-500">
                {item.text}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section id="trial" className="px-5 py-20 lg:px-8">
        <div className="mx-auto grid w-full max-w-6xl gap-10 rounded-[2.25rem] bg-[#f7faf9] p-6 md:p-10 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="flex flex-col justify-center">
            <h2 className="text-4xl font-black leading-tight text-[#0b2447]">
              ابدأ بخطوة صغيرة. وافهم مدرستك بوضوح أكبر.
            </h2>
            <p className="mt-5 text-base font-medium leading-8 text-slate-500">
              اختبار قصير واحد يكفي لاكتشاف فجوة. ومقياس يحوّلها إلى خطة.
            </p>
          </div>

          <form onSubmit={handleTrialSubmit} className="grid w-full gap-4 rounded-[1.75rem] border border-slate-100 bg-white p-5 md:grid-cols-2">
            {[
              ["name", "الاسم", "text"],
              ["school_name", "اسم المدرسة", "text"],
              ["phone", "رقم الجوال", "tel"],
              ["email", "البريد الإلكتروني", "email"],
            ].map(([field, label, type]) => (
              <label key={field} className="block min-w-0">
                <span className="mb-2 block text-sm font-black text-slate-500">{label}</span>
                <input
                  required
                  type={type}
                  value={trialForm[field as keyof typeof initialTrialForm]}
                  onChange={(event) => updateTrialField(field as keyof typeof initialTrialForm, event.target.value)}
                  className="w-full rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-[#159f91]/40 focus:bg-white"
                />
              </label>
            ))}
            <label className="block min-w-0 md:col-span-2">
              <span className="mb-2 block text-sm font-black text-slate-500">ملاحظة</span>
              <textarea
                rows={3}
                value={trialForm.message}
                onChange={(event) => updateTrialField("message", event.target.value)}
                className="w-full resize-none rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-[#159f91]/40 focus:bg-white"
              />
            </label>
            {trialMessage && (
              <div className={`rounded-2xl border px-4 py-3 text-sm font-bold md:col-span-2 ${
                trialState === "success" ? "border-emerald-100 bg-emerald-50 text-emerald-700" : "border-rose-100 bg-rose-50 text-rose-700"
              }`}>
                {trialMessage}
              </div>
            )}
            <button
              type="submit"
              disabled={trialState === "loading"}
              className="rounded-full bg-[#159f91] px-6 py-4 text-sm font-black text-white transition disabled:opacity-60 md:col-span-2"
            >
              {trialState === "loading" ? "جارٍ الإرسال..." : "طلب تجربة"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
