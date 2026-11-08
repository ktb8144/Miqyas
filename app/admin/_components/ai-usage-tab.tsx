"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { toEnglishDigits } from "@/lib/format";
import { EmptyState, PageHeader, SoftButton } from "./ui";

type Bucket = { calls: number; errors: number; inputTokens: number; outputTokens: number; costUsd: number };
type UsageData = {
  period: string;
  from: string;
  to: string;
  creditUsd: number;
  total: Bucket;
  perDayUsd: number;
  byTask: Array<Bucket & { task: string }>;
  bySchool: Array<Bucket & { schoolId: string | null; school: string }>;
  recent: Array<{
    at: string;
    task: string;
    school: string;
    model: string;
    effort: string | null;
    batch: boolean;
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
    seconds: number | null;
    status: "ok" | "error";
    errorKind: string | null;
  }>;
};

const TASKS: Record<string, string> = {
  class_report: "تقرير الفصل الأسبوعي",
  nafs_analysis: "تحليل نافس المعمّق",
  student_names: "قراءة كشف الأسماء",
};
const PERIODS = [
  { id: "month", label: "هذا الشهر" },
  { id: "30d", label: "آخر 30 يومًا" },
  { id: "last_month", label: "الشهر الماضي" },
];

const usd = (value: number) => `$${toEnglishDigits(value.toFixed(value < 1 ? 3 : 2))}`;
const tokens = (value: number) => toEnglishDigits(value >= 1_000_000 ? `${(value / 1_000_000).toFixed(2)}M` : value >= 1000 ? `${(value / 1000).toFixed(1)}K` : String(value));

function Table({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-right text-sm">
        <thead>
          <tr className="border-b border-slate-100 text-xs font-extrabold text-slate-400">
            {head.map((h) => <th key={h} className="px-3 py-2">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, i) => (
            <tr key={i} className="border-b border-slate-50 font-bold text-slate-700">
              {cells.map((cell, j) => <td key={j} className="px-3 py-2.5">{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Claude usage and estimated cost, against the monthly API credit. */
export function AiUsageTab() {
  const [period, setPeriod] = useState("month");
  const [data, setData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/ai-usage?period=${period}`, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) throw new Error(json.error || "تعذر تحميل الاستهلاك");
      setData(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تحميل الاستهلاك");
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    load();
  }, [load]);

  const used = data?.total.costUsd ?? 0;
  const share = data ? Math.min(100, Math.round((used / data.creditUsd) * 100)) : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="استهلاك Claude"
        description="التوكنز والتكلفة التقديرية لكل مهمة ولكل مدرسة، مقارنة برصيد الـ API الشهري. الفاتورة الفعلية في Claude Console."
        action={
          <SoftButton onClick={load} disabled={loading}>
            <RefreshCw className="h-4 w-4" /> تحديث
          </SoftButton>
        }
      />

      <div className="flex flex-wrap gap-2">
        {PERIODS.map((p) => (
          <button
            key={p.id}
            onClick={() => setPeriod(p.id)}
            className={`rounded-xl border px-4 py-2 text-sm font-extrabold ${period === p.id ? "border-brand bg-teal-50 text-brand" : "border-slate-200 bg-white text-slate-500"}`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {error && <p className="rounded-xl border border-rose-100 bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</p>}
      {loading && !data && <EmptyState message="جارٍ التحميل..." />}

      {data && (
        <>
          <div className="rounded-[1.5rem] border border-slate-100 bg-white p-6 shadow-[0_10px_34px_rgba(15,35,55,0.035)]">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-sm font-extrabold text-slate-400">التكلفة التقديرية</p>
                <p className="mt-1 text-4xl font-black text-brand-navy">{usd(used)}</p>
                <p className="mt-1 text-sm font-bold text-slate-400">من رصيد {usd(data.creditUsd)} · {toEnglishDigits(share)}%</p>
              </div>
              <div className="grid grid-cols-3 gap-6 text-center">
                <div><p className="text-xs font-extrabold text-slate-400">طلبات</p><p className="text-xl font-black text-slate-700">{toEnglishDigits(data.total.calls)}</p></div>
                <div><p className="text-xs font-extrabold text-slate-400">توكنز داخلة</p><p className="text-xl font-black text-slate-700">{tokens(data.total.inputTokens)}</p></div>
                <div><p className="text-xs font-extrabold text-slate-400">توكنز خارجة (مع التفكير)</p><p className="text-xl font-black text-slate-700">{tokens(data.total.outputTokens)}</p></div>
              </div>
            </div>
            <div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-100">
              <div className={`h-full rounded-full ${share >= 85 ? "bg-rose-500" : share >= 60 ? "bg-amber-500" : "bg-brand"}`} style={{ width: `${share}%` }} />
            </div>
            <p className="mt-2 text-xs font-bold text-slate-400">
              بمعدل {usd(data.perDayUsd)} يوميًا في هذه الفترة.
              {data.total.errors ? ` ${toEnglishDigits(data.total.errors)} طلب فشل (حُسب ما استُهلك منه).` : ""}
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-[1.5rem] border border-slate-100 bg-white p-5">
              <h2 className="mb-3 font-black text-brand-navy">حسب المهمة</h2>
              {data.byTask.length ? (
                <Table
                  head={["المهمة", "طلبات", "داخلة", "خارجة", "التكلفة"]}
                  rows={data.byTask.map((t) => [TASKS[t.task] ?? t.task, toEnglishDigits(t.calls), tokens(t.inputTokens), tokens(t.outputTokens), usd(t.costUsd)])}
                />
              ) : <EmptyState message="لا يوجد استهلاك في هذه الفترة." />}
            </section>
            <section className="rounded-[1.5rem] border border-slate-100 bg-white p-5">
              <h2 className="mb-3 font-black text-brand-navy">حسب المدرسة</h2>
              {data.bySchool.length ? (
                <Table
                  head={["المدرسة", "طلبات", "التكلفة"]}
                  rows={data.bySchool.map((s) => [s.school, toEnglishDigits(s.calls), usd(s.costUsd)])}
                />
              ) : <EmptyState message="لا يوجد استهلاك في هذه الفترة." />}
            </section>
          </div>

          <section className="rounded-[1.5rem] border border-slate-100 bg-white p-5">
            <h2 className="mb-3 font-black text-brand-navy">آخر الطلبات</h2>
            {data.recent.length ? (
              <Table
                head={["الوقت", "المهمة", "المدرسة", "النموذج", "داخلة", "خارجة", "المدة", "التكلفة", ""]}
                rows={data.recent.map((r) => [
                  toEnglishDigits(new Date(r.at).toLocaleString("en-GB", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })),
                  TASKS[r.task] ?? r.task,
                  r.school,
                  <span key="m" dir="ltr" className="text-xs">{r.model.replace("claude-", "")}{r.effort ? ` · ${r.effort}` : ""}{r.batch ? " · batch" : ""}</span>,
                  tokens(r.inputTokens),
                  tokens(r.outputTokens),
                  r.seconds ? `${toEnglishDigits(r.seconds)} ث` : "—",
                  usd(r.costUsd),
                  r.status === "ok" ? <span key="s" className="text-emerald-600">✓</span> : <span key="s" className="text-rose-600" title={r.errorKind ?? ""}>✗ {r.errorKind}</span>,
                ])}
              />
            ) : <EmptyState message="لا يوجد طلبات بعد." />}
          </section>
        </>
      )}
    </div>
  );
}
