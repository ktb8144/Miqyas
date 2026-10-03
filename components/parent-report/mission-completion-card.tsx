"use client";

import { useMemo, useState } from "react";
import { toEnglishDigits, normalizeSaudiMobile } from "@/lib/format";

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
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [interestSent, setInterestSent] = useState(false);
  const [interestEventId, setInterestEventId] = useState<string | null>(null);
  const [showContactForm, setShowContactForm] = useState(false);
  const [contactSaving, setContactSaving] = useState(false);
  const [whatsappPhone, setWhatsappPhone] = useState("");
  const [relation, setRelation] = useState("ولي أمر");
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [contactSaved, setContactSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [interestMessage, setInterestMessage] = useState<string | null>(null);

  const answeredCount = Object.keys(answers).length;
  const score = questions.reduce((sum, question) => sum + (answers[question.id] === question.correctIndex ? 1 : 0), 0);
  const currentQuestion = questions[currentIndex];
  const selectedAnswer = answers[currentQuestion.id];
  const hasAnsweredCurrent = selectedAnswer !== undefined;
  const progress = Math.round(((currentIndex + (hasAnsweredCurrent ? 1 : 0)) / questions.length) * 100);

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
      const normalizedPhone = normalizeSaudiMobile(whatsappPhone);
      if (!/^05\d{8}$/.test(normalizedPhone)) {
        throw new Error("يرجى إدخال الرقم بصيغة 05xxxxxxxx");
      }
      if (!consentAccepted) {
        throw new Error("يجب الموافقة على استخدام رقم الجوال لهذا الغرض قبل الحفظ");
      }

      const res = await fetch("/api/parent-interest-contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          eventId: interestEventId,
          whatsappPhone: normalizedPhone,
          relation,
          consentAccepted,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) throw new Error(json.error || "تعذر حفظ بيانات التواصل");
      setShowContactForm(false);
      setContactSaved(true);
      setInterestMessage("تم حفظ رقم الجوال بنجاح. سنبلغكم عند توفر خطة التدريب المناسبة لطفلكم.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر حفظ بيانات التواصل");
    } finally {
      setContactSaving(false);
    }
  };

  if (completed) {
    return (
      <div className="rounded-[1.5rem] border border-teal-100 bg-white p-6 text-center shadow-[0_10px_34px_rgba(15,35,55,0.035)]">
        <p className="text-sm font-extrabold text-brand">نتيجة التدريب</p>
        <h2 className="mt-2 text-3xl font-black text-brand-navy">أحسنت يا {studentName}</h2>
        <p className="mt-2 text-sm font-bold text-slate-500">أكملت التدريب المجاني بنجاح</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-slate-50 p-4 text-center">
            <div className="text-2xl font-black text-brand-navy">{toEnglishDigits(`${score}/${questions.length}`)}</div>
            <div className="mt-1 text-xs font-bold text-slate-400">الدرجة</div>
          </div>
          <div className="rounded-xl bg-teal-50 p-4 text-center">
            <div className="text-2xl font-black text-brand">{toEnglishDigits(20)}</div>
            <div className="mt-1 text-xs font-bold text-slate-400">النقاط المكتسبة</div>
          </div>
          <div className="rounded-xl bg-amber-50 p-4 text-center">
            <div className="text-sm font-black text-warning">{skillName}</div>
            <div className="mt-1 text-xs font-bold text-slate-400">المهارة</div>
          </div>
        </div>
        {interestMessage && (
          <div className="mt-4 rounded-xl border border-teal-100 bg-teal-50 p-3 text-sm font-bold text-brand">
            {interestMessage}
          </div>
        )}
        {error && <div className="mt-4 rounded-xl border border-red-100 bg-red-50 p-3 text-sm font-bold text-red-700">{error}</div>}
        {showContactForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-navy/40 px-4 text-right" dir="rtl">
          <div className="w-full max-w-lg rounded-[1.25rem] border border-slate-100 bg-white p-5 shadow-[0_22px_70px_rgba(15,35,55,0.14)]">
            <h3 className="text-lg font-black text-brand-navy">تم تسجيل اهتمامك ✅</h3>
            <p className="mt-2 text-sm font-bold leading-7 text-slate-500">
              هل ترغب أن نبلغك عند تفعيل خطة التدريب الشهرية؟ يمكنك ترك رقم الجوال اختياريًا.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-bold text-slate-500">
                رقم الجوال للواتساب
                <input
                  value={whatsappPhone}
                  onChange={(event) => setWhatsappPhone(event.target.value)}
                  placeholder="05xxxxxxxx"
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-brand-navy outline-none transition focus:border-brand"
                />
              </label>
              <label className="text-sm font-bold text-slate-500">
                صفة ولي الأمر
                <select
                  value={relation}
                  onChange={(event) => setRelation(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-brand-navy outline-none transition focus:border-brand"
                >
                  <option>أب</option>
                  <option>أم</option>
                  <option>ولي أمر</option>
                </select>
              </label>
            </div>
            <label className="mt-4 flex items-start gap-3 rounded-xl bg-white p-3 text-sm font-bold leading-7 text-slate-600">
              <input
                type="checkbox"
                checked={consentAccepted}
                onChange={(event) => setConsentAccepted(event.target.checked)}
                className="mt-1 h-4 w-4 accent-brand"
              />
              <span>أوافق على استخدام رقم الجوال للتواصل معي بخصوص خطة التدريب الإضافية في دالة لهذا الطالب فقط.</span>
            </label>
            <p className="mt-3 text-xs font-bold leading-6 text-slate-400">
              لن نستخدم رقم الجوال إلا للتواصل معكم بخصوص خطة التدريب الإضافية في دالة، ويمكنكم طلب حذفه لاحقًا.
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <button
                onClick={saveContact}
                disabled={contactSaving}
                className="flex-1 rounded-xl bg-brand px-5 py-3 text-sm font-extrabold text-white transition hover:bg-brand-dark disabled:opacity-50"
              >
                {contactSaving ? "جارٍ الحفظ..." : "حفظ بيانات التواصل"}
              </button>
              <button
                onClick={() => {
                  setShowContactForm(false);
                  setInterestMessage("شكرًا لكم، سيتم تفعيل خطة التدريب الشهرية قريبًا.");
                }}
                disabled={contactSaving}
                className="flex-1 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-extrabold text-slate-600 transition hover:border-brand/40 hover:text-brand disabled:opacity-50"
              >
                ليس الآن
              </button>
            </div>
          </div>
          </div>
        )}
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <a
            href={`/parent/report/${token}`}
            className={`${contactSaved ? "w-full" : "flex-1"} rounded-xl bg-brand px-5 py-3 text-center text-sm font-extrabold text-white transition hover:bg-brand-dark`}
          >
            العودة للتقرير
          </a>
          {!contactSaved && (
            <button
              onClick={() => interestSent ? setShowContactForm(true) : registerInterest()}
              disabled={saving}
              className="flex-1 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-extrabold text-slate-600 transition hover:border-brand/40 hover:text-brand disabled:opacity-50"
            >
              {interestSent ? "تم تسجيل الاهتمام" : "أريد تدريبات أكثر لطفلي"}
            </button>
          )}
        </div>
        {interestSent && !contactSaved && !showContactForm && (
          <button
            onClick={() => setShowContactForm(true)}
            className="mt-3 text-xs font-extrabold text-brand underline underline-offset-4"
          >
            أضف رقم الجوال للتحديثات
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-[1.5rem] border border-slate-100 bg-white p-5 shadow-[0_10px_34px_rgba(15,35,55,0.035)]">
      <div className="mb-5">
        <div className="flex items-center justify-between text-sm font-bold text-slate-400">
          <span>السؤال {toEnglishDigits(currentIndex + 1)} من {toEnglishDigits(questions.length)}</span>
          <span>{toEnglishDigits(progress)}٪</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-5">
        <p className="text-lg font-black leading-8 text-brand-navy">{currentQuestion.prompt}</p>
        <div className="mt-4 grid gap-2">
          {currentQuestion.options.map((option, optionIndex) => {
            const selected = selectedAnswer === optionIndex;
            const correct = currentQuestion.correctIndex === optionIndex;
            return (
              <button
                key={option}
                onClick={() => setAnswers((prev) => ({ ...prev, [currentQuestion.id]: optionIndex }))}
                disabled={hasAnsweredCurrent}
                className={`rounded-xl border px-4 py-3 text-right text-sm font-bold transition ${
                  selected && correct
                    ? "border-brand bg-teal-50 text-brand"
                    : selected && !correct
                      ? "border-amber-200 bg-amber-50 text-amber-700"
                      : "border-slate-100 bg-white text-slate-600 hover:border-brand/40"
                } disabled:cursor-default`}
              >
                {option}
              </button>
            );
          })}
        </div>
      </div>

      {hasAnsweredCurrent && (
        <div className={`mt-4 rounded-xl p-3 text-sm font-bold ${selectedAnswer === currentQuestion.correctIndex ? "bg-teal-50 text-brand" : "bg-amber-50 text-amber-700"}`}>
          {selectedAnswer === currentQuestion.correctIndex ? "إجابة موفقة. تابع للسؤال التالي." : "محاولة جيدة. ركّز على المطلوب من السؤال ثم تابع."}
        </div>
      )}

      {error && <div className="mt-4 rounded-xl border border-red-100 bg-red-50 p-3 text-sm font-bold text-red-700">{error}</div>}
      {completed && (
        <div className="mt-4 rounded-xl border border-teal-100 bg-teal-50 p-3 text-sm font-bold text-brand">
          تم إكمال التدريب. نتيجتك: {toEnglishDigits(`${score}/${questions.length}`)}
        </div>
      )}

      <button
        onClick={() => {
          if (currentIndex < questions.length - 1) {
            setCurrentIndex((value) => value + 1);
          } else {
            void complete();
          }
        }}
        disabled={!hasAnsweredCurrent || saving || completed}
        className="mt-5 w-full rounded-xl bg-brand px-5 py-3 text-sm font-extrabold text-white transition hover:bg-brand-dark disabled:opacity-50"
      >
        {saving ? "جارٍ الحفظ..." : currentIndex === questions.length - 1 ? "إكمال التدريب" : "السؤال التالي"}
      </button>
    </div>
  );
}
