import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
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
  };
  const result = data.result;
  const weak = data.weakestSkill ?? {
    name: "مهارة تحتاج إلى تقوية",
    domain: "سيظهر تحليل أدق بعد حفظ نتائج أكثر.",
    remediation: "تدريب قصير ومنتظم يساعد الطالب على التحسن بهدوء.",
  };
  const scoreLabel = result ? `${toEnglishDigits(result.score)}/${toEnglishDigits(result.total)}` : "لا توجد نتيجة محفوظة";
  const levelLabel = result?.level ?? (data.percentage === null ? "بانتظار أول نتيجة" : "يحتاج إلى متابعة");

  return (
    <main className="min-h-screen bg-[#f7fafc] px-5 py-8 text-[#0b2447]" dir="rtl">
      <section className="mx-auto max-w-2xl">
        <div className="rounded-[1.75rem] border border-slate-100 bg-white p-6 shadow-[0_10px_34px_rgba(15,35,55,0.035)]">
          <div className="mb-6 flex justify-center">
            <BrandLogo size="sm" centered />
          </div>
          <p className="text-center text-sm font-extrabold text-[#159f91]">تقرير ولي الأمر</p>
          <h1 className="mt-2 text-center text-3xl font-black">{student.name}</h1>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-slate-50 p-4 text-center">
              <div className="text-sm font-bold text-slate-400">المستوى العام</div>
              <div className="mt-2 text-2xl font-black" style={{ color: levelColor(levelLabel) }}>{levelLabel}</div>
            </div>
            <div className="rounded-xl bg-teal-50 p-4 text-center">
              <div className="text-sm font-bold text-slate-400">آخر نتيجة</div>
              <div className="mt-2 text-2xl font-black text-[#159f91]">
                {data.percentage === null ? "—" : `${toEnglishDigits(data.percentage)}٪`}
              </div>
              <div className="mt-1 text-xs font-bold text-slate-500">{scoreLabel}</div>
            </div>
          </div>

          <div className="mt-5 rounded-xl bg-amber-50 p-4">
            <p className="text-sm font-bold text-slate-500">فرصة للتحسن</p>
            <h2 className="mt-1 text-xl font-black text-[#BA7517]">{weak.name}</h2>
            <p className="mt-2 text-sm font-bold leading-7 text-slate-600">
              {weak.remediation ?? "تدريب قصير ومنتظم يساعد الطالب على تقوية هذه المهارة."}
            </p>
          </div>

          <p className="mt-5 text-center text-sm font-bold leading-7 text-slate-500">
            هذا ملخص بسيط لمساعدة ولي الأمر على دعم الطالب بخطوة تدريبية قصيرة في المنزل.
          </p>

          <Link
            href={`/student/mission/${token}`}
            className="mt-6 flex w-full justify-center rounded-xl bg-[#159f91] px-5 py-3 text-sm font-extrabold text-white transition hover:bg-[#10877b]"
          >
            ابدأ التدريب المجاني
          </Link>
        </div>
      </section>
    </main>
  );
}
