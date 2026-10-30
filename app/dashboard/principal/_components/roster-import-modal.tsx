"use client";

import { useMemo, useRef, useState } from "react";
import { toEnglishDigits } from "@/lib/format";
import { gradeLabel } from "@/lib/labels";
import { normalizeSubject } from "@/lib/subjects";
import { detectRoster, gradeFromSection, type RosterDetection } from "@/lib/import/roster";

const SUBJECTS = ["رياضيات", "لغة عربية", "علوم"] as const;
type Subject = (typeof SUBJECTS)[number];

type Teacher = { id: string; name: string; subject: string; status: string };

type SectionPlan = {
  key: string;
  className: string;
  /** null until the principal picks it, when the file doesn't say which grade a section is. */
  grade: number | null;
  names: string[];
  teachers: Record<Subject, string>;
};

type Summary = Array<{ className: string; subject: string; created: boolean; added: number; duplicates: number }>;

function defaultTeacher(teachers: Teacher[], subject: Subject) {
  const matching = teachers.filter((teacher) => normalizeSubject(teacher.subject) === subject);
  return matching.length === 1 ? matching[0].id : "";
}

/** Principal: upload a Noor list once, give each class its subject teachers, and Dala creates the classes and students. */
export function RosterImportModal({
  teachers,
  onClose,
  onDone,
}: {
  teachers: Teacher[];
  onClose: () => void;
  onDone: () => Promise<void> | void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [detection, setDetection] = useState<RosterDetection | null>(null);
  const [plans, setPlans] = useState<SectionPlan[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);

  const entriesCount = useMemo(
    () => plans.reduce((sum, plan) => sum + SUBJECTS.filter((subject) => plan.teachers[subject] && !(plan.grade === 3 && subject === "علوم")).length, 0),
    [plans]
  );

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const sheets = await (await import("@/lib/import/table-file")).readTableFile(file);
      const best = sheets
        .map((sheet) => detectRoster(sheet.rows))
        .filter((item): item is RosterDetection => Boolean(item))
        .sort((a, b) => b.rows.length - a.rows.length)[0];
      if (!best) throw new Error("لم نجد عمود أسماء الطلاب في الملف. تأكد أن فيه عمودًا عنوانه «اسم الطالب».");
      const sections = best.sections.length ? best.sections : [""];
      setDetection(best);
      setPlans(
        sections.map((section) => ({
          key: section || "all",
          className: section || "",
          grade: gradeFromSection(section),
          names: best.rows.filter((row) => row.section === section).map((row) => row.name),
          teachers: {
            "رياضيات": defaultTeacher(teachers, "رياضيات"),
            "لغة عربية": defaultTeacher(teachers, "لغة عربية"),
            "علوم": defaultTeacher(teachers, "علوم"),
          },
        }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر قراءة الملف");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const updatePlan = (key: string, patch: Partial<SectionPlan>) =>
    setPlans((prev) => prev.map((plan) => (plan.key === key ? { ...plan, ...patch } : plan)));

  const submit = async () => {
    setError(null);
    const classes = plans.flatMap((plan) =>
      SUBJECTS.filter((subject) => plan.teachers[subject] && !(plan.grade === 3 && subject === "علوم")).map((subject) => ({
        name: plan.className.trim(),
        grade: plan.grade,
        subject,
        teacherId: plan.teachers[subject],
        names: plan.names,
      }))
    );
    if (!classes.length) return setError("اختر معلمًا لمادة واحدة على الأقل.");
    if (classes.some((entry) => !entry.name)) return setError("اكتب اسم كل فصل (مثل ٦/١).");
    if (classes.some((entry) => !entry.grade)) return setError("اختر صف كل فصل؛ الملف لا يحدد الصف لبعض الفصول.");
    setBusy(true);
    try {
      const res = await fetch("/api/principal/roster-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classes }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) throw new Error(json.error || "تعذر الاستيراد");
      setSummary(json.summary as Summary);
      await onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر الاستيراد");
    } finally {
      setBusy(false);
    }
  };

  const activeTeachers = teachers;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" dir="rtl">
      <div className="max-h-[92dvh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-100 bg-white p-5">
          <div>
            <h2 className="text-lg font-black text-brand-navy">استيراد الفصول والطلاب من نور</h2>
            <p className="text-xs font-bold text-slate-400">يُقرأ الملف في جهازك، ونحفظ الأسماء وترتيبها فقط.</p>
          </div>
          <button onClick={onClose} className="text-2xl leading-none text-slate-400 hover:text-slate-600" aria-label="إغلاق">×</button>
        </div>

        <div className="space-y-4 p-5">
          {error && <p role="alert" className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}

          {summary ? (
            <div className="space-y-3">
              <p className="font-black text-brand-navy">تم الاستيراد ✓</p>
              <ul className="space-y-1 text-sm font-bold text-slate-600">
                {summary.map((item, index) => (
                  <li key={index}>
                    {item.className} · {item.subject}: {item.created ? "فصل جديد" : "فصل موجود"}، أُضيف {toEnglishDigits(item.added)} طالب
                    {item.duplicates ? ` (وتُجوهل ${toEnglishDigits(item.duplicates)} مكرر)` : ""}
                  </li>
                ))}
              </ul>
              <p className="text-xs font-bold text-slate-400">رقم كل طالب في ورقة الإجابة هو ترتيبه في الكشف.</p>
              <button onClick={onClose} className="rounded-xl bg-brand px-5 py-2.5 text-sm font-extrabold text-white">تم</button>
            </div>
          ) : !detection ? (
            <div className="rounded-xl border-2 border-dashed border-slate-200 p-6 text-center">
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv,.txt"
                className="hidden"
                onChange={(event) => void handleFile(event.target.files?.[0])}
              />
              <p className="mb-1 font-black text-brand-navy">ارفع كشف الطلاب من نور</p>
              <p className="mb-4 text-xs font-bold text-slate-400">xlsx أو CSV. فصل واحد أو عدة فصول في ملف واحد. أعمدة الهوية تُتجاهل.</p>
              <button
                onClick={() => fileRef.current?.click()}
                disabled={busy}
                className="rounded-xl bg-brand px-5 py-2.5 text-sm font-extrabold text-white disabled:opacity-60"
              >
                {busy ? "جارٍ قراءة الملف..." : "اختيار الملف"}
              </button>
            </div>
          ) : (
            <>
              <p className="text-sm font-bold text-slate-600">
                وجدنا {toEnglishDigits(detection.rows.length)} طالبًا في {toEnglishDigits(plans.length)} فصل.
                {detection.skippedIdColumns ? ` تجاهلنا ${toEnglishDigits(detection.skippedIdColumns)} عمود أرقام هوية.` : ""}
                {" "}اختر معلم كل مادة لكل فصل؛ اترك الخانة فارغة إن لم تُدرَّس المادة في دالة.
              </p>
              {activeTeachers.length === 0 && (
                <p className="rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-800">أضف المعلمين أولًا من «إضافة معلم»، ثم ارجع للاستيراد.</p>
              )}
              <div className="space-y-3">
                {plans.map((plan) => (
                  <div key={plan.key} className="rounded-xl border border-slate-100 p-3">
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <label className="text-xs font-bold text-slate-500">
                        اسم الفصل
                        <input
                          value={plan.className}
                          onChange={(e) => updatePlan(plan.key, { className: e.target.value })}
                          placeholder="٦/١"
                          className="mr-2 w-28 rounded-lg border border-slate-200 px-2 py-1.5 text-sm font-bold text-brand-navy"
                        />
                      </label>
                      <label className="text-xs font-bold text-slate-500">
                        الصف
                        <select
                          value={plan.grade ?? ""}
                          onChange={(e) => updatePlan(plan.key, { grade: e.target.value ? Number(e.target.value) : null })}
                          className="mr-2 rounded-lg border border-slate-200 px-2 py-1.5 text-sm font-bold text-brand-navy"
                        >
                          {plan.grade === null && <option value="">اختر الصف</option>}
                          {[3, 4, 5, 6].map((g) => <option key={g} value={g}>{gradeLabel(g)}</option>)}
                        </select>
                      </label>
                      <span className="text-xs font-bold text-slate-400">{toEnglishDigits(plan.names.length)} طالب</span>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-3">
                      {SUBJECTS.filter((subject) => !(plan.grade === 3 && subject === "علوم")).map((subject) => (
                        <label key={subject} className="text-xs font-bold text-slate-500">
                          {subject}
                          <select
                            value={plan.teachers[subject]}
                            onChange={(e) => updatePlan(plan.key, { teachers: { ...plan.teachers, [subject]: e.target.value } })}
                            className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm font-bold text-brand-navy"
                          >
                            <option value="">— لا شيء —</option>
                            {activeTeachers.map((teacher) => (
                              <option key={teacher.id} value={teacher.id}>
                                {teacher.name}{teacher.status === "invited" ? " (لم يفعّل)" : ""}
                              </option>
                            ))}
                          </select>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={submit}
                  disabled={busy || entriesCount === 0}
                  className="flex-1 rounded-xl bg-brand py-3 text-sm font-extrabold text-white disabled:opacity-50"
                >
                  {busy ? "جارٍ الاستيراد..." : `استيراد (${toEnglishDigits(entriesCount)} فصل لمعلم)`}
                </button>
                <button onClick={() => { setDetection(null); setPlans([]); }} className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-600">
                  ملف آخر
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
