"use client";

import { useMemo, useRef, useState } from "react";
import { toEnglishDigits } from "@/lib/format";
import { buildStandardTemplate, MAX_SHEET_QUESTIONS } from "@/lib/omr/standard-sheet";
import { readPhoto } from "@/components/omr/read-photo";
import type { AdminAssessmentPackage } from "../_lib/types";

const LETTERS = ["أ", "ب", "ج", "د"] as const;

type Summary = { count: number; updated: number; unchanged: number; inserted: number; extraExisting: number; gradedResults: number };

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(new Error("تعذر فتح الصورة"));
    reader.readAsDataURL(file);
  });
}

/**
 * Admin: build a test's answer key from a model answer sheet.
 * Print a blank sheet, shade the correct answers, photograph it; the sheet is read on this
 * device with the same reader the teachers use, and anything unclear is confirmed by hand.
 */
export function AnswerKeySheetModal({
  assessmentPackage,
  onClose,
  onSaved,
}: {
  assessmentPackage: AdminAssessmentPackage;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}) {
  const [count, setCount] = useState(assessmentPackage.question_count || 10);
  const [answers, setAnswers] = useState<Record<string, string> | null>(null);
  const [flagged, setFlagged] = useState<string[]>([]);
  const [crops, setCrops] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const keys = useMemo(() => Array.from({ length: count }, (_, i) => `q${i + 1}`), [count]);
  const missing = answers ? keys.filter((key) => !LETTERS.includes(answers[key] as (typeof LETTERS)[number])) : keys;

  const handlePhoto = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const base64 = await fileToBase64(file);
      const { reading, crops: readCrops } = await readPhoto(base64, buildStandardTemplate(count, assessmentPackage.id));
      if (!reading.ok) {
        throw new Error(
          reading.reason === "markers_not_found" || reading.reason === "alignment_failed"
            ? `${reading.message} وتأكد أن عدد الأسئلة (${toEnglishDigits(count)}) يطابق الورقة المطبوعة.`
            : reading.reason === "wrong_sheet"
              ? "هذه الورقة مطبوعة لاختبار آخر. اطبع ورقة هذا الاختبار من زر «طباعة ورقة فارغة»."
              : reading.message
        );
      }
      const next: Record<string, string> = {};
      const unclear: string[] = [];
      reading.questions.forEach((group) => {
        if (LETTERS.includes(group.value as (typeof LETTERS)[number])) next[group.key] = group.value;
        else unclear.push(group.key);
      });
      setAnswers(next);
      setFlagged(unclear);
      setCrops(readCrops);
      if (reading.studentCodeDecision === "ok") {
        setNotice(`في الورقة رقم طالب مظلل (${toEnglishDigits(reading.studentCode)}). هل هذه ورقة طالب وليست نموذج الإجابة؟`);
      } else if (unclear.length) {
        setNotice(`قُرئت ${toEnglishDigits(count - unclear.length)} إجابة. حدّد الإجابة يدويًا في ${toEnglishDigits(unclear.length)} سؤال معلّم.`);
      }
    } catch (err) {
      setAnswers(null);
      setError(err instanceof Error ? err.message : "تعذر قراءة الورقة");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const save = async () => {
    if (!answers || missing.length) return;
    setBusy(true);
    setError(null);
    try {
      const payload = Object.fromEntries(keys.map((key) => [key, answers[key]]));
      const res = await fetch(`/api/admin/assessment-packages/${assessmentPackage.id}/answer-key-sheet`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: payload }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) throw new Error(json.error || "تعذر حفظ مفتاح الإجابة");
      setSummary(json.summary as Summary);
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر حفظ مفتاح الإجابة");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-navy/40 px-4" dir="rtl">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-[1.5rem] border border-slate-100 bg-white p-6 shadow-[0_22px_70px_rgba(15,35,55,0.14)]">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-brand-navy">مفتاح الإجابة من ورقة مظللة</h2>
            <p className="mt-1 text-sm font-bold text-slate-400">{assessmentPackage.title}</p>
          </div>
          <button onClick={onClose} className="rounded-xl px-3 py-1 text-xl font-bold text-slate-400 hover:bg-slate-50">×</button>
        </div>

        {error && <p role="alert" className="mb-3 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</p>}

        {summary ? (
          <div className="space-y-2 text-sm font-bold text-slate-600">
            <p className="text-base font-black text-brand">حُفظ مفتاح الإجابة ✓</p>
            <p>
              {toEnglishDigits(summary.count)} سؤالًا: تغيّر {toEnglishDigits(summary.updated)}، وأُضيف {toEnglishDigits(summary.inserted)}، وبقي {toEnglishDigits(summary.unchanged)} كما هو.
            </p>
            {summary.inserted > 0 && <p className="text-amber-700">الأسئلة المضافة بلا مهارة أو مجال. أكملها من «استيراد/تعديل مفتاح الإجابة» ليظهر التشخيص.</p>}
            {summary.extraExisting > 0 && <p className="text-amber-700">في الحزمة {toEnglishDigits(summary.extraExisting)} سؤال بعد السؤال {toEnglishDigits(summary.count)} لم يتغير.</p>}
            {summary.gradedResults > 0 && <p className="text-amber-700">صُححت {toEnglishDigits(summary.gradedResults)} ورقة سابقًا بالمفتاح القديم، ولا يُعاد تصحيحها تلقائيًا.</p>}
            <button onClick={onClose} className="mt-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-extrabold text-white">تم</button>
          </div>
        ) : (
          <>
            <ol className="mb-4 list-decimal space-y-1 pr-5 text-sm font-bold text-slate-600">
              <li>
                عدد الأسئلة:{" "}
                <input
                  type="number"
                  min={1}
                  max={MAX_SHEET_QUESTIONS}
                  value={count}
                  onChange={(e) => {
                    setCount(Math.max(1, Math.min(MAX_SHEET_QUESTIONS, Number(e.target.value) || 1)));
                    setAnswers(null);
                  }}
                  className="mx-1 w-16 rounded-lg border border-slate-200 px-2 py-1 text-center"
                />
                <a
                  href={`/admin/answer-key-sheet/${assessmentPackage.id}?q=${count}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mr-2 text-brand underline"
                >
                  طباعة ورقة فارغة
                </a>
              </li>
              <li>ظلّل الإجابة الصحيحة لكل سؤال، واترك رقم الطالب فارغًا.</li>
              <li>صوّر الورقة كاملة أو ارفع صورتها. تُقرأ هنا في جهازك.</li>
            </ol>

            <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => void handlePhoto(e.target.files?.[0])} />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="mb-4 w-full rounded-xl bg-brand py-3 text-sm font-extrabold text-white disabled:opacity-60"
            >
              {busy ? "جارٍ القراءة..." : answers ? "إعادة التصوير" : "تصوير أو رفع الورقة المظللة"}
            </button>

            {notice && <p className="mb-3 rounded-xl bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">{notice}</p>}

            {answers && (
              <>
                <div className="mb-4 grid gap-2 sm:grid-cols-2">
                  {keys.map((key) => {
                    const isFlagged = flagged.includes(key);
                    return (
                      <div key={key} className={`rounded-xl p-2 ${isFlagged ? "border border-amber-200 bg-amber-50/60" : "bg-slate-50"}`}>
                        {isFlagged && crops[key] && (
                          // eslint-disable-next-line @next/next/no-img-element -- local close-up of the photo
                          <img src={crops[key]} alt="" className="mb-1.5 w-full rounded-lg border border-amber-100 bg-white" />
                        )}
                        <div className="flex items-center gap-1.5">
                          <span className="w-8 text-xs font-black text-slate-500">س{toEnglishDigits(key.slice(1))}</span>
                          {LETTERS.map((letter) => (
                            <button
                              key={letter}
                              onClick={() => setAnswers((prev) => ({ ...(prev ?? {}), [key]: letter }))}
                              className={`h-8 flex-1 rounded-lg border-2 text-sm font-black ${answers[key] === letter ? "border-brand bg-brand text-white" : "border-slate-200 bg-white text-slate-600"}`}
                            >
                              {letter}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <button
                  onClick={save}
                  disabled={busy || missing.length > 0}
                  className="w-full rounded-xl bg-brand-navy py-3 text-sm font-extrabold text-white disabled:opacity-50"
                >
                  {missing.length ? `بقي ${toEnglishDigits(missing.length)} سؤال بلا إجابة` : `حفظ مفتاح الإجابة (${toEnglishDigits(count)} سؤالًا)`}
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
