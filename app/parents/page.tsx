import type { Metadata } from "next";
import Link from "next/link";
import {
  BookOpen,
  ClipboardCheck,
  HeartHandshake,
  MessageCircle,
  QrCode,
  ShieldCheck,
  Sparkles,
  Target,
  Timer,
  Users,
} from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { SiteFooter } from "@/components/site/site-footer";
import { BRAND } from "@/lib/brand";
import { ETEC_LEVELS, type LevelName } from "@/lib/levels";
import { publicMetadata, SITE_URL } from "@/lib/seo";

export const metadata: Metadata = publicMetadata({
  path: "/parents",
  title: `${BRAND.nameAr} لأولياء الأمور`,
  description: `ما الورقة التي وصلت مع طفلك من المدرسة؟ ${BRAND.nameAr} تدريب أسبوعي قصير على أسئلة تشبه نافس، يكشف المهارات التي أتقنها طفلك والمهارات التي تحتاج إلى تقوية.`,
});

// Parent-facing page. Keep every line true to what the platform does today:
// results for parents are not live yet, so the QR section says so plainly.

const sheetFacts = [
  {
    icon: Timer,
    title: "ورقة قصيرة في الفصل",
    desc: "عشرة أسئلة اختيار من متعدد، يحلها الطالب في الحصة ويظلل إجابته بقلم الرصاص.",
  },
  {
    icon: Target,
    title: "تدريب يشبه نافس",
    desc: "نافس اختبارات وطنية تقيس نواتج التعلم. أسئلة التدريب على نمطها، فيعتاد عليها طفلك قبل الاختبار الحقيقي.",
  },
  {
    icon: ClipboardCheck,
    title: "هدفها التشخيص",
    desc: "كل سؤال مرتبط بمهارة محددة، فتعرف المدرسة ما أتقنه طفلك وما يحتاج إلى تقوية، أسبوعًا بأسبوع.",
  },
];

const levelNotes: Record<LevelName, string> = {
  متقدم: "أتقن مهارات التدريب بثقة.",
  متمكن: "أتقن أغلب المهارات، وبقيت تفاصيل قليلة.",
  أساسي: "أتقن جزءًا من المهارات، ويحتاج إلى تدريب إضافي.",
  "دون الأساسي": "يحتاج إلى دعم في هذه المهارات، والتحسن ممكن بالتدريب المنتظم.",
};

const homeTips = [
  { title: "اسأل عن الورقة لا عن الدرجة", desc: "«أي سؤال كان صعبًا؟ وكيف حللته؟» يفتح حوارًا أنفع من «كم جبت؟»." },
  { title: "15 دقيقة قراءة كل يوم", desc: "القراءة بصوت مسموع ثم سؤال واحد عمّا قرأ، تقوّي الفهم في كل المواد." },
  { title: "حوّل المهارة إلى موقف من الحياة", desc: "الحساب في السوق، وقراءة الساعة والجداول، ومقارنة الأسعار. التدريب لا يحتاج كتابًا دائمًا." },
  { title: "امدح الجهد والتحسن", desc: "التحسن من أسبوع لأسبوع أهم من درجة واحدة. اذكره لطفلك حين يحدث." },
  { title: "تواصل مع المعلم عند التكرار", desc: "إذا تكرر ضعف المهارة نفسها أكثر من مرة، فالمعلم أقدر من يقترح الخطوة التالية." },
];

const faqs = [
  {
    q: "هل أحتاج إلى حساب أو اشتراك؟",
    a: `لا. المدرسة هي التي تستخدم ${BRAND.nameAr}، ولا يحتاج ولي الأمر إلى تسجيل.`,
  },
  {
    q: "هل تُحسب هذه الأوراق في درجات طفلي؟",
    a: `هذا قرار المدرسة. هدف ${BRAND.nameAr} هو التدريب ومعرفة المهارات التي تحتاج إلى تقوية، لا الحكم على الطالب.`,
  },
  {
    q: "من يصحح الورقة؟",
    a: `يصوّر المعلم الأوراق بجواله، فتقرأ ${BRAND.nameAr} الإجابات المظللة، ثم يراجع المعلم النتائج قبل اعتمادها.`,
  },
  {
    q: "من يرى نتائج طفلي؟",
    a: "معلمه وقيادة مدرسته فقط. لا نبيع البيانات، ولا نعرض إعلانات، ولا نستخدم بيانات الطلاب لأي غرض تسويقي.",
  },
];

