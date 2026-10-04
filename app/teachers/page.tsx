import type { Metadata } from "next";
import Link from "next/link";
import {
  BarChart3,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  FolderCheck,
  Gift,
  LineChart,
  Printer,
  School,
  Target,
} from "lucide-react";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { BRAND } from "@/lib/brand";
import { publicMetadata } from "@/lib/seo";
import { FREE_TRIAL_NOTE, TEACHER_PRICING } from "@/lib/pricing";
import { TeacherInterestForm } from "./_components/interest-form";

export const metadata: Metadata = publicMetadata({
  path: "/teachers",
  title: `باقة المعلم — شواهدك جاهزة طوال العام | ${BRAND.nameAr}`,
  description:
    "اشترك بنفسك: اختبارات أسبوعية محاكية لنافس لفصولك، تصحيح بالجوال، وملف شواهد يتجدد بعد كل اختبار، جاهز لتقييم الأداء الوظيفي.",
});

// What every applied test turns into inside the teacher's evidence file.
const evidenceItems = [
  { icon: ClipboardCheck, text: "الاختبار المطبّق: المادة والصف والفصل والتاريخ" },
  { icon: BarChart3, text: "نتائج الفصل ومستوى كل طالب" },
  { icon: Target, text: "المهارات غير المتقنة والخطأ الأكثر تكرارًا" },
  { icon: LineChart, text: "نتائج الفصل عبر الأسابيع، وتطور المهارة عند إعادة قياسها" },
];

// Evaluation areas the evidence speaks to. Wording should match the current
// teacher performance-evaluation form — review before publishing.
const evaluationAreas = [
  {
    title: "تنوع أساليب التقويم",
    desc: "اختبار قصير كل أسبوع مرتبط بالمهارات، موثّق بتاريخه ونتائجه.",
  },
  {
    title: "تحليل نتائج المتعلمين وتشخيص مستوياتهم",
    desc: "تقرير لكل فصل يحدد مستوى كل طالب والمهارات التي تحتاج معالجة.",
  },
  {
    title: "تحسين نتائج المتعلمين",
    desc: "نتائج فصلك أسبوعًا بعد أسبوع، وتطور كل مهارة عند إعادة قياسها، دليلًا على أثر عملك.",
  },
];

const steps = [
  { icon: Printer, title: "اطبع اختبار الأسبوع", desc: "حزمة جاهزة لمادتك وصفك، تُطبَّق في جزء من الحصة." },
  { icon: Camera, title: "صوّر أوراق الفصل", desc: "التصحيح تلقائي بمفتاح الإجابة المعتمد، وتراجع النتائج قبل الحفظ." },
  { icon: FileCheck2, title: "شاهدك جاهز", desc: "يُضاف الاختبار ونتائجه وتحليله إلى ملف شواهدك تلقائيًا." },
];

const plans = [
  { name: "فصلي", price: String(TEACHER_PRICING.term), period: "ريال / الفصل الدراسي", note: "مناسب للبداية" },
  { name: "سنوي", price: String(TEACHER_PRICING.yearly), period: "ريال / السنة الدراسية", note: "شواهد عام دراسي كامل", highlighted: true },
];

const included = [
  "الاختبارات الأسبوعية المحاكية لنافس لمادتك وصفك",
  "حتى 4 فصول",
  "التصحيح بكاميرا الجوال",
  "تشخيص المهارات لكل طالب وفصل",
  "ملف شواهد قابل للطباعة يتجدد بعد كل اختبار",
];

const faqs = [
  {
    q: "هل أحتاج موافقة مدرستي للاشتراك؟",
    a: "الاشتراك باسمك أنت. وبما أنك تُدخل بيانات طلابك، فأنت ملتزم بأنظمة مدرستك في التعامل معها.",
  },
  {
    q: "ما المواد والصفوف المتاحة؟",
    a: "الرياضيات ولغتي والعلوم، للصفوف من الثالث إلى السادس الابتدائي.",
  },
  {
    q: "ماذا لو اشتركت مدرستي لاحقًا؟",
    a: "يُحتسب المتبقي من اشتراكك لصالح اشتراك المدرسة، وتنتقل نتائجك وشواهدك معك.",
  },
  {
    q: "متى أبدأ؟",
    a: "نفعّل الحسابات الأولى بالترتيب. سجّل اهتمامك وسنتواصل معك لبدء الاستخدام.",
  },
];

