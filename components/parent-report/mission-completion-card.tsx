"use client";

import { useMemo, useState } from "react";
import { toEnglishDigits } from "@/lib/format";

type MissionQuestion = {
  id: string;
  prompt: string;
  options: string[];
  correctIndex: number;
};

export function MissionCompletionCard({
  token,
  skillName,
  studentName,
}: {
  token: string;
  skillName: string;
  studentName: string;
}) {
  const questions = useMemo<MissionQuestion[]>(() => [
    {
      id: "q1",
      prompt: "ما أول خطوة تساعدك على فهم السؤال؟",
      options: ["اختيار أول إجابة", "قراءة السؤال وتحديد المطلوب", "تخمين الإجابة", "ترك السؤال"],
      correctIndex: 1,
    },
    {
      id: "q2",
      prompt: "إذا وجدت خيارين متشابهين، ماذا تفعل؟",
      options: ["أراجع المطلوب وأقارن بهدوء", "أختار الأسرع", "أتركهما", "أحذف الإجابة الصحيحة"],
      correctIndex: 0,
    },
    {
      id: "q3",
      prompt: "كيف تعرف أن إجابتك مناسبة؟",
      options: ["لأنها طويلة", "لأنها تجيب عن المطلوب", "لأنها أول خيار", "لأنها مختلفة"],
      correctIndex: 1,
    },
  ], []);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [interestSent, setInterestSent] = useState(false);
  const [interestEventId, setInterestEventId] = useState<string | null>(null);
  const [showContactForm, setShowContactForm] = useState(false);
  const [contactSaving, setContactSaving] = useState(false);
  const [whatsappPhone, setWhatsappPhone] = useState("");
  const [email, setEmail] = useState("");
  const [relation, setRelation] = useState("ولي أمر");
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [interestMessage, setInterestMessage] = useState<string | null>(null);

  const answeredCount = Object.keys(answers).length;
  const score = questions.reduce((sum, question) => sum + (answers[question.id] === question.correctIndex ? 1 : 0), 0);

  const complete = async () => {
    if (answeredCount !== questions.length) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/parent-report-events/mission-completed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          score,
          totalQuestions: questions.length,
          skillName,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) throw new Error(json.error || "تعذر حفظ إكمال التدريب");
      setCompleted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر حفظ إكمال التدريب");
    } finally {
      setSaving(false);
    }
  };

  const registerInterest = async () => {
    setSaving(true);
    setError(null);
    setInterestMessage(null);
    try {
      const res = await fetch("/api/parent-report-events/mission-completed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          score,
          totalQuestions: questions.length,
          skillName,
          eventType: "subscription_interest",
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) throw new Error(json.error || "تعذر تسجيل الاهتمام");
      setInterestSent(true);
      setInterestEventId(typeof json.eventId === "string" ? json.eventId : null);
      setShowContactForm(true);
      setInterestMessage("تم تسجيل اهتمامكم بالتدريبات الإضافية.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تسجيل الاهتمام");
    } finally {
      setSaving(false);
    }
  };

  const saveContact = async () => {
    setContactSaving(true);
    setError(null);
    setInterestMessage(null);
    try {
      if (!interestEventId) throw new Error("تعذر ربط بيانات التواصل بطلب الاهتمام");
      if (!whatsappPhone.trim() && !email.trim()) {
        throw new Error("أدخل رقم واتساب أو بريدًا إلكترونيًا لحفظ بيانات التواصل");
      }
      if (!consentAccepted) {
        throw new Error("يجب الموافقة على استخدام بيانات التواصل لهذا الغرض قبل الحفظ");
      }

      const res = await fetch("/api/parent-interest-contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          eventId: interestEventId,
          whatsappPhone,
          email,
          relation,
          consentAccepted,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) throw new Error(json.error || "تعذر حفظ بيانات التواصل");
      setShowContactForm(false);
      setInterestMessage("شكرًا لكم، سيتم إشعاركم عند توفر خطة التدريب الشهرية.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر حفظ بيانات التواصل");
    } finally {
      setContactSaving(false);
    }
  };

  if (completed) {
    return (
      <div className="rounded-[1.5rem] border border-teal-100 bg-white p-6 shadow-[0_10px_34px_rgba(15,35,55,0.035)]">
        <p className="text-sm font-extrabold text-[#159f91]">نتيجة التدريب</p>
        <h2 className="mt-2 text-3xl font-black text-[#0b2447]">أحسنت يا {studentName}</h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-slate-50 p-4 text-center">
            <div className="text-2xl font-black text-[#0b2447]">{toEnglishDigits(`${score}/${questions.length}`)}</div>
            <div className="mt-1 text-xs font-bold text-slate-400">الدرجة</div>
          </div>
          <div className="rounded-xl bg-teal-50 p-4 text-center">
            <div className="text-2xl font-black text-[#159f91]">{toEnglishDigits(20)}</div>
            <div className="mt-1 text-xs font-bold text-slate-400">النقاط المكتسبة</div>
          </div>
          <div className="rounded-xl bg-amber-50 p-4 text-center">
            <div className="text-sm font-black text-[#BA7517]">{skillName}</div>
            <div className="mt-1 text-xs font-bold text-slate-400">المهارة</div>
          </div>
        </div>
        <p className="mt-5 rounded-xl bg-slate-50 p-4 text-sm font-bold leading-7 text-slate-600">
          أكمل الطالب التدريب المجاني. يمكنه لاحقًا متابعة خطة تدريب قصيرة حسب مستواه.
        </p>
        {interestMessage && (
          <div className="mt-4 rounded-xl border border-teal-100 bg-teal-50 p-3 text-sm font-bold text-[#159f91]">
            {interestMessage}
          </div>
        )}
        {error && <div className="mt-4 rounded-xl border border-red-100 bg-red-50 p-3 text-sm font-bold text-red-700">{error}</div>}
        {showContactForm && (
          <div className="mt-5 rounded-[1.25rem] border border-slate-100 bg-slate-50/70 p-4">
            <h3 className="text-lg font-black text-[#0b2447]">هل ترغب أن نبلغك عند تفعيل خطة التدريب الشهرية؟</h3>
            <p className="mt-2 text-sm font-bold leading-7 text-slate-500">
              يمكنك ترك رقم الواتساب أو البريد الإلكتروني، وسنستخدمه فقط لإبلاغك عند توفر التدريب الإضافي المناسب لطفلك. إدخال البيانات اختياري.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-bold text-slate-500">
                رقم الواتساب
                <input
                  value={whatsappPhone}
                  onChange={(event) => setWhatsappPhone(event.target.value)}
                  placeholder="05xxxxxxxx أو +9665xxxxxxxx"
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-[#0b2447] outline-none transition focus:border-[#159f91]"
                />
              </label>
              <label className="text-sm font-bold text-slate-500">
                البريد الإلكتروني
                <input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@example.com"
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-[#0b2447] outline-none transition focus:border-[#159f91]"
                />
              </label>
              <label className="text-sm font-bold text-slate-500">
                صفة ولي الأمر
                <select
                  value={relation}
                  onChange={(event) => setRelation(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-[#0b2447] outline-none transition focus:border-[#159f91]"
                >
                  <option>أب</option>
                  <option>أم</option>
                  <option>ولي أمر</option>
                  <option>أخرى</option>
                </select>
              </label>
            </div>
            <label className="mt-4 flex items-start gap-3 rounded-xl bg-white p-3 text-sm font-bold leading-7 text-slate-600">
              <input
                type="checkbox"
                checked={consentAccepted}
                onChange={(event) => setConsentAccepted(event.target.checked)}
                className="mt-1 h-4 w-4 accent-[#159f91]"
              />
              <span>أوافق على استخدام رقم الواتساب أو البريد الإلكتروني للتواصل معي بخصوص خطة التدريب الإضافية في مِقياس لهذا الطالب فقط.</span>
            </label>
            <p className="mt-3 text-xs font-bold leading-6 text-slate-400">
              لن نستخدم هذه البيانات إلا للتواصل معكم بخصوص خطة التدريب الإضافية في مِقياس، ويمكنكم طلب حذفها لاحقًا.
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <button
                onClick={saveContact}
                disabled={contactSaving}
                className="flex-1 rounded-xl bg-[#159f91] px-5 py-3 text-sm font-extrabold text-white transition hover:bg-[#10877b] disabled:opacity-50"
              >
                {contactSaving ? "جارٍ الحفظ..." : "حفظ بيانات التواصل"}
              </button>
              <button
                onClick={() => {
                  setShowContactForm(false);
                  setInterestMessage("شكرًا لكم، سيتم تفعيل خطة التدريب الشهرية قريبًا.");
                }}
                disabled={contactSaving}
                className="flex-1 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-extrabold text-slate-600 transition hover:border-[#159f91]/40 hover:text-[#159f91] disabled:opacity-50"
              >
                تخطي الآن
              </button>
            </div>
          </div>
        )}
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <a
            href={`/parent/report/${token}`}
            className="flex-1 rounded-xl border border-slate-200 bg-white px-5 py-3 text-center text-sm font-extrabold text-slate-600 transition hover:border-[#159f91]/40 hover:text-[#159f91]"
          >
            العودة للتقرير
          </a>
          <button
            onClick={registerInterest}
            disabled={saving || interestSent}
            className="flex-1 rounded-xl bg-[#159f91] px-5 py-3 text-sm font-extrabold text-white transition hover:bg-[#10877b] disabled:opacity-50"
          >
            {interestSent ? "تم تسجيل الاهتمام" : "أريد تدريبات أكثر لطفلي"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[1.5rem] border border-slate-100 bg-white p-5 shadow-[0_10px_34px_rgba(15,35,55,0.035)]">
      <h2 className="text-xl font-black text-[#0b2447]">أسئلة تدريب قصيرة</h2>
      <p className="mt-2 text-sm font-bold text-slate-500">
        أجب عن الأسئلة ثم اضغط إكمال التدريب.
      </p>

      <div className="mt-5 space-y-4">
        {questions.map((question, questionIndex) => (
          <div key={question.id} className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
            <p className="font-black text-[#0b2447]">
              {toEnglishDigits(questionIndex + 1)}. {question.prompt}
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {question.options.map((option, optionIndex) => (
                <button
                  key={option}
                  onClick={() => setAnswers((prev) => ({ ...prev, [question.id]: optionIndex }))}
                  className={`rounded-xl border px-3 py-2 text-right text-sm font-bold transition ${
                    answers[question.id] === optionIndex
                      ? "border-[#159f91] bg-teal-50 text-[#159f91]"
                      : "border-slate-100 bg-white text-slate-600 hover:border-[#159f91]/40"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {error && <div className="mt-4 rounded-xl border border-red-100 bg-red-50 p-3 text-sm font-bold text-red-700">{error}</div>}
      {completed && (
        <div className="mt-4 rounded-xl border border-teal-100 bg-teal-50 p-3 text-sm font-bold text-[#159f91]">
          تم إكمال التدريب. نتيجتك: {toEnglishDigits(`${score}/${questions.length}`)}
        </div>
      )}

      <button
        onClick={complete}
        disabled={answeredCount !== questions.length || saving || completed}
        className="mt-5 w-full rounded-xl bg-[#159f91] px-5 py-3 text-sm font-extrabold text-white transition hover:bg-[#10877b] disabled:opacity-50"
      >
        {saving ? "جارٍ الحفظ..." : completed ? "تم إكمال التدريب" : "إكمال التدريب"}
      </button>
    </div>
  );
}
