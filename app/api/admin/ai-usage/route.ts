import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase-admin";
import { requireAdmin, authErrorResponse } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Monthly API credit to measure against (Claude plan credit; override with CLAUDE_MONTHLY_CREDIT_USD). */
const CREDIT_USD = Number(process.env.CLAUDE_MONTHLY_CREDIT_USD) || 200;

type Row = {
  created_at: string;
  school_id: string | null;
  task: string;
  model: string;
  effort: string | null;
  batch: boolean;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  cost_usd: number | string;
  duration_ms: number | null;
  status: "ok" | "error";
  error_kind: string | null;
};

type Bucket = { calls: number; errors: number; inputTokens: number; outputTokens: number; costUsd: number };
const empty = (): Bucket => ({ calls: 0, errors: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 });
function add(bucket: Bucket, row: Row) {
  bucket.calls++;
  if (row.status === "error") bucket.errors++;
  bucket.inputTokens += row.input_tokens + row.cache_read_tokens + row.cache_write_tokens;
  bucket.outputTokens += row.output_tokens;
  bucket.costUsd += Number(row.cost_usd) || 0;
}
const round = (b: Bucket) => ({ ...b, costUsd: Math.round(b.costUsd * 100) / 100 });

/**
 * Claude usage for the admin panel: ?period=month (this calendar month, UTC) | 30d | last_month.
 */
export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin.ok) return authErrorResponse(admin);

  const period = req.nextUrl.searchParams.get("period") ?? "month";
  const now = new Date();
  let from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  let to = now;
  if (period === "30d") from = new Date(now.getTime() - 30 * 86400000);
  if (period === "last_month") {
    from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  }

  try {
    const db = getAdminClient();
    const rows: Row[] = [];
    for (let page = 0; page < 50; page++) {
      const { data, error } = await db
        .from("ai_usage")
        .select("created_at, school_id, task, model, effort, batch, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, cost_usd, duration_ms, status, error_kind")
        .gte("created_at", from.toISOString())
        .lt("created_at", to.toISOString())
        .order("created_at", { ascending: false })
        .range(page * 1000, page * 1000 + 999);
      if (error) {
        if (error.code === "42P01" || error.code === "PGRST205") {
          return NextResponse.json({ success: false, error: "جدول الاستهلاك غير موجود بعد في قاعدة البيانات." }, { status: 503 });
        }
        throw error;
      }
      rows.push(...((data ?? []) as Row[]));
      if (!data || data.length < 1000) break;
    }

    const total = empty();
    const byTask = new Map<string, Bucket>();
    const bySchool = new Map<string | null, Bucket>();
    rows.forEach((row) => {
      add(total, row);
      add(byTask.get(row.task) ?? byTask.set(row.task, empty()).get(row.task)!, row);
      add(bySchool.get(row.school_id) ?? bySchool.set(row.school_id, empty()).get(row.school_id)!, row);
    });

    const schoolIds = Array.from(bySchool.keys()).filter((id): id is string => Boolean(id));
    const names = new Map<string, string>();
    if (schoolIds.length) {
      const { data } = await db.from("schools").select("id, name").in("id", schoolIds);
      (data ?? []).forEach((s: { id: string; name: string | null }) => names.set(s.id, s.name ?? "مدرسة"));
    }

    const days = Math.max(1, (to.getTime() - from.getTime()) / 86400000);
    return NextResponse.json(
      {
        success: true,
        data: {
          period,
          from: from.toISOString(),
          to: to.toISOString(),
          creditUsd: CREDIT_USD,
          total: round(total),
          perDayUsd: Math.round((total.costUsd / days) * 100) / 100,
          byTask: Array.from(byTask.entries()).map(([task, b]) => ({ task, ...round(b) })).sort((a, b) => b.costUsd - a.costUsd),
          bySchool: Array.from(bySchool.entries())
            .map(([id, b]) => ({ schoolId: id, school: id ? names.get(id) ?? "مدرسة محذوفة" : "بدون مدرسة", ...round(b) }))
            .sort((a, b) => b.costUsd - a.costUsd),
          recent: rows.slice(0, 20).map((r) => ({
            at: r.created_at,
            task: r.task,
            school: r.school_id ? names.get(r.school_id) ?? "مدرسة محذوفة" : "—",
            model: r.model,
            effort: r.effort,
            batch: r.batch,
            inputTokens: r.input_tokens + r.cache_read_tokens + r.cache_write_tokens,
            outputTokens: r.output_tokens,
            costUsd: Number(r.cost_usd) || 0,
            seconds: r.duration_ms ? Math.round(r.duration_ms / 100) / 10 : null,
            status: r.status,
            errorKind: r.error_kind,
          })),
        },
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("admin ai usage failed", err);
    return NextResponse.json({ success: false, error: "تعذر تحميل استهلاك Claude" }, { status: 500 });
  }
}
