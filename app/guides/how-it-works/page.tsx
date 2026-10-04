import Link from "next/link";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { BRAND } from "@/lib/brand";
import { publicMetadata } from "@/lib/seo";

export const metadata = publicMetadata({
  path: "/guides/how-it-works",
  title: `طريقة الاختبار الورقي والتصحيح بالجوال | ${BRAND.nameAr}`,
  description: "دليل المعلم لتطبيق اختبار أسبوعي ورقي، تصوير أوراق الإجابة بالجوال، مراجعة القراءة وهوية الطالب، ثم استخدام النتائج لتحديد الخطوة التعليمية التالية.",
});

const steps = [
  {
    title: "افتح اختبار هذا الأسبوع لفصلك",
    text: "في الصفحة الرئيسية للمعلم، افتح بطاقة الاختبار ضمن «اختبار هذا الأسبوع». تظهر اختبارات فصولك بحسب جدولها، وقد يظهر الاختبار القادم مبكرًا لتتمكن من طباعته. راجع الفصل والمادة والموعد وعدد الأسئلة، وتأكد من إضافة طلاب الفصل. راجع محتوى الاختبار قبل تطبيقه، وسجّل أي مهارة لم تُدرّس بعد عند تفسير النتائج.",
  },
  {
    title: "حمّل الملف واطبع الأوراق",
    text: "اضغط «طباعة» في بطاقة الاختبار لفتح ملفه. افحص نسخة مطبوعة أولًا: هل الأسئلة والخيارات وحقول التعريف واضحة؟ اطبع بعدد الطلاب، واتبع تعليمات الإجابة الموجودة في الملف نفسه.",
  },
  {
    title: "طبّق الاختبار ووضّح طريقة الإجابة",
    text: "وضّح للطلاب أن الغرض هو معرفة ما فهموه وما يحتاجون مساعدة فيه. حدّد الوقت وفق طول الحزمة وظروف الفصل، واطلب منهم إكمال بيانات التعريف والإجابة بوضوح. لا تشرح حل سؤال أثناء التطبيق، وسجّل الغياب منفصلًا عن الإجابات الخاطئة.",
  },
  {
    title: "صوّر الورقة كاملة بالجوال",
    text: "اضغط «تصحيح» في بطاقة الاختبار لفتح التصحيح بالكاميرا. ضع الورقة على سطح مستوٍ بإضاءة جيدة، وأظهر حدودها وبيانات الطالب والإجابات دون ظل أو انعكاس. اقرأ معاينة الصورة؛ إذا كان النص أو التظليل غير واضح فأعد التصوير.",
  },
  {
    title: "راجع القراءة والطالب قبل الحفظ",
    text: "تُقرأ الإجابات من الصورة ويُحسب التصحيح بمفتاح إجابة الحزمة. راجع مطابقة كل ورقة بالطالب الصحيح، وافتح مراجعة الإجابات عند الشك. يمكن تصحيح الإجابة المقروءة وإعادة حساب الدرجة، أو إعادة تصوير الورقة غير المقروءة. عالج الأوراق المكررة وتأكد من عدم إغفال ورقة قبل حفظ النتائج.",
  },
  {
    title: "حوّل النتيجة إلى إجراء تعليمي",
    text: "اضغط «النتائج» في بطاقة الاختبار بعد حفظ التصحيح لعرض تقرير الفصل. تجد درجات الاختبارات الأقدم في «الاختبارات السابقة». ابدأ بالمهارات التي تكررت فيها الأخطاء، وراجع بعض إجابات الطلاب لتفهم السبب. اختر نشاطًا قصيرًا لمعالجة مهارة واحدة، ثم أعد التحقق بأسئلة أخرى تقيس المهارة نفسها بعد إتاحة فرصة للتعلّم.",
  },
];

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen bg-white text-brand-navy" dir="rtl">
      <SiteHeader />
      <main className="px-5 py-12 md:py-20 lg:px-10">
        <article className="mx-auto max-w-3xl">
          <nav aria-label="مسار الصفحة" className="mb-8 text-sm font-bold text-slate-500">
            <Link href="/" className="hover:text-brand">الرئيسية</Link>
            <span className="mx-3" aria-hidden="true">/</span>
            <span>أدلة {BRAND.nameAr}</span>
          </nav>
          <p className="text-sm font-extrabold text-brand">دليل عملي للمعلم</p>
          <h1 className="mt-4 text-3xl/[1.5] font-black md:text-5xl/[1.45]">
            من الاختبار الورقي إلى تقرير يساعدك في الحصة التالية
          </h1>
          <p className="mt-6 text-lg leading-9 text-slate-600">
            تساعدك {BRAND.nameAr} على تطبيق اختبارات ورقية قصيرة وتصحيحها بالجوال ومتابعة نتائجها.
            هذا الدليل يشرح دور المعلم في كل مرحلة، من فتح اختبار الأسبوع إلى مراجعة النتائج واتخاذ قرار تعليمي.
            الاختبارات الظاهرة تعتمد على جدول ما فُعّل لحسابك وفصلك.
          </p>

          <ol className="mt-10 space-y-5">
            {steps.map((step, index) => (
              <li key={step.title} className="rounded-2xl border border-slate-200 p-6 md:p-8">
                <div className="flex items-start gap-4">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand/10 font-black text-brand" aria-hidden="true">
                    {index + 1}
                  </span>
                  <div>
                    <h2 className="text-xl font-extrabold leading-8">{step.title}</h2>
                    <p className="mt-3 leading-8 text-slate-600">{step.text}</p>
                  </div>
                </div>
              </li>
            ))}
          </ol>

          <section className="mt-10 rounded-2xl bg-slate-50 p-6 md:p-8" aria-labelledby="review-checklist">
            <h2 id="review-checklist" className="text-2xl font-black leading-9">مراجعة سريعة قبل اعتماد النتائج</h2>
            <ul className="mt-4 list-disc space-y-3 pr-5 leading-8 text-slate-600">
              <li>الحزمة والصف والفصل صحيحة، وكل ورقة مرتبطة بصاحبها.</li>
              <li>الأوراق التي تحتاج إعادة تصوير أو مراجعة إجابة عولجت.</li>
              <li>عدد الأوراق المحفوظة يطابق الأوراق التي استلمتها، مع تسجيل الغائبين منفصلًا.</li>
              <li>النتيجة تُقرأ في ضوء ما دُرّس وعدد الأسئلة وظروف التطبيق.</li>
            </ul>
            <p className="mt-5 leading-8 text-slate-600">
              قد تخطئ قراءة الصور، خصوصًا مع التظليل الخفيف أو الصورة غير الواضحة؛ مراجعتك جزء من عملية التصحيح.
              استخدم بيانات الطلاب وفق صلاحياتك وتعليمات مدرستك، ولا تنشر صور أوراقهم أو تقاريرهم في صفحات عامة.
            </p>
          </section>

          <section className="mt-10 border-t border-slate-200 pt-8" aria-labelledby="next-step">
            <h2 id="next-step" className="text-2xl font-black">الخطوة التالية</h2>
            <div className="mt-5 flex flex-col items-start gap-4 font-bold text-brand">
              <Link href="/guides/learning-outcomes-reports" className="underline underline-offset-4">كيف تقرأ تقرير نواتج التعلم؟</Link>
              <Link href="/guides/grade-6-math-diagnostic" className="underline underline-offset-4">جرّب عينة أسئلة رياضيات للصف السادس</Link>
              <Link href="/teachers" className="underline underline-offset-4">تعرّف على باقة المعلم</Link>
            </div>
          </section>
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}
