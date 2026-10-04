import Link from "next/link";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { BRAND } from "@/lib/brand";
import { publicMetadata } from "@/lib/seo";

export const metadata = publicMetadata({
  path: "/guides/learning-outcomes-reports",
  title: `كيف تقرأ تقرير نواتج التعلم؟ مثال للمعلم وقائد المدرسة | ${BRAND.nameAr}`,
  description: "مثال توضيحي بأرقام افتراضية لقراءة نتائج المهارات، التفريق بين الغياب والإجابة الخاطئة، وتحديد نشاط معالجة ومتابعة أثره دون المبالغة في تفسير اختبار قصير.",
});

const exampleRows = [
  { skill: "جمع كسور متساوية المقام", correct: "24 من 30", rate: "80%", action: "راجع إجابات الستة الآخرين وحدّد من يحتاج شرحًا إضافيًا." },
  { skill: "مقارنة أعداد عشرية", correct: "15 من 30", rate: "50%", action: "ابدأ بمناقشة القيمة المنزلية وخط الأعداد مع الفصل." },
  { skill: "حساب مساحة مستطيل", correct: "18 من 30", rate: "60%", action: "تحقق من الخلط بين المساحة والمحيط بنشاط عملي قصير." },
];

export default function LearningOutcomesReportsPage() {
  return (
    <div className="min-h-screen bg-white text-brand-navy" dir="rtl">
      <SiteHeader />
      <main className="px-5 py-12 md:py-20 lg:px-10">
        <article className="mx-auto max-w-4xl">
          <nav aria-label="مسار الصفحة" className="mb-8 text-sm font-bold text-slate-500">
            <Link href="/" className="hover:text-brand">الرئيسية</Link>
            <span className="mx-3" aria-hidden="true">/</span>
            <span>أدلة {BRAND.nameAr}</span>
          </nav>
          <p className="text-sm font-extrabold text-brand">دليل للمعلم وقائد المدرسة</p>
          <h1 className="mt-4 text-3xl/[1.5] font-black md:text-5xl/[1.45]">كيف تقرأ تقرير نواتج التعلم وتختار الخطوة التالية؟</h1>
          <p className="mt-6 text-lg leading-9 text-slate-600">
            يوجّهك التقرير إلى أسئلة محددة: ما المهارات التي ظهرت فيها صعوبة؟ من يحتاج دعمًا؟ ومتى نتحقق من أثر المعالجة؟
            تعرض تقارير {BRAND.nameAr} النتائج المحفوظة وتحليل المهارات بحسب البيانات المتاحة والفترة التي تختارها.
            المثال التالي يشرح طريقة القراءة، ولا يمثل تقريرًا فعليًا لمدرسة.
          </p>

          <section className="mt-10" aria-labelledby="before-reading">
            <h2 id="before-reading" className="text-2xl font-black leading-9">ابدأ بمعرفة من شملهم التقرير</h2>
            <p className="mt-4 leading-8 text-slate-600">
              في مثالنا الافتراضي، يضم الفصل 32 طالبًا، واختُبر 30 طالبًا، وغاب اثنان.
              أجاب كل طالب حاضر عن سؤال واحد لكل مهارة في الجدول. النسب محسوبة من الطلاب الثلاثين المختبرين؛
              لا نعدّ الغائبين إجابات خاطئة، ولا نفترض مستوى أدائهما دون دليل.
              وفي أي تقرير حقيقي، راجع المادة والفصل والفترة وعدد النتائج المحفوظة قبل المقارنة.
            </p>
          </section>

          <section className="mt-10" aria-labelledby="example-report">
            <h2 id="example-report" className="text-2xl font-black leading-9">مثال مبسّط لقراءة نتائج المهارات</h2>
            <p className="mt-3 rounded-xl bg-brand/10 px-5 py-4 font-bold leading-8 text-brand-navy">
              جميع الأرقام افتراضية لأغراض الشرح. النسبة هنا هي نسبة الإجابات الصحيحة عن سؤال واحد، وليست حكمًا نهائيًا على إتقان المهارة.
            </p>
            <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full min-w-[640px] text-right text-sm leading-7">
                <caption className="sr-only">نتائج افتراضية لثلاثة أسئلة أجاب عنها 30 طالبًا، مع إجراءات تعليمية مقترحة</caption>
                <thead className="bg-slate-50">
                  <tr>
                    <th scope="col" className="p-4 font-extrabold">المهارة</th>
                    <th scope="col" className="p-4 font-extrabold">إجابات صحيحة</th>
                    <th scope="col" className="p-4 font-extrabold">النسبة</th>
                    <th scope="col" className="p-4 font-extrabold">إجراء مقترح</th>
                  </tr>
                </thead>
                <tbody>
                  {exampleRows.map((row) => (
                    <tr key={row.skill} className="border-t border-slate-200">
                      <th scope="row" className="p-4 font-bold">{row.skill}</th>
                      <td className="whitespace-nowrap p-4 text-slate-600">{row.correct}</td>
                      <td className="p-4 text-slate-600"><bdi dir="ltr">{row.rate}</bdi></td>
                      <td className="p-4 text-slate-600">{row.action}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 leading-8 text-slate-600">
              تُحسب نسبة السؤال الأول بقسمة 24 على 30 ثم الضرب في 100. رغم أن نسبة الإجابات الصحيحة فيه أعلى،
              يحتاج المعلم إلى معرفة الطلاب الذين أخطؤوا وما إذا كان الخطأ متكررًا.
              أما سؤال الأعداد العشرية فيستحق أولوية للمراجعة في هذا المثال، بعد التأكد من وضوح السؤال وصحة التصحيح.
            </p>
          </section>

          <section className="mt-10" aria-labelledby="follow-up">
            <h2 id="follow-up" className="text-2xl font-black leading-9">خطة متابعة صغيرة قابلة للتنفيذ</h2>
            <ol className="mt-5 list-decimal space-y-4 pr-5 leading-8 text-slate-600">
              <li><strong className="text-brand-navy">افهم الخطأ:</strong> اطلب من عينة من الطلاب شرح طريقة مقارنة عددين عشريين؛ اختيار خاطئ وحده لا يكشف سبب الخطأ بيقين.</li>
              <li><strong className="text-brand-navy">حدّد إجراءً:</strong> يقدّم المعلم نشاطًا بالقيمة المنزلية، ثم تدريبًا موجهًا لمن يحتاجون دعمًا إضافيًا.</li>
              <li><strong className="text-brand-navy">حدّد موعدًا:</strong> بعد إتاحة فرصة للتدريب، مثل الأسبوع التالي، استخدم أسئلة جديدة بمستوى قريب تقيس المهارة نفسها.</li>
              <li><strong className="text-brand-navy">وثّق المتابعة:</strong> سجّل المهارة والإجراء والمسؤول وموعد إعادة التحقق، ثم راجع من تحسن ومن لا يزال يحتاج دعمًا.</li>
            </ol>
            <p className="mt-5 leading-8 text-slate-600">
              يستطيع قائد المدرسة متابعة اكتمال التطبيق ومناقشة الاحتياج مع المعلم وتوفير وقت المعالجة.
              عند المقارنة بين فترتين، تحقّق من اختلاف الحضور وصعوبة الأسئلة والمهارات المقاسة؛
              ارتفاع المتوسط وحده لا يثبت أن إجراءً بعينه هو سبب التحسن.
            </p>
          </section>

          <section className="mt-10 rounded-2xl bg-slate-50 p-6 md:p-8" aria-labelledby="interpretation">
            <h2 id="interpretation" className="text-2xl font-black leading-9">ما الذي يمكن أن نستنتجه؟</h2>
            <p className="mt-4 leading-8 text-slate-600">
              الاختبار القصير يوفر إشارات أولية تدعم ملاحظة المعلم وأعمال الطالب وأسئلة المتابعة.
              لا يكفي سؤال واحد لتصنيف قدرة الطالب تصنيفًا ثابتًا، ولا تتحول نتيجته تلقائيًا إلى توقع لدرجته في نافس.
              شارك ملخصات الفصل مع أصحاب الصلاحية، وناقش احتياجات كل طالب بصورة تحفظ خصوصيته.
            </p>
          </section>

          <div className="mt-10 flex flex-col items-start gap-4 border-t border-slate-200 pt-8 font-bold text-brand">
            <Link href="/guides/how-it-works" className="underline underline-offset-4">دليل تطبيق الاختبار والتصحيح بالجوال</Link>
            <Link href="/guides/grade-6-math-diagnostic" className="underline underline-offset-4">عينة أسئلة رياضيات مع الإجابات والشرح</Link>
            <Link href="/#trial" className="underline underline-offset-4">تواصل معنا للتعرّف على {BRAND.nameAr}</Link>
          </div>
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}
