"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Sparkles, RefreshCw, Copy, Check } from "lucide-react";
import type { NafsAnalysis } from "@/lib/nafs/analysis-ai";

type Status = "loading" | "none" | "pending" | "ready" | "failed" | "disabled";

const POLL_MS = 20000;

const CONFIDENCE_STYLE: Record<string, string> = {
  "عالية": "bg-teal-50 text-teal-800",
  "متوسطة": "bg-amber-50 text-amber-800",
  "منخفضة": "bg-slate-100 text-slate-600",
};

/**
 * The deep NAFS analysis on the plan page. Claude runs in the background (a batch), so the
 * principal can close the page and come back; while it runs, the page checks every 20 seconds.
 */
export function NafsDeepAnalysis() {
  const [status, setStatus] = useState<Status>("loading");
  const [analysis, setAnalysis] = useState<NafsAnalysis | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const apply = useCallback((json: { enabled?: boolean; status?: string; analysis?: NafsAnalysis | null; error?: string | null; generatedAt?: string | null }) => {
    if (json.enabled === false && json.status !== "ready") {
      setStatus("disabled");
      return;
    }
    setStatus((json.status as Status) ?? "none");
    setAnalysis(json.analysis ?? null);
    setGeneratedAt(json.generatedAt ?? null);
    setError(json.status === "failed" ? json.error ?? "تعذر التحليل المعمّق" : null);
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/principal/nafs-analysis", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) throw new Error(json.error || "تعذر تحميل التحليل المعمّق");
      apply(json);
    } catch (err) {
      setStatus("failed");
      setError(err instanceof Error ? err.message : "تعذر تحميل التحليل المعمّق");
    }
  }, [apply]);

  useEffect(() => {
    load();
  }, [load]);

  // While Claude works, check again every 20 seconds.
  useEffect(() => {
    if (status !== "pending") return;
    timer.current = setTimeout(load, POLL_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [status, load]);

  async function start(refresh = false) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/principal/nafs-analysis", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ refresh }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) throw new Error(json.error || "تعذر بدء التحليل المعمّق");
      apply(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر بدء التحليل المعمّق");
    } finally {
      setBusy(false);
    }
  }

  async function copyBrief() {
    if (!analysis?.teacherBrief) return;
    try {
      await navigator.clipboard.writeText(analysis.teacherBrief);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked; the text is still on the page to copy by hand.
    }
  }

  if (status === "disabled" || status === "loading") return null;

  return (
    <section className="rounded-2xl border-2 border-teal-100 bg-white p-6 print:border-0 print:p-0">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-black">
          <Sparkles className="h-5 w-5 text-brand print:hidden" /> التحليل المعمّق
        </h2>
        {status === "ready" && (
          <button
            onClick={() => start(true)}
            disabled={busy}
            className="flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-brand disabled:opacity-50 print:hidden"
          >
            <RefreshCw className="h-3.5 w-3.5" /> إعادة التحليل
          </button>
        )}
      </div>

      {status === "none" && (
        <div className="space-y-3 print:hidden">
          <p className="text-sm font-bold text-slate-600">
            قراءة معمّقة لنتائج نافس السابقة: ما تعنيه الأرقام مجتمعة، والأسباب الجذرية المرجّحة، وخطة أول 90 يومًا مرتبطة بدورة دالة.
          </p>
          <button onClick={() => start(false)} disabled={busy} className="rounded-xl bg-brand px-5 py-2.5 text-sm font-extrabold text-white disabled:opacity-60">
            {busy ? "جارٍ البدء..." : "ابدأ التحليل المعمّق"}
          </button>
        </div>
      )}

      {status === "pending" && (
        <div className="flex items-center gap-3 rounded-xl bg-teal-50 p-4 print:hidden">
          <div className="h-8 w-8 shrink-0 animate-spin rounded-full border-4 border-teal-100 border-t-brand" />
          <div>
            <p className="text-sm font-black text-teal-900">يعمل التحليل المعمّق على نتائج مدرستكم...</p>
            <p className="text-xs font-bold text-teal-700">يستغرق عادة بضع دقائق. يمكنك إغلاق الصفحة والعودة لاحقًا، وستجده هنا.</p>
          </div>
        </div>
      )}

      {status === "failed" && (
        <div className="space-y-3 print:hidden">
          <p className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>
          <button onClick={() => start(true)} disabled={busy} className="rounded-xl border-2 border-brand px-4 py-2 text-sm font-extrabold text-brand disabled:opacity-60">
            {busy ? "جارٍ البدء..." : "أعد المحاولة"}
          </button>
        </div>
      )}

      {error && status !== "failed" && <p className="mt-2 text-sm font-bold text-red-600 print:hidden">{error}</p>}

      {status === "ready" && analysis && (
        <div className="space-y-6">
          <p className="text-[15px] font-bold leading-loose text-slate-800">{analysis.executiveSummary}</p>

          <div>
            <h3 className="mb-2 text-sm font-black text-slate-500">استنتاجات رئيسية</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {analysis.keyInsights.map((insight) => (
                <div key={insight.title} className="rounded-xl border border-slate-100 p-3 print:break-inside-avoid">
                  <p className="text-sm font-black">{insight.title}</p>
                  <p className="mt-1 text-xs font-bold leading-relaxed text-slate-600">{insight.detail}</p>
                  <p className="mt-2 text-[11px] font-bold text-slate-400">الدليل: {insight.evidence}</p>
                </div>
              ))}
            </div>
          </div>

          {analysis.rootCauses.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-black text-slate-500">الأسباب الجذرية المرجّحة</h3>
              <ol className="space-y-3">
                {analysis.rootCauses.map((cause, index) => (
                  <li key={index} className="rounded-xl bg-slate-50 p-3 print:break-inside-avoid">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="flex-1 text-sm font-black leading-relaxed">{cause.hypothesis}</p>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${CONFIDENCE_STYLE[cause.confidence] ?? ""}`}>ثقة {cause.confidence}</span>
                    </div>
                    <p className="mt-1 text-[11px] font-bold text-slate-500">
                      يفسّر: {cause.relatedDomains.map((d) => `${d.domain} (${d.subject}، الصف ${d.grade})`).join("، ")}
                    </p>
                    <p className="mt-2 text-xs font-bold text-slate-600">للتحقق: {cause.howToVerify}</p>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {analysis.plan90Days.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-black text-slate-500">خطة أول 90 يومًا</h3>
              <div className="grid gap-3 sm:grid-cols-3">
                {analysis.plan90Days.map((phase) => (
                  <div key={phase.period} className="rounded-xl border border-slate-100 p-3 print:break-inside-avoid">
                    <p className="text-xs font-black text-brand">{phase.period}</p>
                    <p className="mt-1 text-sm font-black">{phase.focus}</p>
                    <ul className="mt-2 list-disc space-y-1 pr-4 text-xs font-bold text-slate-600">
                      {phase.actions.map((action) => <li key={action}>{action}</li>)}
                    </ul>
                    <p className="mt-2 text-[11px] font-bold text-slate-400">القياس: {phase.measure}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {analysis.quickWins.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-black text-slate-500">ابدأ هذا الأسبوع</h3>
              <ul className="list-disc space-y-1 pr-5 text-sm font-bold text-slate-700">
                {analysis.quickWins.map((win) => <li key={win}>{win}</li>)}
              </ul>
            </div>
          )}

          {analysis.teacherBrief && (
            <div className="rounded-xl bg-teal-50 p-4 print:break-inside-avoid">
              <div className="mb-1 flex items-center justify-between">
                <h3 className="text-sm font-black text-teal-900">رسالة مقترحة للمعلمين</h3>
                <button onClick={copyBrief} className="flex items-center gap-1 text-xs font-bold text-teal-700 print:hidden">
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copied ? "نُسخت" : "نسخ"}
                </button>
              </div>
              <p className="whitespace-pre-line text-sm font-bold leading-relaxed text-teal-900">{analysis.teacherBrief}</p>
            </div>
          )}

          {analysis.dataCaveats.length > 0 && (
            <div className="text-xs font-bold text-slate-500">
              <h3 className="mb-1 font-black">حدود هذا التحليل</h3>
              <ul className="list-disc space-y-1 pr-5">
                {analysis.dataCaveats.map((caveat) => <li key={caveat}>{caveat}</li>)}
              </ul>
            </div>
          )}

          <p className="border-t border-slate-100 pt-3 text-[11px] font-bold text-slate-400">
            ✦ كتب هذا التحليل الذكاء الاصطناعي من نتائج نافس المدخلة أعلاه
            {generatedAt ? ` بتاريخ ${new Date(generatedAt).toLocaleDateString("ar-SA-u-nu-latn", { day: "numeric", month: "long", year: "numeric" })}` : ""}.
            الأرقام في الجداول محسوبة من تقرير المدرسة مباشرة، والتفسير اقتراح يراجعه قائد المدرسة قبل اعتماده.
          </p>
        </div>
      )}
    </section>
  );
}
