"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Download, Lock, RefreshCw } from "lucide-react";
import { formatShortDate, toEnglishDigits } from "@/lib/format";
import { stageLabel } from "@/lib/stages";
import { EmptyState, ErrorState, PageHeader, SoftButton } from "./ui";

type ResearchData = {
  currentVersion: string;
  minCell: number;
  exportEnabled: boolean;
  totals: { schools: number; participating: number; outdated: number; optedOutStudents: number };
  participating: Array<{ name: string; kind: string; stage: string | null; since: string | null }>;
  events: Array<{ at: string; granted: boolean; source: string; version: string; school: string; by: string | null }>;
  exports: Array<{ at: string; version: string; schools: number; students: number; rows: number; suppressedClasses: number; by: string | null }>;
};

const SOURCES: Record<string, string> = { signup: "عند التسجيل", settings: "من اللوحة", admin: "من الإدارة" };

function Box({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[1.5rem] border border-slate-100 bg-white p-5 shadow-[0_10px_34px_rgba(15,35,55,0.035)]">
      <h2 className="mb-4 text-lg font-black text-brand-navy">{title}</h2>
      {children}
    </section>
  );
}

function Stat({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-[1.25rem] border border-slate-100 bg-white p-4 shadow-[0_10px_34px_rgba(15,35,55,0.035)]">
      <p className="text-xs font-bold text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-black text-brand-navy">{toEnglishDigits(value)}</p>
      {hint && <p className="mt-1 text-xs font-bold text-slate-400">{hint}</p>}
    </div>
  );
}

/** Research participation: opted-in schools, parent exclusions, consent history and the locked export. */
export function ResearchTab() {
  const [data, setData] = useState<ResearchData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/research", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) throw new Error(json.error || "تعذر تحميل بيانات البحث");
      setData(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تحميل بيانات البحث");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const download = async () => {
    setExporting(true);
    setExportError(null);
    try {
      const res = await fetch("/api/admin/research/export", { cache: "no-store" });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "تعذر إنشاء الملف");
      }
      const blob = await res.blob();
      const name = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? "dala-research.zip";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
      load();
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "تعذر إنشاء الملف");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="البحث العلمي"
        description="المدارس التي وافقت على المشاركة، واستبعادات أولياء الأمور، وسجل الموافقات والتصدير. لا يُصدَّر إلا ملف مجهّل، وبعد الموافقات فقط."
        action={
          <SoftButton onClick={load} disabled={loading}>
            <RefreshCw className="h-4 w-4" /> تحديث
          </SoftButton>
        }
      />

      {error && <ErrorState message={error} onRetry={load} />}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="مدارس مشاركة" value={data.totals.participating} hint={`من ${toEnglishDigits(data.totals.schools)} حساب`} />
            <Stat label="موافقات بحاجة لتأكيد" value={data.totals.outdated} hint="أُعطيت لنسخة سابقة" />
            <Stat label="طلاب استبعدهم أولياء الأمور" value={data.totals.optedOutStudents} />
            <Stat label="عمليات تصدير" value={data.exports.length} hint="آخر 20" />
          </div>

          <Box title="التصدير البحثي المجهّل">
            <p className="text-sm font-bold leading-7 text-slate-500">
              ملف ZIP فيه إجابات الطلاب وملخص المهارات ونتائج نافس السابقة، برموز عشوائية جديدة في كل تصدير، دون أسماء أو اسم مدرسة،
              مع حذف أي فصل أو خلية أقل من {toEnglishDigits(data.minCell)} طلاب. يشمل المدارس الموافقة على نسخة {data.currentVersion} فقط.{" "}
              <Link href="/research" target="_blank" className="text-brand underline">صفحة البحث العامة</Link>
            </p>
            {data.exportEnabled ? (
              <button
                type="button"
                onClick={download}
                disabled={exporting}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-extrabold text-white disabled:opacity-60"
              >
                <Download className="h-4 w-4" /> {exporting ? "جارٍ تجهيز الملف..." : "تنزيل الملف البحثي"}
              </button>
            ) : (
              <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-100 bg-amber-50 p-3 text-sm font-bold leading-7 text-amber-800">
                <Lock className="mt-1 h-4 w-4 flex-shrink-0" />
                <span>
                  التصدير مقفل. يُفتح بعد صدور موافقة لجنة الأخلاقيات وموافقة وزارة التعليم، بإضافة المتغير{" "}
                  <code dir="ltr" className="rounded bg-white px-1">RESEARCH_EXPORT_ENABLED=true</code> في Vercel.
                </span>
              </div>
            )}
            {exportError && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700">{exportError}</p>}
          </Box>

          <Box title="المدارس المشاركة">
            {data.participating.length === 0 ? (
              <EmptyState message="لا توجد مدارس مشاركة بعد." />
            ) : (
              <ul className="divide-y divide-slate-50">
                {data.participating.map((s, i) => (
                  <li key={`${s.name}-${i}`} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm font-bold text-slate-700">
                    <span>{s.name}</span>
                    <span className="text-xs text-slate-400">
                      {s.kind === "individual" ? "معلم مستقل" : "مدرسة"} · {stageLabel(s.stage)} · منذ {formatShortDate(s.since)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Box>

          <Box title="سجل الموافقات">
            {data.events.length === 0 ? (
              <EmptyState message="لا توجد قرارات بعد." />
            ) : (
              <ul className="divide-y divide-slate-50">
                {data.events.map((e, i) => (
                  <li key={i} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm font-bold">
                    <span className="text-slate-700">
                      <span className={e.granted ? "text-brand" : "text-rose-600"}>{e.granted ? "موافقة" : "سحب"}</span> — {e.school}
                      {e.by ? <span className="text-slate-400"> ({e.by})</span> : null}
                    </span>
                    <span className="text-xs text-slate-400">
                      {SOURCES[e.source] ?? e.source} · نسخة {e.version} · {formatShortDate(e.at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Box>

          <Box title="سجل التصدير">
            {data.exports.length === 0 ? (
              <EmptyState message="لم يُصدَّر أي ملف بحثي." />
            ) : (
              <ul className="divide-y divide-slate-50">
                {data.exports.map((x, i) => (
                  <li key={i} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm font-bold text-slate-700">
                    <span>
                      {formatShortDate(x.at)} — {toEnglishDigits(x.schools)} مدرسة، {toEnglishDigits(x.students)} طالب، {toEnglishDigits(x.rows)} إجابة
                    </span>
                    <span className="text-xs text-slate-400">
                      {x.by ?? "—"} · فصول محذوفة لصغرها: {toEnglishDigits(x.suppressedClasses)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Box>
        </>
      )}
    </div>
  );
}
