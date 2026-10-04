"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Copy, Check, Share2 } from "lucide-react";
import { toEnglishDigits } from "@/lib/format";

type Plan = {
  kind: "school" | "individual";
  active: boolean;
  trial: boolean;
  endsAt: string | null;
  quota: number | null;
  used: number;
  expired: boolean;
  quotaReached: boolean;
  blockedReason: string | null;
};

export type AccountPlan = { plan: Plan | null; joinCode: string | null; schoolName: string | null };

/** Loads the signed-in user's plan once (trial dates, papers used, join code). */
export function useAccountPlan() {
  const [data, setData] = useState<AccountPlan | null>(null);
  useEffect(() => {
    let alive = true;
    fetch("/api/account/plan", { cache: "no-store" })
      .then((res) => res.json())
      .then((json) => {
        if (alive && json.success) setData({ plan: json.plan, joinCode: json.joinCode, schoolName: json.schoolName });
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  return data;
}

function daysLeft(endsAt: string | null) {
  if (!endsAt) return null;
  const end = new Date(`${endsAt}T23:59:59+03:00`).getTime();
  return Math.max(0, Math.ceil((end - Date.now()) / 86_400_000));
}

/** Trial status line; red when scanning is blocked. Hidden for paid accounts. */
export function PlanBanner({ plan }: { plan: Plan | null | undefined }) {
  if (!plan || (!plan.trial && plan.active)) return null;

  if (plan.blockedReason) {
    return (
      <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
        <span>{plan.blockedReason}</span>
        <Link href="/#trial" className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-extrabold text-white">
          تواصل معنا للاشتراك
        </Link>
      </div>
    );
  }

  const left = daysLeft(plan.endsAt);
  const quotaText = plan.quota !== null ? ` · صُحّحت ${toEnglishDigits(plan.used)} من ${toEnglishDigits(plan.quota)} ورقة` : "";
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-teal-100 bg-teal-50/70 px-4 py-2.5 text-xs font-bold text-brand sm:text-sm">
      <span>
        الفترة التجريبية{left !== null ? `: باقٍ ${toEnglishDigits(left)} يومًا` : ""}{quotaText}
      </span>
      <Link href="/#pricing" className="text-xs font-extrabold underline">الأسعار</Link>
    </div>
  );
}

/** The principal's code for teachers to join the school, with copy and WhatsApp share. */
export function JoinCodeCard({ joinCode, schoolName }: { joinCode: string; schoolName?: string | null }) {
  const [copied, setCopied] = useState(false);
  const origin = typeof window === "undefined" ? "https://www.dalaedu.com" : window.location.origin;
  const link = `${origin}/signup?type=join&code=${joinCode}`;
  const message = `انضم إلى ${schoolName ? `«${schoolName}»` : "مدرستنا"} في دالة للاختبارات الأسبوعية.\nسجّل من هذا الرابط: ${link}\nرمز المدرسة: ${joinCode}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("انسخ الرسالة:", message);
    }
  };

  return (
    <div className="rounded-[1.25rem] border border-teal-100 bg-white p-4 shadow-[0_10px_34px_rgba(15,35,55,0.035)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-black text-brand-navy">رمز انضمام المعلمين</p>
          <p className="text-xs font-bold text-slate-400">أرسله في قروب المعلمين؛ من يسجّل به ينضم لمدرستك مباشرة.</p>
        </div>
        <span dir="ltr" className="rounded-xl bg-slate-50 px-4 py-2 text-xl font-black tracking-[0.3em] text-brand-navy">{joinCode}</span>
      </div>
      <div className="mt-3 flex gap-2">
        <a
          href={`https://wa.me/?text=${encodeURIComponent(message)}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand py-2.5 text-xs font-extrabold text-white"
        >
          <Share2 className="h-4 w-4" />
          إرسال عبر واتساب
        </a>
        <button
          type="button"
          onClick={copy}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 py-2.5 text-xs font-extrabold text-slate-600"
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? "نُسخت" : "نسخ الرسالة"}
        </button>
      </div>
    </div>
  );
}
