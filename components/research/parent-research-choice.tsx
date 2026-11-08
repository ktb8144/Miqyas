"use client";

import Link from "next/link";
import { useState } from "react";

/** Research notice on the parent report, with a one-click exclusion the parent can undo. */
export function ParentResearchChoice({ token, initialOptedOut }: { token: string; initialOptedOut: boolean }) {
  const [optedOut, setOptedOut] = useState(initialOptedOut);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (optOut: boolean) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/parent/research-opt-out", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, optOut }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) throw new Error(json.error || "تعذر حفظ اختيارك");
      setOptedOut(optOut);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر حفظ اختيارك");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="mt-5 rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm font-bold leading-7 text-slate-500">
      <p className="font-black text-brand-navy">البحث العلمي</p>
      {optedOut ? (
        <p className="mt-1">تم استبعاد بيانات ابنك من البحث العلمي، ولن تدخل في أي ملف بحثي. التقرير والتدريب يعملان كما هما.</p>
      ) : (
        <p className="mt-1">
          تشارك مدرسة ابنك في بحث علمي تربوي يستخدم نتائج الاختبارات بعد تجهيلها (بلا اسم الطالب أو المدرسة) لتحسين التقييم.
          يمكنك استبعاد بيانات ابنك دون أي أثر على التقرير أو الخدمة.{" "}
          <Link href="/research" target="_blank" className="text-brand underline">التفاصيل</Link>
        </p>
      )}
      <button
        type="button"
        disabled={saving}
        onClick={() => save(!optedOut)}
        className="mt-3 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-extrabold text-slate-600 transition hover:border-brand/40 hover:text-brand disabled:opacity-60"
      >
        {saving ? "جارٍ الحفظ..." : optedOut ? "التراجع والسماح بالمشاركة" : "استبعاد بيانات ابني من البحث"}
      </button>
      {error && <p className="mt-2 text-xs font-bold text-rose-700">{error}</p>}
    </section>
  );
}
