import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminClient } from "@/lib/supabase-admin";
import { requireUserRole, authErrorResponse } from "@/lib/auth";
import { fromRow, type NafsBaselineRow } from "@/lib/nafs/baseline";
import { buildNafsPlan } from "@/lib/nafs/plan";
import { claudeConfigured, claudeFailureNotice, createClaudeBatch, readClaudeBatch, ClaudeError } from "@/lib/claude";
import {
  buildNafsAnalysisUserMessage,
  NAFS_ANALYSIS_JSON_SCHEMA,
  NAFS_ANALYSIS_SYSTEM,
  nafsInputHash,
  parseNafsAnalysis,
} from "@/lib/nafs/analysis-ai";

export const dynamic = "force-dynamic";

/**
 * The deep NAFS analysis (principal only).
 *   GET  → the analysis for the school's current NAFS results: none | pending | ready | failed.
 *        While pending, it checks the Claude batch and stores the result once it has ended.
 *   POST → starts the analysis (or returns the existing one). Body { refresh: true } re-runs it.
 * Claude runs with effort "max" in the Message Batches API, so no request has to stay open.
 */

const BASELINE_SELECT = "year, grade, subject, overall_percent, mastery_percent, tested_count, absent_count, domains";
const ANALYSIS_SELECT = "id, status, batch_id, analysis, error, model, effort, created_by, created_at, updated_at";
const NOT_READY = "التحليل المعمّق غير مفعّل بعد في قاعدة البيانات. تواصل مع فريق دالة.";

