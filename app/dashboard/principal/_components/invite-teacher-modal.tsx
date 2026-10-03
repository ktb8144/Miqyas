"use client";

import { gradeLabel } from "@/lib/labels";
import type { PrincipalDashboardState } from "../_lib/use-principal-dashboard";

const SUBJECTS = ["رياضيات", "قراءة", "علوم", "أخرى"];
const inputClass =
  "w-full rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-brand/40 focus:bg-white";

export function InviteTeacherModal({ d }: { d: PrincipalDashboardState }) {
  const {
    report,
    setInviteOpen,
    inviteName,
    setInviteName,
    invitePhone,
    setInvitePhone,
    inviteEmail,
    setInviteEmail,
    inviteSubject,
    setInviteSubject,
    inviteClassIds,
    setInviteClassIds,
    inviteLoading,
    inviteMessage,
    inviteTeacher,
  } = d;

  // Show the chosen subject's classes first; fall back to all classes.
  const allClasses = report?.classes ?? [];
  const subjectClasses = inviteSubject ? allClasses.filter((c) => c.subject === inviteSubject) : [];
  const classes = subjectClasses.length ? subjectClasses : allClasses;

  const toggleClass = (id: string) =>
    setInviteClassIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" dir="rtl">
      <form
        onSubmit={inviteTeacher}
        className="flex max-h-[100dvh] w-full max-w-md flex-col rounded-t-[1.5rem] bg-white shadow-2xl sm:max-h-[92vh] sm:rounded-[1.5rem]"
      >
        <div className="flex items-center justify-between px-5 pb-2 pt-5">
          <h2 className="text-lg font-black text-brand-navy">إضافة معلم</h2>
          <button
            type="button"
            onClick={() => setInviteOpen(false)}
            aria-label="إغلاق"
            className="flex h-9 w-9 items-center justify-center rounded-full text-2xl text-slate-400 hover:bg-slate-50"
          >
            ×
          </button>
        </div>

        <div className="min-h-0 space-y-3 overflow-y-auto px-5 pb-2">
          {inviteMessage && (
            <div role="alert" className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-danger">
              {inviteMessage}
            </div>
          )}
          <input
            required
            value={inviteName}
            onChange={(event) => setInviteName(event.target.value)}
            placeholder="اسم المعلم"
            aria-label="اسم المعلم"
            className={inputClass}
          />
          <input
            required
            type="email"
            dir="ltr"
            value={inviteEmail}
            onChange={(event) => setInviteEmail(event.target.value)}
            placeholder="البريد الإلكتروني (تُرسل إليه الدعوة)"
            aria-label="البريد الإلكتروني"
            className={`${inputClass} text-right placeholder:text-right`}
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              value={invitePhone}
              inputMode="tel"
              dir="ltr"
              onChange={(event) => setInvitePhone(event.target.value)}
              placeholder="الجوال (اختياري)"
              aria-label="رقم الجوال (اختياري)"
              className={`${inputClass} text-right placeholder:text-right`}
            />
            <select
              value={inviteSubject}
              onChange={(event) => setInviteSubject(event.target.value)}
              aria-label="المادة"
              className={inputClass}
            >
              <option value="">المادة</option>
              {SUBJECTS.map((subject) => (
                <option key={subject} value={subject}>{subject}</option>
              ))}
            </select>
          </div>

          {classes.length > 0 && (
            <fieldset>
              <legend className="mb-2 text-xs font-black text-slate-500">
                فصوله <span className="font-bold text-slate-400">(اختياري، يمكن إسنادها لاحقًا)</span>
              </legend>
              <div className="flex max-h-28 flex-wrap gap-2 overflow-y-auto">
                {classes.map((classItem) => {
                  const selected = inviteClassIds.includes(classItem.id);
                  return (
                    <button
                      key={classItem.id}
                      type="button"
                      onClick={() => toggleClass(classItem.id)}
                      aria-pressed={selected}
                      className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                        selected ? "border-brand bg-brand text-white" : "border-slate-200 bg-white text-slate-600 hover:border-brand/40"
                      }`}
                    >
                      {classItem.grade ? `${gradeLabel(classItem.grade)} ` : ""}
                      {classItem.name}
                      {!subjectClasses.length && classItem.subject ? ` · ${classItem.subject}` : ""}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          )}
        </div>

        <div className="px-5 pt-3" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 1.25rem)" }}>
          <button disabled={inviteLoading} className="w-full rounded-xl bg-brand py-3.5 text-sm font-extrabold text-white disabled:opacity-60">
            {inviteLoading ? "جارٍ إرسال الدعوة..." : "إرسال الدعوة"}
          </button>
        </div>
      </form>
    </div>
  );
}