const shareText = encodeURIComponent(
  `أقترح على المدرسة الاطلاع على ${BRAND.nameAr}: تدريبات أسبوعية على نمط نافس، وتقرير بمهارات كل طالب. ${SITE_URL}`
);

function ParentsHeader() {
  return (
    <nav className="sticky top-0 z-50 border-b border-slate-100 bg-white/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 lg:px-10">
        <BrandLogo contextTitle={BRAND.nameAr} contextSubtitle="لأولياء الأمور" size="sm" href="/parents" />
        <Link href="/" className="text-xs font-bold text-slate-400 transition hover:text-brand">
          للمدارس والمعلمين
        </Link>
      </div>
    </nav>
  );
}

export default function ParentsPage() {
  return (
    <main className="min-h-screen bg-white text-brand-navy" dir="rtl">
      <ParentsHeader />

      <section className="relative overflow-hidden px-5 py-16 md:py-24 lg:px-10">
        <div className="absolute left-10 top-10 h-80 w-80 rounded-full bg-teal-50/80 blur-3xl" />
        <div className="relative mx-auto max-w-3xl text-center">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-teal-100 bg-teal-50/80 px-4 py-2 text-xs font-extrabold text-brand">
            <HeartHandshake className="h-4 w-4" />
            لأولياء الأمور
          </div>
          <h1 className="text-3xl/[1.5] font-black tracking-normal md:text-5xl/[1.4]">
            تدريب أسبوعي قصير يكشف ما يحتاجه ابنك أو ابنتك
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-9 text-slate-500 md:text-lg md:leading-10">
            مدرسة طفلك تستخدم {BRAND.nameAr} لتدريب الطلاب على أسئلة تشبه اختبارات نافس الوطنية. ورقة قصيرة في الفصل،
            يصححها المعلم بجواله، وتكشف المهارات التي أتقنها طفلك والمهارات التي تحتاج إلى تقوية.
          </p>
        </div>
      </section>

      <section className="border-y border-slate-100 bg-slate-50/40 px-5 py-16 md:py-20 lg:px-10">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-2xl/[1.5] font-black md:text-3xl/[1.5]">ما الورقة التي وصلت مع طفلك؟</h2>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {sheetFacts.map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.title} className="rounded-[1.5rem] border border-slate-100 bg-white p-7 shadow-[0_10px_34px_rgba(15,35,55,0.035)]">
                  <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-50 text-brand">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg/[1.6] font-extrabold">{item.title}</h3>
                  <p className="mt-2 text-sm leading-7 text-slate-500">{item.desc}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="px-5 py-16 md:py-20 lg:px-10">
        <div className="mx-auto grid max-w-5xl items-center gap-10 md:grid-cols-[auto_1fr]">
          <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-[1.75rem] bg-brand-navy text-white">
            <QrCode className="h-14 w-14" />
          </div>
          <div className="text-center md:text-right">
            <h2 className="text-2xl/[1.5] font-black md:text-3xl/[1.5]">ماذا يعني الرمز المطبوع على الورقة؟</h2>
            <p className="mt-4 leading-9 text-slate-500">
              الرمز يوصلك إلى صفحة نتيجة هذا التدريب. نعمل على إتاحة النتائج لأولياء الأمور قريبًا، وعندها ستعرف منها:
            </p>
            <ul className="mt-4 grid gap-2 text-sm font-bold text-brand-navy sm:grid-cols-2">
              {["الدرجة والمستوى", "المهارات التي أتقنها طفلك", "المهارة التي تحتاج إلى تقوية", "نشاطًا قصيرًا تقومون به في البيت"].map((line) => (
                <li key={line} className="flex items-center gap-2 rounded-xl bg-slate-50 px-4 py-3">
                  <Sparkles className="h-4 w-4 shrink-0 text-brand" />
                  {line}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm leading-7 text-slate-400">احتفظ بالورقة، وامسح الرمز مرة أخرى لاحقًا.</p>
          </div>
        </div>
      </section>

      <section className="border-y border-slate-100 bg-slate-50/40 px-5 py-16 md:py-20 lg:px-10">
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <h2 className="text-2xl/[1.5] font-black md:text-3xl/[1.5]">كيف تقرأ مستوى طفلك؟</h2>
            <p className="mx-auto mt-3 max-w-2xl leading-8 text-slate-500">نستخدم المستويات الأربعة نفسها التي تُعرض بها نتائج نافس.</p>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {(Object.keys(ETEC_LEVELS) as LevelName[]).map((name) => {
              const level = ETEC_LEVELS[name];
              const pct = (n: number) => <bdi dir="ltr">{n}%</bdi>;
              const range =
                name === "متقدم" ? <>{pct(90)} فأكثر</> : name === "دون الأساسي" ? <>أقل من {pct(50)}</> : <>من {pct(level.min)} إلى {pct(level.max)}</>;
              return (
                <article key={name} className={`rounded-[1.25rem] border bg-white p-6 ${level.border}`}>
                  <div className="flex items-center justify-between gap-3">
                    <span className={`rounded-full px-3 py-1 text-sm font-black ${level.bg} ${level.text}`}>{name}</span>
                    <span className="text-sm font-bold text-slate-400">{range}</span>
                  </div>
                  <p className="mt-3 text-sm leading-7 text-slate-600">{levelNotes[name]}</p>
                </article>
              );
            })}
          </div>
          <p className="mt-6 text-center text-sm leading-7 text-slate-400">
            نتيجة تدريب واحد صورة لأسبوع واحد. الأهم هو اتجاه التحسن عبر الأسابيع.
          </p>
        </div>
      </section>

      <section className="px-5 py-16 md:py-20 lg:px-10">
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 text-sm font-extrabold text-brand">
              <BookOpen className="h-4 w-4" />
              في البيت
            </div>
            <h2 className="mt-3 text-2xl/[1.5] font-black md:text-3xl/[1.5]">كيف تساعد طفلك؟</h2>
          </div>
          <ol className="mt-10 grid gap-4 md:grid-cols-2">
            {homeTips.map((tip, index) => (
              <li key={tip.title} className="flex gap-4 rounded-[1.25rem] border border-slate-100 bg-white p-6">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-50 text-sm font-black text-brand">
                  {index + 1}
                </span>
                <div>
                  <h3 className="font-extrabold">{tip.title}</h3>
                  <p className="mt-1 text-sm leading-7 text-slate-500">{tip.desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="border-y border-slate-100 bg-slate-50/40 px-5 py-16 md:py-20 lg:px-10">
        <div className="mx-auto max-w-3xl">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 text-sm font-extrabold text-brand">
              <ShieldCheck className="h-4 w-4" />
              أسئلة شائعة
            </div>
            <h2 className="mt-3 text-2xl/[1.5] font-black md:text-3xl/[1.5]">ما يسأل عنه أولياء الأمور</h2>
          </div>
          <div className="mt-10 space-y-3">
            {faqs.map((item) => (
              <details key={item.q} className="group rounded-[1.25rem] border border-slate-100 bg-white p-5 open:shadow-[0_10px_34px_rgba(15,35,55,0.035)]">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-extrabold">
                  {item.q}
                  <span className="text-xl leading-none text-brand transition group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 text-sm leading-7 text-slate-500">{item.a}</p>
              </details>
            ))}
          </div>
          <p className="mt-6 text-center text-sm leading-7 text-slate-500">
            لأي سؤال عن نتيجة طفلك، تواصل مع مدرسته. ولأي ملاحظة على {BRAND.nameAr}:{" "}
            <a href="mailto:info@dalaedu.com" className="font-bold text-brand hover:underline" dir="ltr">info@dalaedu.com</a>
            {" "}·{" "}
            <Link href="/privacy" className="font-bold text-brand hover:underline">سياسة الخصوصية</Link>
          </p>
        </div>
      </section>

      <section className="px-5 py-16 md:py-20 lg:px-10">
        <div className="mx-auto max-w-3xl rounded-[2rem] bg-gradient-to-l from-teal-50/80 via-white to-cyan-50/70 p-8 text-center md:p-12">
          <Users className="mx-auto h-8 w-8 text-brand" />
          <h2 className="mt-4 text-2xl/[1.5] font-black">لديك أبناء في مدرسة أخرى؟</h2>
          <p className="mx-auto mt-3 max-w-xl leading-8 text-slate-500">
            إذا أعجبتك الفكرة، شارك {BRAND.nameAr} مع مدرستهم.
          </p>
          <a
            href={`https://wa.me/?text=${shareText}`}
            target="_blank"
            rel="noreferrer"
            className="mt-7 inline-flex items-center gap-2 rounded-xl bg-brand px-7 py-4 text-base font-extrabold text-white shadow-[0_10px_24px_rgba(21,159,145,0.14)] transition hover:bg-brand-dark"
          >
            <MessageCircle className="h-5 w-5" />
            شاركها عبر واتساب
          </a>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
