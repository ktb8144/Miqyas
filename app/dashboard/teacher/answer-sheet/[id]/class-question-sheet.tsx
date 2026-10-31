"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Download, ExternalLink, Printer } from "lucide-react";
import { BRAND } from "@/lib/brand";
import { toEnglishDigits } from "@/lib/format";
import type { SheetMaster } from "@/lib/omr/sheet-master";
import { classLabelText, stampClassSheet } from "@/lib/omr/stamp-sheet";

/**
 * Print page for a Dala master question sheet: the class's own copy, stamped in the browser with the
 * school name, the class name and the class QR. The student answers on the sheet itself.
 */
export function ClassQuestionSheet({
  assignmentId,
  master,
  masterBytes,
  schoolName,
  className,
  sheetCode,
  studentCount,
}: {
  assignmentId: string;
  master: SheetMaster;
  masterBytes: Uint8Array;
  schoolName: string;
  className: string;
  sheetCode: string | null;
  studentCount: number;
}) {
  const [copies, setCopies] = useState(Math.max(1, studentCount || 30));
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const fileName = `${master.sheet}-${className || "class"}.pdf`.replace(/[\\/:*?"<>|\s]+/g, "-");

  const build = useCallback(async (count: number) => {
    if (!sheetCode) return;
    setBusy(true);
    setError(null);
    try {
      const bytes = await stampClassSheet({ master: masterBytes, schoolName, className, sheetCode, copies: count });
      const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
      setUrl((previous) => {
        if (previous) URL.revokeObjectURL(previous);
        return URL.createObjectURL(blob);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذّر تجهيز الورقة");
    } finally {
      setBusy(false);
    }
  }, [masterBytes, schoolName, className, sheetCode]);

  useEffect(() => {
    void build(Math.max(1, studentCount || 30));
    // Build once on open; later builds come from the copies button.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [build]);

  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  const markPrinted = () => {
    void fetch("/api/teacher/class-package-assignments", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignmentId, action: "mark_printed" }),
    }).catch(() => undefined);
  };

  const print = () => {
    markPrinted();
    const frame = frameRef.current?.contentWindow;
    try {
      frame?.focus();
      frame?.print();
    } catch {
      if (url) window.open(url, "_blank", "noopener");
    }
  };

  return (
    <div className="min-h-screen bg-[#f7fafc] text-brand-navy" dir="rtl">
      <div className="sticky top-0 z-10 border-b border-slate-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link href="/dashboard/teacher" className="flex items-center gap-1 text-sm font-bold text-slate-500 hover:text-brand">
            <ArrowRight className="h-4 w-4" /> العودة
          </Link>
          <div className="flex flex-wrap items-center gap-2 text-xs font-extrabold">
            <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-1.5 text-slate-600">
              عدد النسخ
              <input
                type="number"
                min={1}
                max={200}
                value={copies}
                onChange={(e) => setCopies(Math.max(1, Math.min(200, Number(e.target.value) || 1)))}
                className="w-16 rounded-lg border border-slate-200 px-2 py-1 text-center"
              />
              <button onClick={() => void build(copies)} disabled={busy || !sheetCode} className="rounded-lg bg-slate-100 px-2 py-1 text-slate-700 disabled:opacity-50">
                تحديث
              </button>
            </label>
            {url && (
              <>
                <a href={url} download={fileName} onClick={markPrinted} className="flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-slate-600 hover:text-brand">
                  <Download className="h-4 w-4" /> تنزيل
                </a>
                <a href={url} target="_blank" rel="noreferrer" onClick={markPrinted} className="flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-slate-600 hover:text-brand">
                  <ExternalLink className="h-4 w-4" /> فتح
                </a>
              </>
            )}
            <button onClick={print} disabled={!url || busy} className="flex items-center gap-1 rounded-xl bg-brand px-4 py-2 text-white disabled:opacity-50">
              <Printer className="h-4 w-4" /> طباعة
            </button>
          </div>
        </div>
        <div className="mx-auto max-w-4xl space-y-1 px-4 pb-3 text-xs font-bold text-slate-500">
          <p>
            ورقة {master.stamp.subjectTitle} لـ{classLabelText(master.stamp, className)}، مطبوع عليها اسم المدرسة ورمز الفصل. يكتب الطالب رقمه ويظلّله ويظلّل إجاباته على الورقة نفسها، ثم يقرؤها {BRAND.nameAr} بالكاميرا دون ذكاء اصطناعي.
          </p>
          <p>اطبع هذا الملف كما هو. رمز الفصل يختلف من فصل لآخر، فلا تستخدم أوراق فصل لفصل آخر.</p>
        </div>
      </div>

      <main className="mx-auto max-w-4xl px-4 py-6">
        {!sheetCode && (
          <p className="rounded-xl border border-amber-100 bg-amber-50 p-4 text-sm font-bold text-amber-800">لا يوجد رمز لهذا الفصل بعد. أعد تحميل الصفحة بعد قليل.</p>
        )}
        {error && <p className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm font-bold text-red-700">{error}</p>}
        {busy && <p className="text-center text-sm font-bold text-slate-400">جارٍ تجهيز {toEnglishDigits(copies)} نسخة...</p>}
        {url && (
          <iframe
            ref={frameRef}
            src={url}
            title="ورقة الأسئلة"
            className="h-[80vh] w-full rounded-xl border border-slate-200 bg-white"
          />
        )}
      </main>
    </div>
  );
}
