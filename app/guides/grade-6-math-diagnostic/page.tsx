import Link from "next/link";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { BRAND } from "@/lib/brand";
import { publicMetadata } from "@/lib/seo";

export const metadata = publicMetadata({
  path: "/guides/grade-6-math-diagnostic",
  title: `عينة اختبار تشخيصي رياضيات للصف السادس مع الحل | ${BRAND.nameAr}`,
  description: "ستة أسئلة أصلية لمراجعة مهارات رياضية أساسية لدى طالب الصف السادس، تشمل الكسور والأعداد العشرية والقسمة والنسبة المئوية والمساحة والمتوسط، مع شرح الإجابات.",
});

const questions = [
  {
    skill: "جمع كسور متساوية المقام",
    question: <>أكلت سارة ربع فطيرة صباحًا وربعين من الفطيرة نفسها مساءً. ما مجموع ما أكلته؟</>,
    options: ["1/2", "3/8", "3/4", "1/4"],
    answer: <>الإجابة: ج، <bdi dir="ltr">3/4</bdi>.</>,
    explanation: <>نجمع البسطين ونُبقي المقام لأن الأجزاء متساوية: <bdi dir="ltr">1/4 + 2/4 = 3/4</bdi>. جمع المقامين يغيّر حجم الجزء، لذلك لا نجمعهما.</>,
    followUp: "اطلب من الطالب تظليل ثلاثة أرباع شكل مقسّم إلى أربعة أجزاء متساوية، ثم ربط الشكل بالعملية.",
  },
  {
    skill: "مقارنة أعداد عشرية",
    question: <>أي الأعداد التالية هو الأكبر؟</>,
    options: ["0.605", "0.65", "0.56", "0.506"],
    answer: <>الإجابة: ب، <bdi dir="ltr">0.65</bdi>.</>,
    explanation: <>يمكن كتابة الأعداد بثلاث منازل عشرية: <bdi dir="ltr">0.605, 0.650, 0.560, 0.506</bdi>. الأكبر هو <bdi dir="ltr">0.650</bdi>؛ كثرة الأرقام بعد الفاصلة لا تعني أن العدد أكبر.</>,
    followUp: "اطلب من الطالب شرح المقارنة باستخدام القيمة المنزلية أو وضع العددين الأقرب على خط أعداد.",
  },
  {
    skill: "القسمة في مسألة لفظية",
    question: <>لدى مدرسة 144 قلمًا، وزّعتها بالتساوي على 12 مجموعة. كم قلمًا تحصل عليه كل مجموعة؟</>,
    options: ["10", "11", "13", "12"],
    answer: <>الإجابة: د، 12 قلمًا.</>,
    explanation: <>نقسم عدد الأقلام على عدد المجموعات: <bdi dir="ltr">144 ÷ 12 = 12</bdi>. نتحقق بالضرب: <bdi dir="ltr">12 × 12 = 144</bdi>.</>,
    followUp: "اطلب من الطالب كتابة عملية الضرب التي تتحقق من القسمة، ثم غيّر عدد الأقلام مع تثبيت عدد المجموعات.",
  },
  {
    skill: "إيجاد نسبة مئوية من كمية",
    question: <>في مكتبة فصل 80 كتابًا، ربعها قصص، أي 25% منها. كم كتاب قصص فيها؟</>,
    options: ["20", "25", "40", "60"],
    answer: <>الإجابة: أ، 20 كتابًا.</>,
    explanation: <>النسبة <bdi dir="ltr">25%</bdi> تساوي الربع. نقسم 80 على 4 فنحصل على 20. النسبة تصف جزءًا من الكمية، وليست عدد الكتب نفسه.</>,
    followUp: "استخدم رسمًا من أربع مجموعات متساوية، ثم اسأل عن نصف الكتب لمراجعة العلاقة بين الكسر والنسبة والكمية.",
  },
  {
    skill: "مساحة المستطيل",
    question: <>حديقة مستطيلة طولها 9 أمتار وعرضها 4 أمتار. ما مساحتها؟</>,
    options: ["13 م²", "26 م²", "36 م²", "18 م²"],
    answer: <>الإجابة: ج، 36 مترًا مربعًا.</>,
    explanation: <>مساحة المستطيل تساوي الطول مضروبًا في العرض: <bdi dir="ltr">9 × 4 = 36</bdi>. نستخدم وحدة مربعة لأننا نقيس سطح الحديقة؛ أما محيطها فيساوي 26 مترًا.</>,
    followUp: "اطلب رسم المستطيل وتقسيمه إلى مربعات، ثم اسأل عن الفرق بين تغطية أرضه وإحاطته بسياج.",
  },
  {
    skill: "المتوسط الحسابي",
    question: <>قرأ طالب خلال أربعة أيام 6 صفحات ثم 8 ثم 10 ثم 12 صفحة. ما متوسط عدد الصفحات في اليوم؟</>,
    options: ["8", "9", "10", "36"],
    answer: <>الإجابة: ب، 9 صفحات.</>,
    explanation: <>نجمع الصفحات فنحصل على <bdi dir="ltr">6 + 8 + 10 + 12 = 36</bdi>، ثم نقسم على عدد الأيام: <bdi dir="ltr">36 ÷ 4 = 9</bdi>. مجموع الصفحات يختلف عن متوسطها اليومي.</>,
    followUp: "اطلب من الطالب تمثيل الصفحات بمجموعات وإعادة توزيعها بالتساوي على الأيام الأربعة.",
  },
];

