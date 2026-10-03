"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { AuthAlert, authButtonClass, authInputClass } from "./auth-card";

const ROLE_DESTINATIONS: Record<string, string> = {
  admin: "/admin",
  principal: "/dashboard/principal",
  teacher: "/dashboard/teacher",
};

/** Password form for a user who already has a session from an invite or reset link. */
export function SetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("كلمة المرور يجب أن تكون 8 أحرف على الأقل.");
      return;
    }
    if (password !== confirmPassword) {
      setError("كلمة المرور وتأكيدها غير متطابقين.");
      return;
    }

    setLoading(true);
    try {
      const { data: updated, error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError || !updated.user) {
        setError("تعذر تعيين كلمة المرور. اطلب رابطًا جديدًا من «نسيت كلمة المرور» في صفحة الدخول.");
        setLoading(false);
        return;
      }

      // Best effort: the account works either way.
      await fetch("/api/users/activate", { method: "POST" }).catch(() => undefined);

      const { data: profile, error: profileError } = await supabase
        .from("users")
        .select("role")
        .eq("auth_id", updated.user.id)
        .single();

      if (profileError || !profile?.role) {
        console.error("set password profile lookup failed", {
          code: profileError?.code,
          message: profileError?.message,
        });
        setError("تم تعيين كلمة المرور، لكن لم نجد صلاحيات الحساب. تواصل مع الدعم الفني.");
        setLoading(false);
        return;
      }

      const destination = ROLE_DESTINATIONS[profile.role];
      if (!destination) {
        setError("تم تعيين كلمة المرور، لكن لا توجد لوحة مخصصة لهذا الدور.");
        setLoading(false);
        return;
      }

      router.replace(`${destination}?message=password_updated`);
    } catch (err) {
      console.error("set password failed", err);
      setError("حدث خطأ أثناء تعيين كلمة المرور. حاول مرة أخرى.");
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="new-password" className="mb-2 block text-sm font-extrabold text-slate-500">
          كلمة المرور الجديدة
        </label>
        <input
          id="new-password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          minLength={8}
          required
          className={authInputClass}
        />
      </div>

      <div>
        <label htmlFor="confirm-password" className="mb-2 block text-sm font-extrabold text-slate-500">
          تأكيد كلمة المرور
        </label>
        <input
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          minLength={8}
          required
          className={authInputClass}
        />
      </div>

      {error && <AuthAlert tone="error">{error}</AuthAlert>}

      <button type="submit" disabled={loading} className={authButtonClass}>
        {loading ? "جاري حفظ كلمة المرور..." : "حفظ ومتابعة"}
      </button>
    </form>
  );
}
