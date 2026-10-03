"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { AuthAlert, AuthCard, authButtonClass, authInputClass } from "@/components/auth/auth-card";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "تعذر إرسال الرابط حاليًا");
      setSent(json.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر إرسال الرابط حاليًا");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard
      title="نسيت كلمة المرور"
      subtitle="اكتب بريدك المسجّل، وسنرسل لك رابطًا لتعيين كلمة مرور جديدة. يصلح أيضًا إذا انتهى رابط دعوتك."
    >
      {sent ? (
        <div className="space-y-4">
          <AuthAlert tone="info">{sent}</AuthAlert>
          <Link href="/login" className={`${authButtonClass} block text-center`}>
            العودة لتسجيل الدخول
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="mb-2 block text-sm font-extrabold text-slate-500">
              البريد الإلكتروني
            </label>
            <input
              id="email"
              type="email"
              dir="ltr"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className={`${authInputClass} text-left`}
            />
          </div>

          {error && <AuthAlert tone="error">{error}</AuthAlert>}

          <button type="submit" disabled={loading} className={authButtonClass}>
            {loading ? "جاري الإرسال..." : "إرسال الرابط"}
          </button>

          <Link href="/login" className="block text-center text-sm font-bold text-slate-400 hover:text-brand">
            العودة لتسجيل الدخول
          </Link>
        </form>
      )}
    </AuthCard>
  );
}
