"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";
import { supabase } from "@/lib/supabase";

const ROLE_DESTINATIONS: Record<string, string> = {
  admin: "/admin",
  principal: "/dashboard/principal",
  teacher: "/dashboard/teacher",
};

export default function SetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [checkingSession, setCheckingSession] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
      const { data: updated, error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError || !updated.user) {
        setError("تعذر تعيين كلمة المرور. اطلب رابط دعوة جديد إذا انتهت صلاحية الرابط.");
        setLoading(false);
        return;
      }

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
        setError("تم تعيين كلمة المرور، لكن لم نجد صلاحيات الحساب. تواصل مع مدير النظام.");
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
    <div
      className="relative min-h-screen overflow-hidden bg-white px-4 py-10 text-[#0b2447]"
      dir="rtl"
    >
      <div className="absolute left-10 top-24 h-96 w-96 rounded-full bg-teal-50/80 blur-3xl" />
      <div className="absolute right-1/4 bottom-16 h-80 w-80 rounded-full bg-cyan-50/70 blur-3xl" />

      <div className="relative mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-md items-center justify-center">
        <div className="w-full">
          <div className="mb-8 flex justify-center">
            <BrandLogo size="lg" centered />
          </div>

          <div className="rounded-[2rem] border border-slate-100 bg-white/95 p-8 shadow-[0_22px_70px_rgba(15,35,55,0.07)]">
            <h1 className="mb-2 text-center text-2xl font-black tracking-normal text-[#0b2447]">
              تعيين كلمة المرور
            </h1>
            <p className="mb-7 text-center text-sm leading-7 text-slate-400">
              اختر كلمة مرور جديدة لإكمال تفعيل حسابك في مقياس.
            </p>

            {checkingSession ? (
              <div className="rounded-xl border border-teal-100 bg-teal-50 px-4 py-4 text-center text-sm font-bold text-[#159f91]">
                جاري التحقق من رابط الدعوة...
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-extrabold text-slate-500">
                    كلمة المرور الجديدة
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    minLength={8}
                    required
                    className="w-full rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-right text-sm font-semibold text-[#0b2447] outline-none transition focus:border-[#159f91]/40 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-extrabold text-slate-500">
                    تأكيد كلمة المرور
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    minLength={8}
                    required
                    className="w-full rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-right text-sm font-semibold text-[#0b2447] outline-none transition focus:border-[#159f91]/40 focus:bg-white"
                  />
                </div>

                {error && (
                  <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl bg-[#159f91] py-3.5 text-base font-extrabold text-white shadow-[0_10px_24px_rgba(21,159,145,0.14)] transition hover:bg-[#10877b] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "جاري حفظ كلمة المرور..." : "حفظ ومتابعة"}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
