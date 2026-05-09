"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";
import { supabase } from "@/lib/supabase";

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("جاري قبول الدعوة...");

  useEffect(() => {
    let mounted = true;

    async function acceptInvite() {
      try {
        const code = searchParams.get("code");

        if (code) {
          setMessage("جاري تفعيل الجلسة...");
          const { error } = await supabase.auth.exchangeCodeForSession(code);

          if (error) {
            throw error;
          }

          router.replace("/set-password");
          return;
        }

        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");

        if (accessToken && refreshToken) {
          setMessage("جاري تفعيل حسابك...");
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (error) {
            throw error;
          }

          router.replace("/set-password");
          return;
        }

        throw new Error("Invite callback does not include code or session tokens");
      } catch (error) {
        console.error("invite callback failed", error);
        if (mounted) {
          setMessage("تعذر قبول الدعوة. سيتم تحويلك إلى صفحة الدخول...");
        }
        router.replace("/login?error=invalid_invite");
      }
    }

    acceptInvite();

    return () => {
      mounted = false;
    };
  }, [router, searchParams]);

  return (
    <div
      className="relative min-h-screen overflow-hidden bg-white px-4 py-10 text-[#0b2447]"
      dir="rtl"
    >
      <div className="absolute left-10 top-24 h-96 w-96 rounded-full bg-teal-50/80 blur-3xl" />
      <div className="absolute right-1/4 bottom-16 h-80 w-80 rounded-full bg-cyan-50/70 blur-3xl" />

      <div className="relative mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-md items-center justify-center">
        <div className="w-full rounded-[2rem] border border-slate-100 bg-white/95 p-8 text-center shadow-[0_22px_70px_rgba(15,35,55,0.07)]">
          <div className="mb-8 flex justify-center">
            <BrandLogo size="lg" centered />
          </div>
          <div className="mx-auto mb-5 h-10 w-10 animate-spin rounded-full border-4 border-teal-100 border-t-[#159f91]" />
          <h1 className="text-2xl font-black tracking-normal text-[#0b2447]">
            قبول الدعوة
          </h1>
          <p className="mt-3 text-sm font-bold leading-7 text-slate-500">{message}</p>
        </div>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={null}>
      <AuthCallbackContent />
    </Suspense>
  );
}