type AnalysisRow = {
  id: string;
  status: "pending" | "ready" | "failed";
  batch_id: string | null;
  analysis: unknown;
  error: string | null;
  model: string | null;
  effort: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

function missingTable(error: { code?: string; message?: string } | null) {
  return Boolean(error && (error.code === "42P01" || error.code === "PGRST205" || /nafs_analyses/.test(error.message ?? "")));
}

async function loadSchool(schoolId: string) {
  const db = getAdminClient();
  const { data, error } = await db.from("nafs_baselines").select(BASELINE_SELECT).eq("school_id", schoolId);
  if (error) throw error;
  const baselines = ((data ?? []) as NafsBaselineRow[]).map(fromRow);
  const plan = buildNafsPlan(baselines);
  return { db, baselines, plan, hash: plan ? nafsInputHash(baselines) : null };
}

function respond(row: AnalysisRow | null, extra: Record<string, unknown> = {}) {
  return NextResponse.json(
    {
      success: true,
      enabled: claudeConfigured(),
      status: row?.status ?? "none",
      analysis: row?.status === "ready" ? row.analysis : null,
      error: row?.status === "failed" ? row.error : null,
      generatedAt: row?.status === "ready" ? row.updated_at : null,
      ...extra,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function GET(req: NextRequest) {
  const auth = await requireUserRole(req, ["principal"]);
  if (!auth.ok) return authErrorResponse(auth);
  const schoolId = auth.profile.school_id;
  if (!schoolId) return NextResponse.json({ success: false, error: "حسابك غير مرتبط بمدرسة" }, { status: 400 });

  try {
    const { db, plan, hash } = await loadSchool(schoolId);
    if (!plan || !hash) return respond(null);

    const { data, error } = await db.from("nafs_analyses").select(ANALYSIS_SELECT).eq("school_id", schoolId).eq("input_hash", hash).maybeSingle();
    if (error) {
      if (missingTable(error)) return respond(null, { enabled: false });
      throw error;
    }
    let row = data as AnalysisRow | null;

    // Collect a finished batch.
    if (row?.status === "pending" && row.batch_id && claudeConfigured()) {
      const outcome = await readClaudeBatch(row.batch_id, {
        task: "nafs_analysis",
        effort: row.effort ?? undefined,
        context: { schoolId, userId: row.created_by },
      }).catch((err) => {
        console.error("nafs analysis batch check failed", err);
        return null;
      });
      if (outcome && outcome.status !== "pending") {
        const analysis = outcome.status === "ready" ? parseNafsAnalysis(outcome.data, plan) : null;
        const update = analysis
          ? { status: "ready" as const, analysis, model: outcome.status === "ready" ? outcome.model : row.model, usage: outcome.status === "ready" ? outcome.usage : null, error: null }
          : {
              status: "failed" as const,
              error: outcome.status === "failed"
                ? `${claudeFailureNotice(new ClaudeError(outcome.kind, outcome.error))}. أعد المحاولة.`
                : "لم يطابق التحليل بيانات المدرسة. أعد المحاولة.",
            };
        if (outcome.status === "failed") console.error("nafs analysis batch failed", outcome);
        const { data: saved, error: saveError } = await db
          .from("nafs_analyses")
          .update({ ...update, updated_at: new Date().toISOString() })
          .eq("id", row.id)
          .select(ANALYSIS_SELECT)
          .single();
        if (saveError) throw saveError;
        row = saved as AnalysisRow;
      }
    }
    return respond(row);
  } catch (err) {
    console.error("nafs analysis read failed", err);
    return NextResponse.json({ success: false, error: "تعذر تحميل التحليل المعمّق" }, { status: 500 });
  }
}

const postSchema = z.object({ refresh: z.boolean().optional() }).optional();

export async function POST(req: NextRequest) {
  const auth = await requireUserRole(req, ["principal"]);
  if (!auth.ok) return authErrorResponse(auth);
  const schoolId = auth.profile.school_id;
  if (!schoolId) return NextResponse.json({ success: false, error: "حسابك غير مرتبط بمدرسة" }, { status: 400 });
  if (!claudeConfigured()) {
    return NextResponse.json({ success: false, error: "التحليل المعمّق غير مفعّل حاليًا." }, { status: 503 });
  }
  const body = postSchema.safeParse(await req.json().catch(() => undefined));
  const refresh = body.success ? Boolean(body.data?.refresh) : false;

  try {
    const { db, baselines, plan, hash } = await loadSchool(schoolId);
    if (!plan || !hash) {
      return NextResponse.json({ success: false, error: "أدخل نتائج نافس السابقة أولًا من تبويب «نافس السابق»." }, { status: 400 });
    }

    const { data: existing, error } = await db.from("nafs_analyses").select(ANALYSIS_SELECT).eq("school_id", schoolId).eq("input_hash", hash).maybeSingle();
    if (error) {
      if (missingTable(error)) return NextResponse.json({ success: false, error: NOT_READY }, { status: 503 });
      throw error;
    }
    const current = existing as AnalysisRow | null;
    // One analysis per set of results: a pending or ready one is reused unless the principal asks again.
    if (current && current.status !== "failed" && (!refresh || current.status === "pending")) return respond(current);

    const batch = await createClaudeBatch({
      task: "nafs_analysis",
      customId: `nafs-${hash.slice(0, 40)}`,
      system: NAFS_ANALYSIS_SYSTEM,
      prompt: buildNafsAnalysisUserMessage(baselines, plan),
      schema: NAFS_ANALYSIS_JSON_SCHEMA,
      maxTokens: 64000,
    });

    const { data: saved, error: saveError } = await db
      .from("nafs_analyses")
      .upsert(
        {
          school_id: schoolId,
          input_hash: hash,
          status: "pending",
          batch_id: batch.batchId,
          model: batch.model,
          effort: batch.effort,
          analysis: null,
          usage: null,
          error: null,
          created_by: auth.profile.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "school_id,input_hash" }
      )
      .select(ANALYSIS_SELECT)
      .single();
    if (saveError) throw saveError;
    return respond(saved as AnalysisRow);
  } catch (err) {
    console.error("nafs analysis start failed", err);
    const message = err instanceof ClaudeError ? `${claudeFailureNotice(err)}. حاول لاحقًا.` : "تعذر بدء التحليل المعمّق";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
