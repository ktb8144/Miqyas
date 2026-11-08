"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FlaskConical } from "lucide-react";
import { formatShortDate } from "@/lib/format";

type ConsentResponse = {
  success: boolean;
  canManage?: boolean;
  kind?: "school" | "individual";
  granted?: boolean;
  outdated?: boolean;
  updatedAt?: string | null;
  error?: string;
};

/**
 * Optional research participation for the school (principal) or an independent teacher's own account.
 * Shows nothing to people who don't decide for the school.
 */
export function ResearchConsentCard({ className = "" }: { className?: string }) {
  const [state, setState] = useState<ConsentResponse | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/research/consent", { cache: "no-store" })
      .then((res) => res.json())
      .then((json: ConsentResponse) => {
        if (alive && json.success) setState(json);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (!state?.canManage) return null;

  const own = state.kind === "individual" ? "فصولي" : "مدرستي";
  const active = Boolean(state.granted) && !state.outdated;

  const save = async (granted: boolean) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/research/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ granted }),
      });
      const json: ConsentResponse = await res.json().catch(() => ({ success: false }));
      if (!res.ok || !json.success) throw new Error(json.error || "تعذر حفظ قرارك");
      setState((prev) => ({ ...prev, ...json, canManage: true, kind: prev?.kind }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر حفظ قرارك");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className={`rounded-[1.25rem] border border-slate-100 bg-white p-4 shadow-[0_10px_34px_rgba(15,35,55,0.035)] ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-teal-50 text-brand">
            <FlaskConical className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-black text-brand-navy">المشاركة في البحث العلمي (اختياري)</p>
            <p className="mt-1 text-xs font-bold leading-6 text-slate-500">
              {active
                ? `${own === "مدرستي" ? "مدرستك مشاركة" : "فصولك مشاركة"} منذ ${formatShortDate(state.updatedAt)}. تُستخدم النتائج بعد تجهيلها فقط، ويمكنك الانسحاب في أي وقت.`
                : state.outdated
                  ? "تحدّثت معلومات البحث بعد موافقتك. راجعها وأكّد المشاركة، وحتى ذلك الحين لا تُستخدم بياناتك."
                  : `يمكنك السماح باستخدام نتائج ${own} بعد تجهيلها (بلا أسماء) لتطوير تقييم القراءة والرياضيات. لا يؤثر قرارك على استخدامك لدالة.`}
            </p>
            <Link href="/research" target="_blank" className="mt-1 inline-block text-xs font-extrabold text-brand hover:underline">
              ما الذي يشمله البحث؟
            </Link>
          </div>
        </div>
        {active ? (
          <button
            type="button"
            disabled={saving}
            onClick={() => save(false)}
            className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-extrabold text-slate-600 transition hover:border-rose-200 hover:text-rose-600 disabled:opacity-60"
          >
            {saving ? "جارٍ الحفظ..." : "سحب الموافقة"}
          </button>
        ) : (
          <button
            type="button"
            disabled={saving}
            onClick={() => save(true)}
            className="rounded-xl bg-brand px-4 py-2 text-xs font-extrabold text-white transition hover:bg-brand-dark disabled:opacity-60"
          >
            {saving ? "جارٍ الحفظ..." : state.outdated ? "تأكيد المشاركة" : `أوافق على مشاركة ${own}`}
          </button>
        )}
      </div>
      {error && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">{error}</p>}
    </section>
  );
}
