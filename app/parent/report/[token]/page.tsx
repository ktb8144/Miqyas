import Link from "next/link";
import { toEnglishDigits } from "@/lib/format";
import { loadParentReportData } from "@/lib/parent-report";

export const dynamic = "force-dynamic";

function levelColor(level?: string | null) {
  if (level === "متقدم" || level === "متمكن") return "#159f91";
  if (level === "أساسي") return "#BA7517";
  return "#E24B4A";
}

function InvalidReport() {
  return (
    <main className="min-h-screen bg-[#f7fafc] px-5 py-10 text-[#0b2447]" dir="rtl">
      <section className="mx-auto max-w-2xl rounded-[1.5rem] border border-red-100 bg-white p-8 text-center shadow-[0_10px_34px_rgba(15,35,55,0.035)]">
        <h1 className="text-2xl font-black">رابط التقرير غير صالح</h1>
        <p className="mt-3 text-sm font-bold leading-7 text-slate-500">
          قد يكون الرابط منتهي الصلاحية أو تم إلغاؤه. يرجى طلب رابط جديد من المدرسة.
        </p>
      </section>
    </main>
  );
}

export default async function ParentReportPage({ params }: { params: { token: string } }) {
  const token = params.token?.trim();
  if (!token) return <InvalidReport />;

  const data = await loadParentReportData(token, "open_report");
  if (!data) return <InvalidReport />;

  const student = data.student as unknown as {
    name: string;
    student_code: string | null;
    classes?: { name?: string | null; subject?: string | null } | Array<{ name?: string | null; subject?: string | null }> | null;
    schools?: { name?: string | null } | Array<{ name?: string | null }> | null;
  };
  const classRow = Array.isArray(student.classes) ? student.classes[0] : student.classes;
  const schoolRow = Array.isArray(student.schools) ? student.schools[0] : student.schools;
  const result = data.result;
  const assessmentPackage = Array.isArray(result?.assessment_packages)
    ? result?.assessment_packages[0]
    : result?.assessment_packages;
  const weak = data.weakestSkill ?? {
    name: "مهارة تحتاج متابعة",
    domain: "سيظهر تحليل أدق بعد حفظ نتائج أسئلة أكثر.",
    remediation: "المراجعة اليومية القصيرة وقراءة السؤال بتركيز تساعد الطالب على التحسن.",
  };
  const scoreLabel = result ? `${toEnglishDigits(result.score)}/${toEnglishDigits(result.total)}` : "لا توجد نتيجة محفوظة";

  return (
    <main className="min-h-screen bg-[#f7fafc] px-5 py-8 text-[#0b2447]" dir="rtl">
      <section className="mx-auto max-w-4xl space-y-5">
        <div className="rounded-[1.75rem] border border-slate-100 bg-white p-6 shadow-[0_10px_34px_rgba(15,35,55,0.035)]">
          <p className="text-sm font-extrabold text-[#159f91]">تقرير ولي الأمر</p>
          <h1 className="mt-2 text-3xl font-black">تقرير الطالب في مقياس</h1>
          <p className="mt-3 text-sm font-bold leading-7 text-slate-500">
            هذا التقرير رابط خاص لا يحتوي على رقم الطالب الداخلي، وصالح لمدة 14 يومًا من تاريخ إنشائه.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-[1.5rem] border border-slate-100 bg-white p-5 shadow-[0_10px_34px_rgba(15,35,55,0.035)] md:col-span-2">
            <div className="text-sm font-bold text-slate-400">الطالب</div>
            <h2 className="mt-1 text-2xl font-black">{student.name}</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-full bg-teal-50 px-3 py-1 text-sm font-bold text-[#159f91]">
                رقم الطالب: {toEnglishDigits(student.student_code ?? "—")}
              </span>
              <span className="rounded-full bg-slate-50 px-3 py-1 text-sm font-bold text-slate-500">
                {classRow?.name ?? "فصل غير محدد"}
              </span>
              <span className="rounded-full bg-slate-50 px-3 py-1 text-sm font-bold text-slate-500">
                {schoolRow?.name ?? "المدرسة"}
              </span>
            </div>
          </div>
          <div className="rounded-[1.5rem] border border-slate-100 bg-white p-5 text-center shadow-[0_10px_34px_rgba(15,35,55,0.035)]">
            <div className="text-sm font-bold text-slate-400">آخر نتيجة</div>
            <div className="mt-2 text-4xl font-black" style={{ color: levelColor(result?.level) }}>
              {data.percentage === null ? "—" : `${toEnglishDigits(data.percentage)}٪`}
            </div>
            <div className="mt-2 text-sm font-bold text-slate-500">{scoreLabel}</div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-[1.5rem] border border-slate-100 bg-white p-5 shadow-[0_10px_34px_rgba(15,35,55,0.035)]">
            <h3 className="text-xl font-black">تفاصيل الاختبار</h3>
            {result ? (
              <div className="mt-4 space-y-3 text-sm font-bold text-slate-600">
                <p>الحزمة: {assessmentPackage?.title ?? "اختبار مقياس"}</p>
                <p>المادة: {assessmentPackage?.subject ?? classRow?.subject ?? "غير محددة"}</p>
                <p>الأسبوع: {toEnglishDigits(assessmentPackage?.week_number ?? "—")}</p>
                <p>المستوى: <span style={{ color: levelColor(result.level) }}>{result.level ?? "غير محدد"}</span></p>
              </div>
            ) : (
              <p className="mt-4 text-sm font-bold leading-7 text-slate-500">
                لا توجد نتيجة محفوظة لهذا الطالب حتى الآن. ستظهر هنا آخر نتيجة بعد تصحيح اختبار مقياس وحفظه.
              </p>
            )}
          </div>

          <div className="rounded-[1.5rem] border border-slate-100 bg-white p-5 shadow-[0_10px_34px_rgba(15,35,55,0.035)]">
            <h3 className="text-xl font-black">أهم مهارة تحتاج متابعة</h3>
            <div className="mt-4 rounded-xl bg-amber-50 p-4">
              <p className="font-black text-[#BA7517]">{weak.name}</p>
              <p className="mt-2 text-sm font-bold leading-7 text-slate-600">{weak.domain}</p>
              <p className="mt-3 text-sm font-bold leading-7 text-slate-500">
                {weak.remediation ?? "يوصى بمراجعة هذه المهارة مع المعلم خلال الأسبوع القادم."}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-teal-100 bg-teal-50/70 p-5">
          <h3 className="font-black text-[#0b2447]">توصية للمنزل</h3>
          <p className="mt-2 text-sm font-bold leading-7 text-slate-600">
            خصصوا 10 دقائق يوميًا لمراجعة المهارة المحددة، مع تشجيع الطالب على قراءة السؤال ببطء وتحديد المطلوب قبل اختيار الإجابة.
          </p>
          <Link
            href={`/student/mission/${token}`}
            className="mt-4 inline-flex rounded-xl bg-[#159f91] px-5 py-3 text-sm font-extrabold text-white transition hover:bg-[#10877b]"
          >
            ابدأ التدريب المجاني
          </Link>
        </div>
      </section>
    </main>
  );
}
