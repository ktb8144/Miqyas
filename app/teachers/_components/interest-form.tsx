"use client";

import { FormEvent, useState } from "react";

const SUBJECTS = ["الرياضيات", "لغتي", "العلوم"];
const GRADES = ["الثالث", "الرابع", "الخامس", "السادس"];
const PLANS = ["فصلي", "سنوي"];

const FIELD =
  "w-full rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-brand/40 focus:bg-white";

const initialForm = {
  name: "",
  phone: "",
  email: "",
  school_name: "",
  subject: SUBJECTS[0],
  grade: GRADES[3],
  plan: PLANS[1],
};

export function TeacherInterestForm() {
  const [form, setForm] = useState(initialForm);
  const [state, setState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  function update(field: keyof typeof initialForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("loading");
    setMessage("");
    try {
      const res = await fetch("/api/trial-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          phone: form.phone,
          email: form.email,
          school_name: form.school_name,
          // Tagged so the admin can tell teacher-package requests apart in "طلبات التجربة".
          message: `[باقة المعلم] المادة: ${form.subject} | الصف: ${form.grade} | الخطة: ${form.plan}`,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) throw new Error(json.error || "تعذر إرسال الطلب");
      setForm(initialForm);
      setState("success");
      setMessage("تم تسجيل اهتمامك. سنتواصل معك عند تفعيل حسابك.");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "تعذر إرسال الطلب");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 rounded-[1.5rem] border border-slate-100 bg-white p-5 md:grid-cols-2">
      <label className="block">
        <span className="mb-2 block text-sm font-extrabold text-slate-500">الاسم</span>
        <input required type="text" value={form.name} onChange={(e) => update("name", e.target.value)} className={FIELD} />
      </label>
      <label className="block">
        <span className="mb-2 block text-sm font-extrabold text-slate-500">رقم الجوال</span>
        <input required type="tel" value={form.phone} onChange={(e) => update("phone", e.target.value)} className={FIELD} />
      </label>
      <label className="block">
        <span className="mb-2 block text-sm font-extrabold text-slate-500">البريد الإلكتروني</span>
        <input required type="email" value={form.email} onChange={(e) => update("email", e.target.value)} className={FIELD} />
      </label>
      <label className="block">
        <span className="mb-2 block text-sm font-extrabold text-slate-500">المدرسة</span>
        <input required type="text" value={form.school_name} onChange={(e) => update("school_name", e.target.value)} className={FIELD} />
      </label>
      <label className="block">
        <span className="mb-2 block text-sm font-extrabold text-slate-500">المادة</span>
        <select value={form.subject} onChange={(e) => update("subject", e.target.value)} className={FIELD}>
          {SUBJECTS.map((item) => <option key={item}>{item}</option>)}
        </select>
      </label>
      <label className="block">
        <span className="mb-2 block text-sm font-extrabold text-slate-500">الصف</span>
        <select value={form.grade} onChange={(e) => update("grade", e.target.value)} className={FIELD}>
          {GRADES.map((item) => <option key={item}>{item}</option>)}
        </select>
      </label>
      <fieldset className="md:col-span-2">
        <legend className="mb-2 block text-sm font-extrabold text-slate-500">الخطة المفضلة</legend>
        <div className="grid grid-cols-2 gap-3">
          {PLANS.map((plan) => (
            <label
              key={plan}
              className={`cursor-pointer rounded-xl border px-4 py-3 text-center text-sm font-extrabold transition ${
                form.plan === plan ? "border-brand bg-teal-50 text-brand" : "border-slate-100 bg-slate-50 text-slate-500"
              }`}
            >
              <input type="radio" name="plan" value={plan} checked={form.plan === plan} onChange={() => update("plan", plan)} className="sr-only" />
              {plan}
            </label>
          ))}
        </div>
      </fieldset>
      {message && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm font-bold md:col-span-2 ${
            state === "success" ? "border-emerald-100 bg-emerald-50 text-emerald-700" : "border-rose-100 bg-rose-50 text-rose-700"
          }`}
        >
          {message}
        </div>
      )}
      <button
        type="submit"
        disabled={state === "loading"}
        className="rounded-xl bg-brand px-6 py-4 text-base font-extrabold text-white transition hover:bg-brand-dark disabled:opacity-60 md:col-span-2"
      >
        {state === "loading" ? "جارٍ الإرسال..." : "سجّل اهتمامك"}
      </button>
    </form>
  );
}