export default function TeachersPage() {
  return (
    <main className="min-h-screen bg-white text-brand-navy" dir="rtl">
      <SiteHeader />

      {/* Hero */}
      <section className="relative overflow-hidden px-5 py-20 md:py-28 lg:px-10">
        <div className="absolute left-16 top-24 h-96 w-96 rounded-full bg-teal-50/80 blur-3xl" />
        <div className="absolute right-1/3 top-48 h-80 w-80 rounded-full bg-cyan-50/70 blur-3xl" />

        <div className="relative mx-auto grid max-w-7xl items-center gap-16 md:grid-cols-[1.05fr_0.95fr] lg:gap-20">
          <div className="text-center md:text-right">
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-teal-100 bg-teal-50/80 px-4 py-2 text-xs font-extrabold text-brand">
              <FolderCheck className="h-4 w-4" />
              باقة المعلم | الإطلاق قريبًا
            </div>
            <h1 className="text-5xl/[1.4] font-black tracking-normal text-brand-navy md:text-6xl/[1.4]">
              شواهدك جاهزة طوال العام
            </h1>
            <p className="mx-auto mt-8 max-w-xl text-lg leading-10 text-slate-500 md:mx-0">
              اشترك بنفسك دون انتظار مدرستك: اختبار أسبوعي محاكٍ لنافس لفصولك، وتصحيح بكاميرا الجوال، وملف شواهد يتجدد تلقائيًا بعد كل اختبار، جاهز للطباعة عند تقييم الأداء الوظيفي.
            </p>
            <div className="mt-10 flex flex-wrap justify-center gap-4 md:justify-start">
              <a href="#interest" className="rounded-xl bg-brand px-8 py-4 text-base font-extrabold text-white shadow-[0_10px_24px_rgba(21,159,145,0.14)] transition hover:bg-brand-dark">
                سجّل اهتمامك
              </a>
              <a href="#evidence" className="rounded-xl border border-brand/30 bg-white/70 px-8 py-4 text-base font-extrabold text-brand-navy transition hover:border-brand hover:text-brand">
                ماذا يحتوي ملف الشواهد؟
              </a>
            </div>
          </div>

          {/* Evidence file preview */}
          <div className="mx-auto w-full max-w-md rounded-[2rem] border border-slate-100 bg-white/95 p-4 shadow-[0_22px_70px_rgba(15,35,55,0.07)]">
            <div className="rounded-[1.5rem] border border-slate-100 bg-slate-50/60 p-5">
              <div className="mb-5 flex items-center justify-between">
                <div className="text-sm font-black text-brand-navy">ملف شواهدي</div>
                <div className="rounded-full bg-teal-50 px-3 py-1 text-xs font-extrabold text-brand">يتحدّث تلقائيًا</div>
              </div>
              <div className="space-y-3">
                {[
                  ["الأسبوع 3", "الرياضيات — 6/أ", "متوسط 72%"],
                  ["الأسبوع 2", "الرياضيات — 6/أ", "متوسط 65%"],
                  ["الأسبوع 1", "الرياضيات — 6/أ", "متوسط 58%"],
                ].map(([week, cls, avg]) => (
                  <div key={week} className="flex items-center justify-between rounded-xl border border-slate-100 bg-white px-4 py-3">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="h-5 w-5 text-brand" />
                      <div>
                        <div className="text-sm font-extrabold text-brand-navy">{week}</div>
                        <div className="text-xs font-bold text-slate-400">{cls}</div>
                      </div>
                    </div>
                    <div className="text-xs font-extrabold text-brand">{avg}</div>
                  </div>
                ))}
              </div>
              <div className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-brand py-3 text-sm font-extrabold text-white">
                <Printer className="h-4 w-4" />
                طباعة الشواهد
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* What each evidence contains */}
      <section id="evidence" className="border-y border-slate-100 bg-slate-50/40 px-5 py-24 lg:px-10">
        <div className="mx-auto max-w-6xl">
          <div className="text-center">
            <div className="text-sm font-extrabold text-brand">ملف الشواهد</div>
            <h2 className="mt-3 text-3xl/[1.45] font-black tracking-normal text-brand-navy md:text-4xl/[1.45]">
              كل اختبار تطبّقه يتحول إلى شاهد موثّق
            </h2>
            <p className="mx-auto mt-4 max-w-2xl leading-8 text-slate-500">
              لا تجميع في آخر العام، ولا تصوير أوراق، ولا ملفات متفرقة. كل شاهد يحتوي على:
            </p>
          </div>

          <div className="mx-auto mt-12 grid max-w-4xl gap-4 sm:grid-cols-2">
            {evidenceItems.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.text} className="flex items-center gap-4 rounded-[1.25rem] border border-slate-100 bg-white p-5">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-teal-50 text-brand">
                    <Icon className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-extrabold leading-7 text-brand-navy">{item.text}</p>
                </div>
              );
            })}
          </div>

          <div className="mt-20 text-center">
            <h2 className="text-3xl/[1.45] font-black tracking-normal text-brand-navy md:text-4xl/[1.45]">
              شواهد تخدم بنود تقييمك السنوي
            </h2>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {evaluationAreas.map((area) => (
              <article key={area.title} className="rounded-[1.75rem] border border-slate-100 bg-white p-7 text-center shadow-[0_10px_34px_rgba(15,35,55,0.035)]">
                <h3 className="text-lg/[1.6] font-extrabold text-brand-navy">{area.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-500">{area.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="px-5 py-24 lg:px-10">
        <div className="mx-auto max-w-6xl">
          <div className="text-center">
            <div className="text-sm font-extrabold text-brand">كيف تعمل</div>
            <h2 className="mt-3 text-3xl/[1.45] font-black tracking-normal text-brand-navy md:text-4xl/[1.45]">
              ثلاث خطوات كل أسبوع
            </h2>
          </div>
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <article key={step.title} className="relative rounded-[1.75rem] border border-slate-100 bg-white p-8 text-center shadow-[0_10px_34px_rgba(15,35,55,0.03)]">
                  <div className="absolute left-6 top-6 text-4xl font-black text-teal-50">{index + 1}</div>
                  <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-brand">
                    <Icon className="h-7 w-7" />
                  </div>
                  <h3 className="text-xl font-extrabold text-brand-navy">{step.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-slate-500">{step.desc}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="px-5 pb-24 lg:px-10">
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <div className="text-sm font-extrabold text-brand">السعر</div>
            <h2 className="mt-3 text-3xl/[1.45] font-black tracking-normal text-brand-navy md:text-4xl/[1.45]">
              سعر واضح، وشهر أول مجاني
            </h2>
          </div>

          <div className="mt-6 flex justify-center">
            <div className="inline-flex flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-2xl border border-brand/20 bg-teal-50/70 px-6 py-4">
              <Gift className="h-5 w-5 text-brand" />
              <span className="text-lg font-black text-brand-navy">{FREE_TRIAL_NOTE}</span>
            </div>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-[1fr_1fr_1.1fr]">
            {plans.map((plan) => (
              <article
                key={plan.name}
                className={`rounded-[1.75rem] border p-7 text-center ${
                  plan.highlighted ? "border-brand/25 bg-teal-50/50" : "border-slate-100 bg-white"
                }`}
              >
                <h3 className="text-xl font-black text-brand-navy">{plan.name}</h3>
                <div className="mt-4 text-5xl font-black text-brand">{plan.price}</div>
                <div className="mt-2 text-sm font-bold text-slate-400">{plan.period}</div>
                <p className="mt-4 text-sm font-bold text-slate-500">{plan.note}</p>
              </article>
            ))}

            <article className="rounded-[1.75rem] border border-slate-100 bg-white p-7">
              <h3 className="text-lg font-black text-brand-navy">يشمل الاشتراك</h3>
              <div className="mt-5 space-y-3">
                {included.map((item) => (
                  <div key={item} className="flex items-start gap-3 text-sm font-bold leading-6 text-slate-500">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                    {item}
                  </div>
                ))}
              </div>
            </article>
          </div>

          <div className="mt-8 flex flex-col items-center justify-between gap-4 rounded-[1.5rem] border border-slate-100 bg-slate-50/60 p-6 text-center md:flex-row md:text-right">
            <div className="flex items-center gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-brand">
                <School className="h-5 w-5" />
              </div>
              <p className="text-sm font-bold leading-7 text-slate-500">
                تحتاج لوحة لقائد المدرسة وتقارير نواتج التعلم للمدرسة كاملة؟ اقترح على مدرستك <span className="font-black text-brand-navy">باقة المدرسة</span>، ويُحتسب المتبقي من اشتراكك.
              </p>
            </div>
            <Link href="/#pricing" className="shrink-0 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-extrabold text-brand-navy transition hover:border-brand/40 hover:text-brand">
              باقات المدارس
            </Link>
          </div>
        </div>
      </section>

      {/* Interest form */}
      <section id="interest" className="px-5 pb-24 lg:px-10">
        <div className="mx-auto grid max-w-6xl gap-10 rounded-[2rem] border border-slate-100 bg-slate-50/80 p-6 shadow-[0_14px_44px_rgba(15,35,55,0.035)] md:p-10 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="flex flex-col justify-center text-center lg:text-right">
            <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-brand lg:mx-0">
              <FolderCheck className="h-6 w-6" />
            </div>
            <h2 className="text-3xl/[1.45] font-black tracking-normal text-brand-navy">سجّل اهتمامك</h2>
            <p className="mt-4 leading-8 text-slate-500">
              جرّب الباقة شهرًا مجانًا بدون بطاقة ائتمانية. نفعّل الحسابات بالترتيب، فاترك بياناتك ومادتك وصفك وسنتواصل معك.
            </p>
          </div>
          <TeacherInterestForm />
        </div>
      </section>

      {/* FAQ */}
      <section className="px-5 pb-24 lg:px-10">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-3xl/[1.45] font-black tracking-normal text-brand-navy">أسئلة شائعة</h2>
          <div className="mt-10 space-y-4">
            {faqs.map((item) => (
              <details key={item.q} className="group rounded-[1.25rem] border border-slate-100 bg-white p-6">
                <summary className="cursor-pointer list-none text-base font-extrabold text-brand-navy">
                  {item.q}
                </summary>
                <p className="mt-3 text-sm leading-7 text-slate-500">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
