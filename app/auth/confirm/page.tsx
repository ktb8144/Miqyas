"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { AuthAlert, AuthCard, authButtonClass } from "@/components/auth/auth-card";
import { SetPasswordForm } from "@/components/auth/set-password-form";

type LinkType = "invite" | "recovery";

/**
 * Landing page for links in invitation and password-reset emails
 * (template: {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite|recovery).
 *
 * The one-time token is only spent when the user presses the button, so email scanners or
 * opening the link in a preview first do not use it up, and the password is set on this same
 * page, in the same browser that received the session.
 */
function ConfirmContent() {
  const searchParams = useSearchParams();
  const tokenHash = searchParams.get("token_hash");
  const type: LinkType = searchParams.get("type") === "recovery" ? "recovery" : "invite";

  const [step, setStep] = useState<"ready" | "verifying" | "password" | "failed">(tokenHash ? "ready" : "failed");

  const copy =
    type === "invite"
      ? { title: "تفعيل حسابك في دالة", action: "تفعيل الحساب", subtitle: "اضغط الزر لتفعيل حسابك، ثم اختر كلمة المرور." }
      : { title: "إعادة تعيين كلمة المرور", action: "متابعة", subtitle: "اضغط الزر للمتابعة، ثم اختر كلمة مرور جديدة." };

  const verify = async () => {
    if (!tokenHash) return;
    setStep("verifying");
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (error) {
      console.error("verify link failed", { code: error.code, message: error.message });
      setStep("failed");
      return;
    }
    setStep("password");
  };

  if (step === "password") {
    return (
      <AuthCard title="اختر كلمة المرور" subtitle="8 أحرف على الأقل. ستستخدمها للدخول من أي جهاز.">
        <SetPasswordForm />
      </AuthCard>
    );
  }

  if (step === "failed") {
    return (
      <AuthCard title="الرابط غير صالح">
        <div className="space-y-4">
          <AuthAlert tone="error">
            هذا الرابط استُخدم من قبل أو انتهت صلاحيته. اطلب رابطًا جديدًا من «نسيت كلمة المرور»، أو اطلب من قائد
            مدرستك إعادة إرسال الدعوة.
          </AuthAlert>
          <Link href="/forgot-password" className={`${authButtonClass} block text-center`}>
            طلب رابط جديد
          </Link>
          <Link href="/login" className="block text-center text-sm font-bold text-slate-400 hover:text-brand">
            العودة لتسجيل الدخول
          </Link>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard title={copy.title} subtitle={copy.subtitle}>
      <button type="button" onClick={verify} disabled={step === "verifying"} className={authButtonClass}>
        {step === "verifying" ? "جاري التحقق..." : copy.action}
      </button>
    </AuthCard>
  );
}

export default function AuthConfirmPage() {
  return (
    <Suspense fallback={null}>
      <ConfirmContent />
    </Suspense>
  );
}
