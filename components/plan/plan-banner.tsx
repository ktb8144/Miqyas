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

export type SchoolGender = "boys" | "girls" | null;

export type AccountPlan = { plan: Plan | null; joinCode: string | null; schoolName: string | null; schoolGender: SchoolGender };

/** Loads the signed-in user's plan once (trial dates, papers used, join code). */
export function useAccountPlan() {
  const [data, setData] = useState<AccountPlan | null>(null);
  useEffect(() => {
    let alive = true;
    fetch("/api/account/plan", { cache: "no-store" })
      .then((res) => res.json())
      .then((json) => {
        if (alive && json.success) {
          setData({ plan: json.plan, joinCode: json.joinCode, schoolName: json.schoolName, schoolGender: json.schoolGender ?? null });
        }
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

/**
 * The message the principal sends to the school's WhatsApp group. Girls' schools are addressed
 * in the feminine; boys' schools and older schools with no gender on record in the masculine.
 * WhatsApp shows *text* in bold. The principal can still edit it in WhatsApp before sending.
 */
export function joinInviteMessage({
  schoolName,
  joinCode,
  link,
  gender,
}: {
  schoolName?: string | null;
  joinCode: string;
  link: string;
  gender?: SchoolGender;
}) {
  const girls = gender === "girls";
  const school = schoolName ? ` في «${schoolName}»` : "";
  return [
    "السلام عليكم ورحمة الله وبركاته",
    girls ? `الزميلات الكريمات${school}،` : `الزملاء الكرام${school}،`,
    "",
    girls
      ? "نأمل من المعلمات المكلّفات بمراجعة نافس التسجيل في منصة دالة من الرابط التالي:"
      : "نأمل من المعلمين المكلّفين بمراجعة نافس التسجيل في منصة دالة من الرابط التالي:",
    link,
    "",
    `رمز المدرسة: *${joinCode}*`,
    "",
    "التسجيل خلال دقيقتين:",
    girls ? "1. افتحي الرابط واكتبي اسمك وبريدك الإلكتروني." : "1. افتح الرابط واكتب اسمك وبريدك الإلكتروني.",
    girls
      ? "2. افتحي رسالة التفعيل في بريدك (راجعي البريد غير المرغوب فيه إن لم تجديها)."
      : "2. افتح رسالة التفعيل في بريدك (راجع البريد غير المرغوب فيه إن لم تجدها).",
    girls ? "3. اختاري كلمة المرور، وتدخلين لوحتك مباشرة." : "3. اختر كلمة المرور، وتدخل لوحتك مباشرة.",
    "",
    "شاكرين تعاونكم.",
  ].join("\n");
}

/** The principal's code for teachers to join the school, with copy and WhatsApp share. */
export function JoinCodeCard({
  joinCode,
  schoolName,
  schoolGender,
}: {
  joinCode: string;
  schoolName?: string | null;
  schoolGender?: SchoolGender;
}) {
  const [copied, setCopied] = useState(false);
  const origin = typeof window === "undefined" ? "https://www.dalaedu.com" : window.location.origin;
  const link = `${origin}/signup?type=join&code=${joinCode}`;
  const message = joinInviteMessage({ schoolName, joinCode, link, gender: schoolGender });

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
          <p className="text-xs font-bold text-slate-400">أرسل الرسالة في قروب المدرسة؛ من يسجّل بالرمز ينضم لمدرستك مباشرة.</p>
        </div>
        <span dir="ltr" className="rounded-xl bg-slate-50 px-4 py-2 text-xl font-black tracking-[0.3em] text-brand-navy">{joinCode}</span>
      </div>
      <details className="mt-3 rounded-xl bg-slate-50 px-3 py-2">
        <summary className="cursor-pointer text-xs font-extrabold text-brand">عرض نص الرسالة</summary>
        <p className="mt-2 whitespace-pre-line break-words text-xs font-bold leading-6 text-slate-600">{message.replace(/\*/g, "")}</p>
        <p className="mt-1 text-[11px] font-bold text-slate-400">يمكنك تعديل النص في واتساب قبل الإرسال.</p>
      </details>
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
