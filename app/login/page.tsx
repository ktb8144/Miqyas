"use client";
import { useState } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(`Auth error: ${error.message}`);
      setLoading(false);
      return;
    }

    const userId = data.user.id;
    console.log("Logged in user ID:", userId);

    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("role, name, school_id, grade, subject")
      .eq("auth_id", userId)
      .single();

    console.log("Profile:", profile);
    console.log("Profile error:", profileError);

    if (profileError || !profile) {
      setError(
        `Profile error: ${profileError?.message} | ` +
        `Looking for auth_id: ${userId}`
      );
      setLoading(false);
      return;
    }

    setTimeout(() => {
      if (profile.role === "principal") {
        window.location.href = "/dashboard/principal";
      } else if (profile.role === "teacher") {
        window.location.href = "/dashboard/teacher";
      } else if (profile.role === "admin") {
        window.location.href = "/admin";
      } else {
        setError(`Unknown role: ${profile.role}`);
        setLoading(false);
      }
    }, 500);
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-gray-50 px-4"
      dir="rtl"
    >
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 flex justify-center">
          <BrandLogo size="lg" centered />
        </div>

        {/* Login form */}
        <div className="bg-white rounded-2xl shadow-md p-8">
          <h2 className="text-xl font-bold text-gray-800 text-center mb-6">
            تسجيل الدخول
          </h2>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                البريد الإلكتروني
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="example@school.sa"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 text-right"
                style={{ "--tw-ring-color": "#1D9E75" } as React.CSSProperties}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                كلمة المرور
              </label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 text-right"
                  style={
                    { "--tw-ring-color": "#1D9E75" } as React.CSSProperties
                  }
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-gray-700"
                >
                  {showPass ? "إخفاء" : "إظهار"}
                </button>
              </div>
            </div>

            {error && (
              <div className="px-4 py-3 rounded-xl text-sm" style={{ background: "#FCEBEB", color: "#A32D2D" }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl text-white font-bold text-base hover:opacity-90 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ background: "#1D9E75" }}
            >
              {loading ? "جارٍ الدخول..." : "دخول"}
            </button>
          </form>

          <p className="text-center mt-6 text-xs text-gray-400">
            ليس لديك حساب؟ تواصل مع مدير مِقياس
          </p>
        </div>
      </div>
    </div>
  );
}
