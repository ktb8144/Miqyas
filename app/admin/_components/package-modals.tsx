"use client";

import { useState } from "react";
import { toEnglishDigits } from "@/lib/format";
import { ANSWER_KEY_JSON_EXAMPLE, validateAnswerKeyJson } from "../_lib/answer-key";
import type {
  AdminAssessmentPackage,
  AdminSchool,
  AnswerKeyValidationResult,
  PackageFormData,
  PackageSubmitData,
} from "../_lib/types";
import { EmptyState } from "./ui";

export function PackageModal({
  initialValues,
  onClose,
  onSubmit,
}: {
  initialValues?: AdminAssessmentPackage | null;
  onClose: () => void;
  onSubmit: (payload: PackageSubmitData) => Promise<void>;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [questionsPdfFile, setQuestionsPdfFile] = useState<File | null>(null);
  const [answerKeyJson, setAnswerKeyJson] = useState("");
  const [answerKeyValidation, setAnswerKeyValidation] = useState<AnswerKeyValidationResult | null>(null);
  const [answerKeyValidationError, setAnswerKeyValidationError] = useState<string | null>(null);

  function handleValidateAnswerKey() {
    try {
      const result = validateAnswerKeyJson(answerKeyJson);
      setAnswerKeyValidation(result);
      setAnswerKeyValidationError(null);
    } catch (err) {
      setAnswerKeyValidation(null);
      setAnswerKeyValidationError(err instanceof Error ? err.message : "صيغة JSON غير صحيحة.");
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const payload = Object.fromEntries(formData.entries()) as PackageFormData;
    try {
      setSubmitting(true);
      setError(null);
      const trimmedAnswerKey = answerKeyJson.trim();
      if (trimmedAnswerKey) {
        validateAnswerKeyJson(trimmedAnswerKey);
      }
      await onSubmit({ ...payload, questions_pdf_file: questionsPdfFile } as PackageSubmitData);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر حفظ الحزمة");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-navy/40 px-4" dir="rtl">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-[1.5rem] border border-slate-100 bg-white p-6 shadow-[0_22px_70px_rgba(15,35,55,0.14)]">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-black text-brand-navy">{initialValues ? "تعديل حزمة اختبار" : "إنشاء حزمة اختبار"}</h2>
          <button onClick={onClose} className="rounded-xl px-3 py-1 text-xl font-bold text-slate-400 hover:bg-slate-50">×</button>
        </div>
        {error && <div className="mb-4 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</div>}
        <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
          <label className="md:col-span-2">
            <span className="mb-2 block text-sm font-extrabold text-slate-500">عنوان الحزمة</span>
            <input name="title" required defaultValue={initialValues?.title ?? ""} className="w-full rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-bold text-brand-navy outline-none focus:border-brand/40 focus:bg-white" />
          </label>
          <label className="md:col-span-2">
            <span className="mb-2 block text-sm font-extrabold text-slate-500">الوصف</span>
            <textarea name="description" rows={3} defaultValue={initialValues?.description ?? ""} className="w-full rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-bold text-brand-navy outline-none focus:border-brand/40 focus:bg-white" />
          </label>
          <label>
            <span className="mb-2 block text-sm font-extrabold text-slate-500">المادة</span>
            <select name="subject" defaultValue={initialValues?.subject ?? "رياضيات"} className="w-full rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-bold text-brand-navy outline-none focus:border-brand/40 focus:bg-white">
              <option value="رياضيات">رياضيات</option>
              <option value="لغة عربية">لغة عربية</option>
              <option value="علوم">علوم</option>
            </select>
          </label>
          <label>
            <span className="mb-2 block text-sm font-extrabold text-slate-500">الصف</span>
            <select name="grade" defaultValue={String(initialValues?.grade ?? 6)} className="w-full rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-bold text-brand-navy outline-none focus:border-brand/40 focus:bg-white">
              {[3, 4, 5, 6].map((grade) => <option key={grade} value={grade}>{toEnglishDigits(grade)}</option>)}
            </select>
          </label>
          <label>
            <span className="mb-2 block text-sm font-extrabold text-slate-500">رقم الأسبوع</span>
            <input name="week_number" type="number" min={1} defaultValue={initialValues?.week_number ?? ""} className="w-full rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-bold text-brand-navy outline-none focus:border-brand/40 focus:bg-white" />
          </label>
          <label>
            <span className="mb-2 block text-sm font-extrabold text-slate-500">رقم النموذج</span>
            <input name="assessment_code" defaultValue={initialValues?.assessment_code ?? ""} placeholder="مثال: M4-W03-A" className="w-full rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-bold text-brand-navy outline-none focus:border-brand/40 focus:bg-white" />
          </label>
          <label>
            <span className="mb-2 block text-sm font-extrabold text-slate-500">نوع الحزمة</span>
            <select name="package_type" defaultValue={initialValues?.package_type ?? "weekly"} className="w-full rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-bold text-brand-navy outline-none focus:border-brand/40 focus:bg-white">
              <option value="weekly">أسبوعي</option>
              <option value="diagnostic">تشخيصي</option>
              <option value="nafs_simulation">محاكاة نافس</option>
            </select>
          </label>
          <label>
            <span className="mb-2 block text-sm font-extrabold text-slate-500">مدة الاختبار بالدقائق</span>
            <input name="duration_minutes" type="number" min={1} defaultValue={initialValues?.duration_minutes ?? ""} className="w-full rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-bold text-brand-navy outline-none focus:border-brand/40 focus:bg-white" />
          </label>
          <label>
            <span className="mb-2 block text-sm font-extrabold text-slate-500">تاريخ البداية</span>
            <input name="start_date" type="date" defaultValue={initialValues?.start_date ?? ""} className="w-full rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-bold text-brand-navy outline-none focus:border-brand/40 focus:bg-white" />
          </label>
          <label>
            <span className="mb-2 block text-sm font-extrabold text-slate-500">تاريخ النهاية</span>
            <input name="end_date" type="date" defaultValue={initialValues?.end_date ?? ""} className="w-full rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-bold text-brand-navy outline-none focus:border-brand/40 focus:bg-white" />
          </label>
          <label className="md:col-span-2">
            <span className="mb-2 block text-sm font-extrabold text-slate-500">ملف الأسئلة PDF</span>
            <input
              type="file"
              accept="application/pdf"
              onChange={(event) => setQuestionsPdfFile(event.target.files?.[0] ?? null)}
              className="w-full rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-bold text-brand-navy outline-none focus:border-brand/40 focus:bg-white"
            />
            {initialValues?.questions_pdf_url || initialValues?.student_pdf_url ? (
              <a
                href={initialValues.questions_pdf_url ?? initialValues.student_pdf_url ?? ""}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex text-xs font-extrabold text-brand"
              >
                عرض الملف الحالي
              </a>
            ) : null}
          </label>
          <label className="md:col-span-2">
            <span className="mb-2 block text-sm font-extrabold text-slate-500">رابط ملف الأسئلة PDF</span>
            <input name="questions_pdf_url" type="url" defaultValue={initialValues?.questions_pdf_url ?? initialValues?.student_pdf_url ?? ""} className="w-full rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-bold text-brand-navy outline-none focus:border-brand/40 focus:bg-white" />
          </label>
          <label className="md:col-span-2">
            <span className="mb-2 block text-sm font-extrabold text-slate-500">رابط ورقة الإجابة PDF اختياري</span>
            <input name="answer_sheet_pdf_url" type="url" defaultValue={initialValues?.answer_sheet_pdf_url ?? ""} className="w-full rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-bold text-brand-navy outline-none focus:border-brand/40 focus:bg-white" />
          </label>
          <section className="md:col-span-2 rounded-2xl border border-brand/15 bg-brand/[0.04] p-4">
            <div className="mb-3">
              <h3 className="text-base font-black text-brand-navy">مفتاح الإجابة والمهارات</h3>
              <p className="mt-1 text-xs font-bold leading-6 text-slate-500">
                ألصق مفتاح الإجابة بصيغة JSON. سيتم حفظه للأدمن فقط وتحويله إلى أسئلة وخيارات للتصحيح الآلي من السيرفر.
              </p>
            </div>
            <label>
              <span className="mb-2 block text-sm font-extrabold text-slate-500">مفتاح الإجابة والمهارات بصيغة JSON</span>
              <textarea
                name="answer_key_json"
                rows={10}
                value={answerKeyJson}
                onChange={(event) => {
                  setAnswerKeyJson(event.target.value);
                  setAnswerKeyValidation(null);
                  setAnswerKeyValidationError(null);
                }}
                placeholder={ANSWER_KEY_JSON_EXAMPLE}
                className="w-full rounded-xl border border-slate-100 bg-white px-4 py-3 font-mono text-xs font-bold leading-6 text-brand-navy outline-none focus:border-brand/40"
              />
            </label>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleValidateAnswerKey}
                className="rounded-xl border border-brand/25 bg-white px-4 py-2 text-xs font-extrabold text-brand"
              >
                التحقق من JSON
              </button>
              {answerKeyValidation ? (
                <span className="text-xs font-extrabold text-brand">
                  تم التحقق من {toEnglishDigits(answerKeyValidation.count)} سؤال
                </span>
              ) : null}
              {answerKeyValidationError ? (
                <span className="text-xs font-extrabold text-rose-600">{answerKeyValidationError}</span>
              ) : null}
            </div>
            {answerKeyValidation?.summary.length ? (
              <div className="mt-3 rounded-xl border border-emerald-100 bg-white px-4 py-3">
                <p className="mb-2 text-xs font-black text-brand-navy">ملخص المفتاح</p>
                <div className="space-y-1 text-xs font-bold text-slate-600">
                  {answerKeyValidation.summary.slice(0, 8).map((item) => (
                    <p key={item}>{item}</p>
                  ))}
                  {answerKeyValidation.summary.length > 8 ? (
                    <p className="text-slate-400">و{toEnglishDigits(answerKeyValidation.summary.length - 8)} أسئلة أخرى...</p>
                  ) : null}
                </div>
              </div>
            ) : null}
            <details className="mt-3 rounded-xl border border-slate-100 bg-white px-4 py-3">
              <summary className="cursor-pointer text-xs font-black text-slate-500">مثال على الصيغة المطلوبة</summary>
              <pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-left font-mono text-xs leading-6 text-slate-600" dir="ltr">
                {ANSWER_KEY_JSON_EXAMPLE}
              </pre>
            </details>
          </section>
          <label className="md:col-span-2">
            <span className="mb-2 block text-sm font-extrabold text-slate-500">خيار متقدم: رابط ملف مفتاح الإجابة والمهارات اختياري</span>
            <input name="answer_key_file_url" type="url" defaultValue={initialValues?.answer_key_file_url ?? ""} className="w-full rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-bold text-brand-navy outline-none focus:border-brand/40 focus:bg-white" />
          </label>
          <div className="flex gap-3 md:col-span-2">
            <button disabled={submitting} className="flex-1 rounded-xl bg-brand px-5 py-3 text-sm font-extrabold text-white disabled:opacity-60">
              {submitting ? "جارٍ الحفظ..." : "حفظ الحزمة"}
            </button>
            <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-extrabold text-slate-500">إلغاء</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function QuestionImportModal({
  assessmentPackage,
  onClose,
  onSubmit,
}: {
  assessmentPackage: AdminAssessmentPackage;
  onClose: () => void;
  onSubmit: (jsonText: string) => Promise<void>;
}) {
  const [text, setText] = useState("");
  const [validation, setValidation] = useState<AnswerKeyValidationResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleValidate() {
    try {
      setValidation(validateAnswerKeyJson(text));
      setError(null);
    } catch (err) {
      setValidation(null);
      setError(err instanceof Error ? err.message : "صيغة JSON غير صحيحة.");
    }
  }

  async function handleSubmit() {
    try {
      setSubmitting(true);
      setError(null);
      validateAnswerKeyJson(text);
      await onSubmit(text);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر استيراد الأسئلة");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-navy/40 px-4" dir="rtl">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-[1.5rem] border border-slate-100 bg-white p-6 shadow-[0_22px_70px_rgba(15,35,55,0.14)]">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-brand-navy">استيراد مفتاح الإجابة</h2>
            <p className="mt-1 text-sm font-bold text-slate-400">{assessmentPackage.title}</p>
          </div>
          <button onClick={onClose} className="rounded-xl px-3 py-1 text-xl font-bold text-slate-400 hover:bg-slate-50">×</button>
        </div>
        {error && <div className="mb-4 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</div>}
        <div className="mb-3 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-bold leading-7 text-amber-700">
          ألصق مفتاح الإجابة والمهارات بصيغة JSON العربية البسيطة. لا نحتاج UUID للمهارة أو المجال في هذه المرحلة. هذه البيانات تحتوي مفتاح الإجابة ولا تظهر للمعلم أو قائد المدرسة.
        </div>
        <textarea
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setValidation(null);
          }}
          rows={16}
          dir="ltr"
          placeholder={ANSWER_KEY_JSON_EXAMPLE}
          className="w-full rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 font-mono text-sm text-brand-navy outline-none focus:border-brand/40 focus:bg-white"
        />
        {validation ? (
          <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-bold leading-7 text-emerald-700">
            <p>تم التحقق من {toEnglishDigits(validation.count)} سؤال.</p>
            {validation.summary.slice(0, 6).map((item) => (
              <p key={item}>{item}</p>
            ))}
          </div>
        ) : null}
        <details className="mt-3 rounded-xl border border-slate-100 bg-white px-4 py-3">
          <summary className="cursor-pointer text-xs font-black text-slate-500">مثال على الصيغة المطلوبة</summary>
          <pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-left font-mono text-xs leading-6 text-slate-600" dir="ltr">
            {ANSWER_KEY_JSON_EXAMPLE}
          </pre>
        </details>
        <div className="mt-4 flex gap-3">
          <button onClick={handleValidate} type="button" className="rounded-xl border border-brand/25 bg-white px-5 py-3 text-sm font-extrabold text-brand">
            التحقق من JSON
          </button>
          <button onClick={handleSubmit} disabled={submitting} className="rounded-xl bg-brand px-5 py-3 text-sm font-extrabold text-white disabled:opacity-60">
            {submitting ? "جارٍ الاستيراد..." : "استيراد واستبدال الأسئلة"}
          </button>
          <button onClick={onClose} className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-extrabold text-slate-500">إلغاء</button>
        </div>
      </div>
    </div>
  );
}

export function PublishPackageModal({
  assessmentPackage,
  schools,
  onClose,
  onSubmit,
}: {
  assessmentPackage: AdminAssessmentPackage;
  schools: AdminSchool[];
  onClose: () => void;
  onSubmit: (schoolIds: string[]) => Promise<void>;
}) {
  const activeSchools = schools.filter((school) => school.status !== "موقوفة");
  const [selected, setSelected] = useState<string[]>(activeSchools.map((school) => school.id));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string) {
    setSelected((prev) => prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]);
  }

  async function handleSubmit() {
    try {
      setSubmitting(true);
      setError(null);
      await onSubmit(selected);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر نشر الحزمة");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-navy/40 px-4" dir="rtl">
      <div className="w-full max-w-xl rounded-[1.5rem] border border-slate-100 bg-white p-6 shadow-[0_22px_70px_rgba(15,35,55,0.14)]">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-brand-navy">نشر الحزمة للمدارس</h2>
            <p className="mt-1 text-sm font-bold text-slate-400">{assessmentPackage.title}</p>
          </div>
          <button onClick={onClose} className="rounded-xl px-3 py-1 text-xl font-bold text-slate-400 hover:bg-slate-50">×</button>
        </div>
        {error && <div className="mb-4 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</div>}
        <div className="max-h-72 space-y-2 overflow-y-auto">
          {activeSchools.map((school) => (
            <label key={school.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-bold text-brand-navy">
              <input type="checkbox" checked={selected.includes(school.id)} onChange={() => toggle(school.id)} />
              <span>{school.name}</span>
              <span className="text-slate-400">{school.city}</span>
            </label>
          ))}
          {!activeSchools.length && <EmptyState message="لا توجد مدارس نشطة للنشر." />}
        </div>
        <div className="mt-5 flex gap-3">
          <button onClick={handleSubmit} disabled={submitting || selected.length === 0} className="rounded-xl bg-brand px-5 py-3 text-sm font-extrabold text-white disabled:opacity-60">
            {submitting ? "جارٍ النشر..." : "نشر الحزمة"}
          </button>
          <button onClick={onClose} className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-extrabold text-slate-500">إلغاء</button>
        </div>
      </div>
    </div>
  );
}
