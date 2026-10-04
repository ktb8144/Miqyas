"use client";

import Link from "next/link";
import { FormEvent, Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AuthAlert, AuthCard, authButtonClass, authInputClass } from "@/components/auth/auth-card";
import { TRIAL_DAYS_LABEL } from "./trial-copy";

type SignupType = "school" | "join" | "individual";

const TYPES: { value: SignupType; label: string; hint: string }[] = [
  { value: "school", label: "قائد مدرسة", hint: "سجّل مدرستك وادعُ معلميك" },
  { value: "join", label: "معلم في مدرسة مسجّلة", hint: "انضم برمز مدرستك" },
  { value: "individual", label: "معلم مستقل", hint: "باقة المعلم، حتى 4 فصول" },
];

const SUBJECTS = ["رياضيات", "قراءة", "علوم", "أخرى"];

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-extrabold text-slate-500">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs font-bold text-slate-400">{hint}</span>}
    </label>
  );
}

function SignupContent() {
  const params = useSearchParams();
  const initial = (["school", "join", "individual"] as const).find((t) => t === params.get("type")) ?? "school";
  const [type, setType] = useState<SignupType>(initial);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    schoolName: "",
    city: "",
    ministryNumber: "",
    gender: "boys",
    joinCode: params.get("code") ?? "",
    subject: "",
    website: "",
  });
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState<string | null>(null);

  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (!acceptTerms) {
      setError("يجب الموافقة على الشروط وسياسة الخصوصية");
      return;
    }
    setLoading(true);
    try {
      const common = { name: form.name, email: form.email, phone: form.phone || undefined, acceptTerms, website: form.website };
      const body =
        type === "school"
          ? { type, ...common, schoolName: form.schoolName, city: form.city, ministryNumber: form.ministryNumber, gender: form.gender }
          : type === "join"
            ? { type, ...common, joinCode: form.joinCode, subject: form.subject || undefined }
            : { type, ...common, schoolName: form.schoolName, city: form.city, subject: form.subject || undefined };
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) throw new Error(json.error || "تعذر إكمال التسجيل");
      setSent(json.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر إكمال التسجيل");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <AuthCard title="تحقق من بريدك" subtitle={form.email}>
        <div className="space-y-4">
          <AuthAlert tone="info">{sent}</AuthAlert>
          <Link href="/login" className={`${authButtonClass} block text-center`}>
            صفحة الدخول
          </Link>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="ابدأ مع دالة" subtitle={`${TRIAL_DAYS_LABEL} مجانًا، بدون بطاقة ائتمانية.`}>
      <form onSubmit={submit} className="space-y-4">
        <div role="radiogroup" aria-label="نوع الحساب" className="grid gap-2">
          {TYPES.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={type === option.value}
              onClick={() => setType(option.value)}
              className={`flex items-center justify-between rounded-xl border px-4 py-3 text-right transition ${
                type === option.value ? "border-brand bg-teal-50" : "border-slate-100 bg-white hover:border-brand/30"
              }`}
            >
              <span>
                <span className="block text-sm font-black text-brand-navy">{option.label}</span>
                <span className="block text-xs font-bold text-slate-400">{option.hint}</span>
              </span>
              <span className={`h-4 w-4 rounded-full border-2 ${type === option.value ? "border-brand bg-brand" : "border-slate-300"}`} />
            </button>
          ))}
        </div>

        <Field label="الاسم">
          <input required value={form.name} onChange={set("name")} autoComplete="name" className={authInputClass} />
        </Field>
        <Field label="البريد الإلكتروني" hint="يصلك عليه رابط التفعيل">
          <input required type="email" dir="ltr" value={form.email} onChange={set("email")} autoComplete="email" className={`${authInputClass} text-left`} />
        </Field>

        {type === "join" && (
          <Field label="رمز المدرسة" hint="رمز من 6 خانات يعطيك إياه قائد المدرسة">
            <input
              required
              dir="ltr"
              value={form.joinCode}
              onChange={set("joinCode")}
              className={`${authInputClass} text-center font-black uppercase tracking-[0.3em]`}
            />
          </Field>
        )}

        {type !== "join" && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="اسم المدرسة">
              <input required value={form.schoolName} onChange={set("schoolName")} className={authInputClass} />
            </Field>
            <Field label="المدينة">
              <input required value={form.city} onChange={set("city")} className={authInputClass} />
            </Field>
          </div>
        )}

        {type === "school" && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="الرقم الوزاري للمدرسة">
              <input required inputMode="numeric" dir="ltr" value={form.ministryNumber} onChange={set("ministryNumber")} className={`${authInputClass} text-right`} />
            </Field>
            <Field label="بنين أو بنات">
              <select value={form.gender} onChange={set("gender")} className={authInputClass}>
                <option value="boys">بنين</option>
                <option value="girls">بنات</option>
              </select>
            </Field>
          </div>
        )}

        {type !== "school" && (
          <Field label="المادة">
            <select value={form.subject} onChange={set("subject")} className={authInputClass}>
              <option value="">اختر المادة</option>
              {SUBJECTS.map((subject) => (
                <option key={subject} value={subject}>{subject}</option>
              ))}
            </select>
          </Field>
        )}

        <Field label="الجوال (اختياري)">
          <input inputMode="tel" dir="ltr" value={form.phone} onChange={set("phone")} placeholder="05xxxxxxxx" className={`${authInputClass} text-right`} />
        </Field>

        {/* Honeypot, hidden from people */}
        <input type="text" tabIndex={-1} autoComplete="off" value={form.website} onChange={set("website")} className="hidden" aria-hidden="true" />

        <label className="flex items-start gap-2 text-sm font-bold leading-7 text-slate-500">
          <input type="checkbox" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} className="mt-1.5 accent-brand" />
          <span>
            أوافق على{" "}
            <Link href="/terms" target="_blank" className="text-brand underline">شروط الاستخدام</Link>
            {" "}و{" "}
            <Link href="/privacy" target="_blank" className="text-brand underline">سياسة الخصوصية</Link>
          </span>
        </label>

        {error && <AuthAlert tone="error">{error}</AuthAlert>}

        <button type="submit" disabled={loading} className={authButtonClass}>
          {loading ? "جارٍ إنشاء الحساب..." : "إنشاء الحساب"}
        </button>
        <p className="text-center text-sm font-bold text-slate-400">
          لديك حساب؟ <Link href="/login" className="text-brand hover:underline">سجّل الدخول</Link>
        </p>
      </form>
    </AuthCard>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupContent />
    </Suspense>
  );
}
