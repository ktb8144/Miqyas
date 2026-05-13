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

  return (
    <main className="min-h-screen bg-[#f7fafc] px-5 py-8 text-[#0b2447]" dir="rtl">
      <section className="mx-auto max-w-2xl space-y-5">
        <div className="rounded-[1.75rem] border border-slate-100 bg-white p-6 shadow-[0_10px_34px_rgba(15,35,55,0.035)]">
          <p className="text-sm font-extrabold text-[#159f91]">تدريب مجاني قصير</p>
          <h1 className="mt-2 text-3xl font-black">مهمة تدريبية للطالب {student.name}</h1>
          <p className="mt-3 text-sm font-bold leading-7 text-slate-500">
            سؤال واحد في كل مرة، وتغذية راجعة مباشرة بعد كل إجابة.
          </p>
          <div className="mt-4 rounded-xl bg-amber-50 p-4">
            <p className="text-sm font-bold text-slate-500">المهارة المستهدفة</p>
            <h2 className="mt-1 text-xl font-black text-[#BA7517]">{weak.name}</h2>
          </div>
        </div>

        <MissionCompletionCard token={token} skillName={weak.name} studentName={student.name} />
      </section>
    </main>
  );
}