const optionLabels = ["أ", "ب", "ج", "د"];

export default function GradeSixMathDiagnosticPage() {
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
          <p className="text-sm font-extrabold text-brand">عينة تعليمية أصلية من {BRAND.nameAr}</p>
          <h1 className="mt-4 text-3xl/[1.5] font-black md:text-5xl/[1.45]">ستة أسئلة تشخيصية في رياضيات الصف السادس مع شرح الحل</h1>
          <p className="mt-6 text-lg leading-9 text-slate-600">
            عينة قصيرة لمراجعة مهارات أساسية لدى طالب الصف السادس. تشمل مهارات سبق تعلّمها وقد يحتاج الطالب إلى تثبيتها،
            وليست تغطية كاملة لمنهج الصف أو لفصل دراسي محدد. اختر منها ما سبق تدريسه لطلابك.
          </p>
          <p className="mt-5 rounded-2xl bg-brand/10 p-5 leading-8 text-brand-navy">
            هذه الأسئلة أُعدّت لهذا الدليل؛ ليست أسئلة رسمية من اختبار نافس ولا اختبارًا مقننًا أو معتمدًا من هيئة تقويم التعليم والتدريب.
            لا تُستخدم نتيجتها للتنبؤ بالأداء في نافس أو للحكم النهائي على مستوى الطالب.
          </p>

          <section className="mt-10" aria-labelledby="instructions">
            <h2 id="instructions" className="text-2xl font-black">طريقة الاستفادة من العينة</h2>
            <p className="mt-4 leading-8 text-slate-600">
              يختار الطالب إجابة واحدة لكل سؤال، ويفضّل أن يكتب خطواته على ورقة دون آلة حاسبة.
              اترك الحلول مغلقة حتى ينتهي، ثم ناقش طريقة التفكير قبل عرض الشرح.
              هذه الصفحة لا تجمع أسماء الطلاب أو إجاباتهم ولا تحفظ درجاتهم؛ سجّل ملاحظاتك بالطريقة المعتمدة في مدرستك.
            </p>
          </section>

          <div className="mt-8 space-y-6">
            {questions.map((question, index) => (
              <section key={question.skill} aria-labelledby={`question-${index + 1}`} className="rounded-2xl border border-slate-200 p-6 md:p-8">
                <p className="text-sm font-bold text-brand">المهارة: {question.skill}</p>
                <h2 id={`question-${index + 1}`} className="mt-3 text-lg font-extrabold leading-9">
                  السؤال {index + 1}: {question.question}
                </h2>
                <ul className="mt-5 grid gap-3 sm:grid-cols-2" aria-label={`خيارات السؤال ${index + 1}`}>
                  {question.options.map((option, optionIndex) => (
                    <li key={option} className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3 font-bold">
                      <span className="text-brand">{optionLabels[optionIndex]}.</span>
                      <bdi dir="ltr">{option}</bdi>
                    </li>
                  ))}
                </ul>
                <details className="mt-6 border-t border-slate-200 pt-5">
                  <summary className="cursor-pointer font-extrabold leading-8 text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand">
                    عرض إجابة السؤال {index + 1} وشرحها
                  </summary>
                  <div className="mt-4 space-y-3 leading-8 text-slate-600">
                    <p className="font-extrabold text-brand-navy">{question.answer}</p>
                    <p>{question.explanation}</p>
                    <p><strong className="text-brand-navy">للمتابعة:</strong> {question.followUp}</p>
                  </div>
                </details>
              </section>
            ))}
          </div>

          <section className="mt-10 rounded-2xl bg-slate-50 p-6 md:p-8" aria-labelledby="after-sample">
            <h2 id="after-sample" className="text-2xl font-black leading-9">بعد الحل: ماذا تراجع مع الطالب؟</h2>
            <p className="mt-4 leading-8 text-slate-600">
              سجّل لكل مهارة هل أجاب الطالب إجابة صحيحة، وهل يستطيع تفسيرها.
              قد تكون الإجابة الصحيحة تخمينًا، وقد ينتج الخطأ عن قراءة السؤال أو الحساب لا عن غياب فهم المهارة.
              استخدم الشرح وسؤال متابعة جديدًا لتحديد ما يحتاجه الطالب، ثم راجع أعماله الأخرى قبل أي حكم أوسع.
              العينة تضم سؤالًا واحدًا لكل مهارة؛ مجموعها من ست درجات لا يكفي لتصنيف الإتقان.
            </p>
          </section>

          <div className="mt-10 flex flex-col items-start gap-4 border-t border-slate-200 pt-8 font-bold text-brand">
            <Link href="/guides/learning-outcomes-reports" className="underline underline-offset-4">كيف تحوّل نتائج الأسئلة إلى خطة متابعة؟</Link>
            <Link href="/guides/how-it-works" className="underline underline-offset-4">طريقة تطبيق حزم {BRAND.nameAr} والتصحيح بالجوال</Link>
            <Link href="/teachers" className="underline underline-offset-4">تعرّف على باقة المعلم</Link>
          </div>
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}
