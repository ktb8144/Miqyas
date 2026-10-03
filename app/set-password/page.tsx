"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { AuthAlert, AuthCard } from "@/components/auth/auth-card";
import { SetPasswordForm } from "@/components/auth/set-password-form";

export default function SetPasswordPage() {
  const router = useRouter();
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function checkSession() {
      const {
        data: { user },
        error: sessionError,
      } = await supabase.auth.getUser();

      if (!mounted) return;

      if (sessionError || !user) {
        router.replace("/login?error=invalid_invite");
        return;
      }

      setCheckingSession(false);
    }

    checkSession();

    return () => {
      mounted = false;
    };
  }, [router]);

  return (
    <AuthCard title="تعيين كلمة المرور" subtitle="اختر كلمة مرور جديدة لإكمال تفعيل حسابك في دالة.">
      {checkingSession ? <AuthAlert tone="info">جاري التحقق من الرابط...</AuthAlert> : <SetPasswordForm />}
    </AuthCard>
  );
}
