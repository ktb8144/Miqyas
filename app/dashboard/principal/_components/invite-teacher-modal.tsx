"use client";

import type { PrincipalDashboardState } from "../_lib/use-principal-dashboard";

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
    inviteGrades,
    setInviteGrades,
    inviteClassIds,
    setInviteClassIds,
    inviteLoading,
    inviteMessage,
    inviteTeacher,
  } = d;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form onSubmit={inviteTeacher} className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-[1.5rem] bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-black text-brand-navy">إضافة معلم</h2>
          <button type="button" onClick={() => setInviteOpen(false)} className="text-2xl text-slate-300">×</button>
        </div>
        {inviteMessage && (
          <div className="mb-4 rounded-xl border border-teal-100 bg-teal-50 px-4 py-3 text-sm font-bold text-brand">
            {inviteMessage}
          </div>
        )}
        <div className="space-y-3">
          <input required value={inviteName} onChange={(event) => setInviteName(event.target.value)} placeholder="اسم المعلم" className="w-full rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:bg-white" />
          <input required value={invitePhone} onChange={(event) => setInvitePhone(event.target.value)} placeholder="رقم الجوال/واتساب 05xxxxxxxx" className="w-full rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:bg-white" />
          <select value={inviteSubject} onChange={(event) => setInviteSubject(event.target.value)} className="w-full rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:bg-white">
            <option value="">اختر المادة</option>
            <option value="رياضيات">رياضيات</option>
            <option value="قراءة">قراءة</option>
            <option value="علوم">علوم</option>
            <option value="أخرى">أخرى</option>
          </select>
          <div className="rounded-xl bg-slate-50 p-3">
            <div className="mb-2 text-xs font-black text-slate-500">الصفوف التي يدرسها</div>
            <div className="grid grid-cols-2 gap-2">
              {["الثالث", "الرابع", "الخامس", "السادس"].map((grade) => (
                <label key={grade} className="flex items-center gap-2 text-sm font-bold text-slate-600">
                  <input
                    type="checkbox"
                    checked={inviteGrades.includes(grade)}
                    onChange={() => setInviteGrades((prev) => prev.includes(grade) ? prev.filter((item) => item !== grade) : [...prev, grade])}
                    className="accent-brand"
                  />
                  {grade}
                </label>
              ))}
            </div>
          </div>
          {report?.classes.length ? (
            <div className="rounded-xl bg-slate-50 p-3">
              <div className="mb-2 text-xs font-black text-slate-500">الفصول المسندة</div>
              <div className="max-h-36 space-y-2 overflow-y-auto">
                {report.classes.map((classItem) => (
                  <label key={classItem.id} className="flex items-center gap-2 text-sm font-bold text-slate-600">
                    <input
                      type="checkbox"
                      checked={inviteClassIds.includes(classItem.id)}
                      onChange={() => setInviteClassIds((prev) => prev.includes(classItem.id) ? prev.filter((item) => item !== classItem.id) : [...prev, classItem.id])}
                      className="accent-brand"
                    />
                    {classItem.name} · {classItem.subject}
                  </label>
                ))}
              </div>
            </div>
          ) : null}
          <input type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="البريد الإلكتروني لإنشاء حساب الدخول" className="w-full rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:bg-white" />
          <p className="rounded-xl bg-amber-50 px-4 py-3 text-xs font-bold leading-6 text-amber-700">
            البريد مطلوب مؤقتًا لإنشاء حساب الدخول عبر Supabase Auth، والجوال هو المعلومة الأساسية للمدرسة.
          </p>
          <button disabled={inviteLoading} className="w-full rounded-xl bg-brand py-3 text-sm font-extrabold text-white disabled:opacity-60">
            {inviteLoading ? "جارٍ إرسال الدعوة..." : "إرسال دعوة"}
          </button>
        </div>
      </form>
    </div>
  );
}
