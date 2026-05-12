import Link from "next/link";
import { loadParentReportData } from "@/lib/parent-report";
import { MissionCompletionCard } from "@/components/parent-report/mission-completion-card";

export const dynamic = "force-dynamic";

function InvalidMission() {
  return (
    <main className="min-h-screen bg-[#f7fafc] px-5 py-10 text-[#0b2447]" dir="rtl">
      <section className="mx-auto max-w-2xl rounded-[1.5rem] border border-red-100 bg-white p-8 text-center shadow-[0_10px_34px_rgba(15,35,55,0.035)]">
        <h1 className="text-2xl font-black">رابط التدريب غير صالح</h1>
        <p className="mt-3 text-sm font-bold leading-7 text-slate-500">
          يرجى فتح التدريب من رابط تقرير ولي الأمر الصالح.
        </p>
      </section>
    </main>
  );
}

export default async function StudentMissionPage({ params }: { params: { token: string } }) {
  const token = params.token?.trim();
  if (!token) return <InvalidMission />;

  const data = await loadParentReportData(token, "open_mission");
  if (!data) return <InvalidMission />;

  const student = data.student as unknown as { name: string };
  const weak = data.weakestSkill ?? {
    name: "قراءة السؤال وتحديد المطلوب",
    domain: "تدريب عام",
    remediation: "اقرأ السؤال مرتين، ثم ضع خطًا تحت المطلوب قبل اختيار الإجابة.",
  };

  const steps = [
    "اقرأ السؤال بصوت هادئ وحدد الكلمات المهمة.",
    "اكتب المطلوب من السؤال بكلمة أو جملة قصيرة.",
    "استبعد خيارين غير مناسبين قبل اختيار الإجابة.",
    "راجع إجابتك مرة واحدة وتأكد أنها تجيب عن المطلوب.",
  ];

  return (
    <main className="min-h-screen bg-[#f7fafc] px-5 py-8 text-[#0b2447]" dir="rtl">
      <section className="mx-auto max-w-3xl space-y-5">
        <div className="rounded-[1.75rem] border border-slate-100 bg-white p-6 shadow-[0_10px_34px_rgba(15,35,55,0.035)]">
          <p className="text-sm font-extrabold text-[#159f91]">تدريب مجاني قصير</p>
          <h1 className="mt-2 text-3xl font-black">مهمة تدريبية للطالب {student.name}</h1>
          <p className="mt-3 text-sm font-bold leading-7 text-slate-500">
            هذه مهمة مبسطة مبنية على المهارة التي تحتاج إلى تقوية في تقرير مقياس.
          </p>
        </div>

        <div className="rounded-[1.5rem] border border-amber-100 bg-white p-5 shadow-[0_10px_34px_rgba(15,35,55,0.035)]">
          <div className="rounded-xl bg-amber-50 p-4">
            <p className="text-sm font-bold text-slate-500">المهارة المستهدفة</p>
            <h2 className="mt-1 text-2xl font-black text-[#BA7517]">{weak.name}</h2>
            <p className="mt-2 text-sm font-bold leading-7 text-slate-600">{weak.domain}</p>
          </div>
        </div>

        <div className="grid gap-3">
          {steps.map((step, index) => (
            <div key={step} className="flex gap-3 rounded-[1.25rem] border border-slate-100 bg-white p-4 shadow-[0_10px_34px_rgba(15,35,55,0.025)]">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-50 text-sm font-black text-[#159f91]">
                {index + 1}
              </span>
              <p className="text-sm font-bold leading-7 text-slate-600">{step}</p>
            </div>
          ))}
        </div>

        <MissionCompletionCard token={token} skillName={weak.name} studentName={student.name} />

        <div className="rounded-[1.5rem] border border-teal-100 bg-teal-50/70 p-5">
          <h3 className="font-black">تدريب اليوم</h3>
          <p className="mt-2 text-sm font-bold leading-7 text-slate-600">
            {weak.remediation ?? "حل 5 أسئلة قصيرة على نفس المهارة، ثم راجع الأخطاء مع ولي الأمر أو المعلم."}
          </p>
          <Link href={`/parent/report/${token}`} className="mt-4 inline-flex rounded-xl border border-[#159f91]/30 bg-white px-5 py-3 text-sm font-extrabold text-[#159f91]">
            الرجوع للتقرير
          </Link>
        </div>
      </section>
    </main>
  );
}
