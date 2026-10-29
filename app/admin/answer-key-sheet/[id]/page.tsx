"use client";

import { useEffect, useMemo, useState } from "react";
import { Printer } from "lucide-react";
import { BRAND } from "@/lib/brand";
import { toEnglishDigits } from "@/lib/format";
import { renderAnswerBlockSvg } from "@/lib/omr/sheet-svg";
import { MAX_SHEET_QUESTIONS } from "@/lib/omr/standard-sheet";

/** Blank Dala answer sheet for one test, for the admin to shade the correct answers on. */
export default function AnswerKeySheetPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { q?: string };
}) {
  const questionCount = Math.max(1, Math.min(MAX_SHEET_QUESTIONS, Number(searchParams.q) || 10));
  const [title, setTitle] = useState("");

  useEffect(() => {
    void fetch(`/api/admin/assessment-packages/${params.id}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((json) => setTitle(json?.data?.title ?? ""))
      .catch(() => undefined);
  }, [params.id]);

  const svg = useMemo(() => renderAnswerBlockSvg({ questionCount, seed: params.id }), [questionCount, params.id]);

  return (
    <div className="min-h-screen bg-[#f7fafc] text-brand-navy print:bg-white" dir="rtl">
      <style>{`@page { size: A4; margin: 12mm; } @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }`}</style>
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3 print:hidden">
        <p className="text-sm font-bold text-slate-500">
          اطبعها، وظلّل الإجابة الصحيحة لكل سؤال، واترك رقم الطالب فارغًا. ثم ارفع صورتها من «مفتاح من ورقة مظللة».
        </p>
        <button onClick={() => window.print()} className="flex flex-shrink-0 items-center gap-1 rounded-xl bg-brand px-4 py-2 text-xs font-extrabold text-white">
          <Printer className="h-4 w-4" /> طباعة
        </button>
      </div>
      <section className="mx-auto bg-white p-6 shadow-sm print:p-0 print:shadow-none" style={{ width: "186mm" }}>
        <header className="mb-4 flex items-start justify-between gap-4 border-b border-slate-200 pb-3">
          <div>
            <p className="text-lg font-black">نموذج الإجابة: {title || "…"}</p>
            <p className="text-xs font-bold text-slate-500">{toEnglishDigits(questionCount)} سؤالًا · لا تُعطى للطلاب</p>
          </div>
          <p className="text-sm font-black text-slate-400">{BRAND.nameAr}</p>
        </header>
        <div className="flex justify-center" dangerouslySetInnerHTML={{ __html: svg }} />
      </section>
    </div>
  );
}
