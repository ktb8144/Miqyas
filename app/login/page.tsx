"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";
import { supabase } from "@/lib/supabase";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [showPass, setShowPass] = useState(false);
  const inviteError = searchParams.get("error") === "invalid_invite";
  const passwordUpdated = searchParams.get("message") === "password_updated";

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setLoadingMessage("جاري التحقق من الحساب...");

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error || !data.user) {
        setError("بيانات الدخول غير صحيحة أو الحساب غير متاح.");
        setLoading(false);
        setLoadingMessage("");
        return;
      }

      const userId = data.user.id;

      const { data: profile, error: profileError } = await supabase
        .from("users")
        .select("role")
        .eq("auth_id", userId)
        .single();

      if (profileError || !profile?.role) {
        console.error("login profile lookup failed", {
          code: profileError?.code,
          message: profileError?.message,
        });
        setError("تعذر العثور على صلاحيات الحساب. تواصل مع الدعم الفني.");
        setLoading(false);
        setLoadingMessage("");
        return;
      }

      const destinations: Record<string, string> = {
        admin: "/admin",
        principal: "/dashboard/principal",
        teacher: "/dashboard/teacher",
      };

      const destination = destinations[profile.role];
      if (!destination) {
        setError("لا توجد لوحة مخصصة لهذا الحساب. تواصل مع الدعم الفني.");
        setLoading(false);
        setLoadingMessage("");
        return;
      }

      setLoadingMessage("جاري فتح لوحة التحكم...");
      router.replace(destination);
    } catch (err) {
      console.error("login failed", err);
      setError("تعذر تسجيل الدخول حاليًا. حاول مرة أخرى.");
      setLoading(false);
      setLoadingMessage("");
    }
  };

  return (
    <div
      className="relative min-h-screen overflow-hidden bg-white px-4 py-10 text-brand-navy"
      dir="rtl"
    >
      <div className="absolute left-10 top-24 h-96 w-96 rounded-full bg-teal-50/80 blur-3xl" />
      <div className="absolute right-1/4 bottom-16 h-80 w-80 rounded-full bg-cyan-50/70 blur-3xl" />

      <div className="relative mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-6xl items-center justify-center">
        <div className="grid w-full items-center gap-10 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="hidden lg:block">
            <div className="mb-7 inline-flex rounded-full border border-teal-100 bg-teal-50/80 px-4 py-2 text-xs font-extrabold text-brand">
              دخول آمن لمنصة دالة
            </div>
            <h1 className="text-5xl/[1.4] font-black tracking-normal text-brand-navy">
              تابع القياس والتحليل من لوحة واحدة.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-9 text-slate-500">
              سجّل الدخول بحسابك للوصول إلى لوحتك.
            </p>
            <div className="mt-8 grid max-w-lg grid-cols-3 gap-3">
              {["جلسة محمية", "تحليل فوري", "تقارير واضحة"].map((item) => (
                <div key={item} className="rounded-2xl border border-slate-100 bg-white/80 p-4 text-center text-sm font-extrabold text-slate-500 shadow-[0_10px_34px_rgba(15,35,55,0.03)]">
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="mx-auto w-full max-w-md">
            <div className="mb-8 flex justify-center">
              <BrandLogo size="lg" centered />
            </div>

            <div className="rounded-[2rem] border border-slate-100 bg-white/95 p-8 shadow-[0_22px_70px_rgba(15,35,55,0.07)]">
              <h2 className="mb-2 text-center text-2xl font-black tracking-normal text-brand-navy">
                تسجيل الدخول
              </h2>
              <p className="mb-7 text-center text-sm leading-7 text-slate-400">
                أدخل بيانات حسابك للمتابعة إلى لوحة العمل.
              </p>

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-extrabold text-slate-500">
                    البريد الإلكتروني
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="example@school.sa"
                    className="w-full rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-right text-sm font-semibold text-brand-navy outline-none transition placeholder:text-slate-300 focus:border-brand/40 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-extrabold text-slate-500">
                    كلمة المرور
                  </label>
                  <div className="relative">
                    <input
                      type={showPass ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="w-full rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 pl-16 text-right text-sm font-semibold text-brand-navy outline-none transition focus:border-brand/40 focus:bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs font-bold text-slate-400 transition hover:bg-white hover:text-brand"
                    >
                      {showPass ? "إخفاء" : "إظهار"}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
                    {error}
                  </div>
                )}

                {inviteError && !error && (
                  <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
                    رابط الدعوة غير صالح أو منتهي. اطلب دعوة جديدة من مدير المدرسة.
                  </div>
                )}

                {passwordUpdated && !error && (
                  <div className="rounded-xl border border-teal-100 bg-teal-50 px-4 py-3 text-sm font-bold text-brand">
                    تم تحديث كلمة المرور بنجاح. يمكنك تسجيل الدخول الآن.
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl bg-brand py-3.5 text-base font-extrabold text-white shadow-[0_10px_24px_rgba(21,159,145,0.14)] transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? loadingMessage || "جارٍ الدخول..." : "دخول"}
                </button>
              </form>

              <p className="mt-6 text-center text-xs font-semibold text-slate-400">
                ليس لديك حساب؟ تواصل مع قائد مدرستك
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  );
}
