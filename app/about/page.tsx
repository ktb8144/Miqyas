import type { Metadata } from "next";
import Link from "next/link";
import {
  BookOpenCheck,
  BrainCircuit,
  CalendarCheck,
  PenLine,
  School,
  ShieldCheck,
  Target,
  Users,
} from "lucide-react";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = {
  title: `من نحن — ${BRAND.nameAr}`,
  description: `${BRAND.nameAr} بُنيت من داخل الفصل السعودي، بخبرات تجمع التدريس، وبناء أسئلة الاختبارات، والبحث في الذكاء الاصطناعي في التعليم.`,
};

// The expertise behind the product — keep every line factual and verifiable.
const expertise = [
    {
      icon: School,
      title: "خبرة تدريس تتجاوز 12 عامًا",
      desc: "في المدارس السعودية. نعرف الفصل والحصة والشواهد وضغط نهاية الفصل من الداخل.",
    },
    {
      icon: PenLine,
      title: "خبرة تطوير أسئلة الاختبارات",
      desc: "حاصلون على اعتماد مطوّر أسئلة الاختبارات من هيئة تقويم التعليم والتدريب.",
    },
    {
      icon: BrainCircuit,
      title: "خبرة بحثية في الذكاء الاصطناعي في التعليم",
      desc: "على مستوى الدكتوراه في علوم البيانات والذكاء الاصطناعي، بجامعة موناش في أستراليا.",
    },
];

const principles = [
  {
    icon: Target,
    title: "كل سؤال يقيس مهارة",
    desc: "لا نكتب سؤالًا لا نعرف ماذا يقيس. كل سؤال مربوط بمهارة ومجال من نواتج التعلم، وكل خيار خاطئ له سبب نرصده.",
  },
  {
    icon: CalendarCheck,
    title: "كل أسبوع، لا آخر السنة",
    desc: "نتائج نافس تصل المدرسة مرة في السنة، أرقامًا مجمّعة بلا تفصيل لكل طالب أو فصل. نحن نعطيك هذا التفصيل كل أسبوع.",
  },
  {
    icon: Users,
    title: "لا نزيد عبء المعلم",
    desc: "ورقة تُطبع، وجوال يصوّر، وتقرير يخرج. لا إدخال درجات يدوي، ولا خطوات زائدة.",
  },
  {
    icon: ShieldCheck,
    title: "بيانات المدرسة للمدرسة",
    desc: "بيانات كل مدرسة معزولة عن غيرها، ولا يرى المعلم إلا فصوله، ولا يرى القائد إلا مدرسته.",
  },
];

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-white text-brand-navy" dir="rtl">
      <SiteHeader />

      <section className="relative overflow-hidden px-5 py-20 md:py-28 lg:px-10">
        <div className="absolute left-16 top-20 h-96 w-96 rounded-full bg-teal-50/80 blur-3xl" />
        <div className="relative mx-auto max-w-4xl text-center">
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-teal-100 bg-teal-50/80 px-4 py-2 text-xs font-extrabold text-brand">
            <BookOpenCheck className="h-4 w-4" />
            من نحن
          </div>
          <h1 className="text-4xl/[1.45] font-black tracking-normal text-brand-navy md:text-6xl/[1.4]">
            بُنيت من داخل الفصل السعودي
          </h1>
          <p className="mx-auto mt-8 max-w-2xl text-lg leading-10 text-slate-500">
            {BRAND.nameAr} لم تبدأ من شركة تقنية تبحث عن سوق، بل من داخل الفصل. رأينا كل عام نفس المشهد: المدرسة تنتظر نتائج نافس،
            ثم تصلها أرقامًا مجمّعة بعد فوات الأوان. فبنينا أداة تعطي المعلم والقائد هذه الصورة كل أسبوع، وهم ما زالوا قادرين على التغيير.
          </p>
        </div>
      </section>

      <section className="border-y border-slate-100 bg-slate-50/40 px-5 py-24 lg:px-10">
        <div className="mx-auto grid max-w-6xl items-start gap-12 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="text-center lg:text-right">
            <div className="text-sm font-extrabold text-brand">الخبرات التي بنت {BRAND.nameAr}</div>
            <h2 className="mt-3 text-3xl/[1.45] font-black tracking-normal text-brand-navy md:text-4xl/[1.45]">
              الفصل، والاختبار، والبيانات
            </h2>
            <p className="mt-6 max-w-md leading-9 text-slate-500 lg:mr-0">
              ثلاث خبرات نادرًا ما تجتمع في منتج تعليمي واحد: التدريس في الفصل، وبناء أسئلة الاختبارات، والبحث في الذكاء الاصطناعي وعلوم البيانات. من اجتماعها خرجت {BRAND.nameAr}.
            </p>
          </div>

          <div className="grid gap-5">
            {expertise.map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.title} className="rounded-[1.75rem] border border-slate-100 bg-white p-7 shadow-[0_10px_34px_rgba(15,35,55,0.035)]">
                  <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-50 text-brand">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg/[1.6] font-extrabold text-brand-navy">{item.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-slate-500">{item.desc}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="px-5 py-24 lg:px-10">
        <div className="mx-auto max-w-6xl">
          <div className="text-center">
            <div className="text-sm font-extrabold text-brand">ما نؤمن به</div>
            <h2 className="mt-3 text-3xl/[1.45] font-black tracking-normal text-brand-navy md:text-4xl/[1.45]">
              أربعة مبادئ بنينا عليها {BRAND.nameAr}
            </h2>
          </div>

          <div className="mt-14 grid gap-6 md:grid-cols-2">
            {principles.map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.title} className="flex gap-5 rounded-[1.75rem] border border-slate-100 bg-white p-7 shadow-[0_10px_34px_rgba(15,35,55,0.03)]">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-teal-50 text-brand">
                    <Icon className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-lg/[1.6] font-extrabold text-brand-navy">{item.title}</h3>
                    <p className="mt-2 text-sm leading-7 text-slate-500">{item.desc}</p>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="px-5 pb-24 lg:px-10">
        <div className="mx-auto max-w-4xl rounded-[2rem] bg-gradient-to-l from-teal-50/80 via-white to-cyan-50/70 p-10 text-center md:p-14">
          <h2 className="text-3xl/[1.45] font-black tracking-normal text-brand-navy">جرّب {BRAND.nameAr} في مدرستك</h2>
          <p className="mx-auto mt-4 max-w-xl leading-8 text-slate-500">
            نبدأ بتحليل نتائج مدرستك في نافس، ثم نطبّق أول اختبار أسبوعي معك.
          </p>
          <Link href="/#trial" className="mt-8 inline-flex rounded-xl bg-brand px-8 py-4 text-base font-extrabold text-white shadow-[0_10px_24px_rgba(21,159,145,0.14)] transition hover:bg-brand-dark">
            اطلب تجربة مجانية لمدرستك
          </Link>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
