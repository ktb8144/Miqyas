import "server-only";
import { getAdminClient } from "@/lib/supabase-admin";

/**
 * Minimal Claude Messages API client for Dala's text-only analysis tasks (no SDK dependency).
 *
 * - Streams the reply (server-sent events) so long thinking never leaves an idle connection.
 * - Adaptive thinking is always on for Opus 5.5; `output_config.effort` sets how deep it thinks.
 * - The reply is constrained to a JSON schema (`output_config.format`), then the caller still
 *   validates it against its own data, exactly like the Gemini path.
 *
 * The analysis tasks send aggregated, anonymous numbers only. The one exception is "student_names":
 * a teacher's photo of a class list, read to fill the class roster (the names are the point).
 *
 * Every call is logged in public.ai_usage (tokens + estimated cost, per school and task), shown in
 * the admin panel.
 *
 * Environment:
 *   ANTHROPIC_API_KEY             key from the Dala workspace in the Claude Console (required)
 *   CLAUDE_DISABLED=true          switch Claude off without removing the key (falls back to Gemini/rules)
 *   CLAUDE_MODEL                  default model for every task (default: claude-opus-5-5)
 *   CLAUDE_MODEL_<TASK>           per-task model, e.g. CLAUDE_MODEL_CLASS_REPORT=claude-haiku-5-5
 *   CLAUDE_EFFORT_<TASK>          low | medium | high | xhigh | max (defaults below)
 */

export type ClaudeEffort = "low" | "medium" | "high" | "xhigh" | "max";
export type ClaudeTask = "class_report" | "nafs_analysis" | "student_names";

const API_URL = "https://api.anthropic.com/v1/messages";
const API_VERSION = "2023-06-01";
const DEFAULT_MODEL = "claude-opus-5-5";
const EFFORTS: ClaudeEffort[] = ["low", "medium", "high", "xhigh", "max"];

/** How deep each task thinks unless overridden. Opus 5.5 itself defaults to "medium". */
const DEFAULT_EFFORT: Record<ClaudeTask, ClaudeEffort> = {
  class_report: "high",
  nafs_analysis: "max",
  // Reading names off a photo needs eyes, not deep thought, and the teacher is waiting.
  student_names: "low",
};

const envKey = (task: ClaudeTask) => task.toUpperCase();

export function claudeConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY) && process.env.CLAUDE_DISABLED !== "true";
}

export function claudeModel(task: ClaudeTask) {
  return process.env[`CLAUDE_MODEL_${envKey(task)}`] || process.env.CLAUDE_MODEL || DEFAULT_MODEL;
}

export function claudeEffort(task: ClaudeTask): ClaudeEffort {
  const value = process.env[`CLAUDE_EFFORT_${envKey(task)}`]?.trim().toLowerCase();
  return EFFORTS.includes(value as ClaudeEffort) ? (value as ClaudeEffort) : DEFAULT_EFFORT[task];
}

export type ClaudeErrorKind =
  | "not_configured"
  | "credits" // credit balance too low: the monthly API credits ran out
  | "rate_limit"
  | "overloaded"
  | "timeout"
  | "auth"
  | "bad_request"
  | "refusal"
  | "max_tokens"
  | "bad_output"
  | "network";

export class ClaudeError extends Error {
  constructor(public kind: ClaudeErrorKind, message: string, public status?: number) {
    super(message);
    this.name = "ClaudeError";
  }
}

export type ClaudeUsage = {
  inputTokens: number;
  /** Includes thinking tokens, which are billed as output. */
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
};

export type ClaudeJsonResult = {
  data: unknown;
  model: string;
  effort: ClaudeEffort;
  usage: ClaudeUsage;
  stopReason: string | null;
  ms: number;
};

type ApiError = { type?: string; message?: string };

function errorFromApi(status: number, error: ApiError | undefined): ClaudeError {
  const message = error?.message ?? `HTTP ${status}`;
  const type = error?.type ?? "";
  if (/credit balance/i.test(message)) return new ClaudeError("credits", message, status);
  if (status === 429 || type === "rate_limit_error") return new ClaudeError("rate_limit", message, status);
  if (status === 529 || type === "overloaded_error") return new ClaudeError("overloaded", message, status);
  if (status === 401 || status === 403) return new ClaudeError("auth", message, status);
  if (status === 400) return new ClaudeError("bad_request", message, status);
  return new ClaudeError("network", message, status);
}

/** Parses one server-sent event block ("event: x\ndata: {...}"). */
export function parseSseEvent(block: string): { event: string; data: unknown } | null {
  let event = "";
  const dataLines: string[] = [];
  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
  }
  if (!dataLines.length) return null;
  try {
    return { event, data: JSON.parse(dataLines.join("\n")) };
  } catch {
    return null;
  }
}

type StreamState = { text: string; stopReason: string | null; model: string; usage: ClaudeUsage };

/** Applies one streamed event to the running state. Throws on a streamed error event. */
export function applyStreamEvent(state: StreamState, data: unknown) {
  const e = data as {
    type?: string;
    message?: { model?: string; usage?: { input_tokens?: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number } };
    delta?: { type?: string; text?: string; stop_reason?: string | null };
    usage?: { output_tokens?: number; input_tokens?: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number };
    error?: ApiError;
  };
  switch (e.type) {
    case "message_start":
      state.model = e.message?.model ?? state.model;
      state.usage.inputTokens = e.message?.usage?.input_tokens ?? 0;
      state.usage.cacheReadTokens = e.message?.usage?.cache_read_input_tokens ?? 0;
      state.usage.cacheWriteTokens = e.message?.usage?.cache_creation_input_tokens ?? 0;
      break;
    case "content_block_delta":
      // Thinking and signature deltas are skipped: only the final answer text is kept.
      if (e.delta?.type === "text_delta" && typeof e.delta.text === "string") state.text += e.delta.text;
      break;
    case "message_delta":
      if (e.delta?.stop_reason !== undefined) state.stopReason = e.delta.stop_reason ?? null;
      if (typeof e.usage?.output_tokens === "number") state.usage.outputTokens = e.usage.output_tokens;
      if (typeof e.usage?.input_tokens === "number") state.usage.inputTokens = e.usage.input_tokens;
      break;
    case "error":
      throw errorFromApi(e.error?.type === "overloaded_error" ? 529 : 500, e.error);
    default:
      break;
  }
}

type JsonRequest = {
  task: ClaudeTask;
  system: string;
  prompt: string;
  schema: Record<string, unknown>;
  maxTokens?: number;
  /** Photos sent before the prompt (base64, e.g. image/jpeg). */
  images?: Array<{ mediaType: string; data: string }>;
  /** Who the call is for, for the usage log. */
  context?: UsageContext;
};

export type UsageContext = { schoolId?: string | null; userId?: string | null };

function apiKey() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || process.env.CLAUDE_DISABLED === "true") throw new ClaudeError("not_configured", "ANTHROPIC_API_KEY is not configured");
  return key;
}

function headers(key: string) {
  return { "content-type": "application/json", "x-api-key": key, "anthropic-version": API_VERSION };
}

/** The Messages API body shared by live calls and batches. */
function messageParams({ task, system, prompt, schema, maxTokens = 32000, images }: JsonRequest) {
  const effort = claudeEffort(task);
  const content = images?.length
    ? [
        ...images.map((image) => ({ type: "image", source: { type: "base64", media_type: image.mediaType, data: image.data } })),
        { type: "text", text: prompt },
      ]
    : prompt;
  return {
    effort,
    params: {
      model: claudeModel(task),
      max_tokens: maxTokens,
      // The instructions are identical for every class/school, so they are cached.
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content }],
      thinking: { type: "adaptive" },
      output_config: { effort, format: { type: "json_schema", schema } },
    },
  };
}

/**
 * Sends one request and returns the parsed JSON reply. Throws ClaudeError on any failure, so
 * callers can fall back (Gemini, then fixed rules).
 */
export async function generateClaudeJson(request: JsonRequest & { timeoutMs?: number }): Promise<ClaudeJsonResult> {
  const started = Date.now();
  // Filled in while the reply streams, so a failed call still logs the tokens it was billed for.
  const tracked: { model: string; usage: ClaudeUsage } = {
    model: claudeModel(request.task),
    usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 },
  };
  try {
    const result = await streamJson(request, tracked);
    await recordClaudeUsage({ task: request.task, model: result.model, effort: result.effort, usage: result.usage, ms: result.ms, ok: true, context: request.context });
    return result;
  } catch (err) {
    const kind = err instanceof ClaudeError ? err.kind : "network";
    if (kind !== "not_configured") {
      await recordClaudeUsage({
        task: request.task, model: tracked.model, effort: claudeEffort(request.task), usage: tracked.usage,
        ms: Date.now() - started, ok: false, errorKind: kind, context: request.context,
      });
    }
    throw err;
  }
}

async function streamJson(
  { timeoutMs = 180000, ...request }: JsonRequest & { timeoutMs?: number },
  tracked: { model: string; usage: ClaudeUsage }
): Promise<ClaudeJsonResult> {
  const key = apiKey();
  const { task } = request;
  const maxTokens = request.maxTokens ?? 32000;
  const { effort, params } = messageParams(request);
  const model = params.model;
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const state: StreamState = {
    text: "",
    stopReason: null,
    model,
    usage: tracked.usage,
  };

  try {
    let res: Response;
    try {
      res = await fetch(API_URL, {
        method: "POST",
        cache: "no-store",
        signal: controller.signal,
        headers: headers(key),
        body: JSON.stringify({ ...params, stream: true }),
      });
    } catch (err) {
      if (controller.signal.aborted) throw new ClaudeError("timeout", `Claude did not answer within ${timeoutMs} ms`);
      throw new ClaudeError("network", err instanceof Error ? err.message : "network error");
    }

    if (!res.ok || !res.body) {
      const body = (await res.json().catch(() => null)) as { error?: ApiError } | null;
      throw errorFromApi(res.status, body?.error);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
        let boundary = buffer.indexOf("\n\n");
        while (boundary >= 0) {
          const parsed = parseSseEvent(buffer.slice(0, boundary));
          buffer = buffer.slice(boundary + 2);
          if (parsed) applyStreamEvent(state, parsed.data);
          boundary = buffer.indexOf("\n\n");
        }
      }
      const rest = parseSseEvent(buffer.trim());
      if (rest) applyStreamEvent(state, rest.data);
    } catch (err) {
      if (err instanceof ClaudeError) throw err;
      if (controller.signal.aborted) throw new ClaudeError("timeout", `Claude did not finish within ${timeoutMs} ms`);
      throw new ClaudeError("network", err instanceof Error ? err.message : "stream error");
    }
  } finally {
    clearTimeout(timer);
  }

  const ms = Date.now() - started;
  tracked.model = state.model;
  console.info("claude usage", JSON.stringify({ task, model: state.model, effort, ms, stopReason: state.stopReason, ...state.usage }));

  if (state.stopReason === "refusal") throw new ClaudeError("refusal", "Claude declined to answer");
  if (state.stopReason === "max_tokens") throw new ClaudeError("max_tokens", `Reply cut off at max_tokens=${maxTokens}`);

  try {
    return { data: JSON.parse(state.text), model: state.model, effort, usage: state.usage, stopReason: state.stopReason, ms };
  } catch {
    throw new ClaudeError("bad_output", "Claude's reply was not valid JSON");
  }
}

// ─── Message Batches (long, deep analyses that must not depend on a request staying open) ───

/**
 * Queues one request in the Message Batches API: no timeout, 50% cheaper, and the result can be
 * collected later. Batches usually finish within minutes and always within 24 hours.
 */
export async function createClaudeBatch(request: JsonRequest & { customId: string }) {
  const key = apiKey();
  const { effort, params } = messageParams(request);
  const res = await fetch(`${API_URL}/batches`, {
    method: "POST",
    cache: "no-store",
    headers: headers(key),
    body: JSON.stringify({ requests: [{ custom_id: request.customId, params }] }),
  }).catch((err) => {
    throw new ClaudeError("network", err instanceof Error ? err.message : "network error");
  });
  const body = (await res.json().catch(() => null)) as { id?: string; error?: ApiError } | null;
  if (!res.ok || !body?.id) throw errorFromApi(res.status, body?.error);
  return { batchId: body.id, model: params.model, effort };
}

export type ClaudeBatchOutcome =
  | { status: "pending" }
  | { status: "ready"; data: unknown; model: string; usage: ClaudeUsage }
  | { status: "failed"; error: string; kind: ClaudeErrorKind };

type BatchMessage = {
  model?: string;
  stop_reason?: string | null;
  content?: Array<{ type?: string; text?: string }>;
  usage?: { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number };
};

/** Reads a finished batch's single result line (exported for tests). */
export function outcomeFromBatchLine(line: unknown): ClaudeBatchOutcome {
  const result = (line as { result?: { type?: string; message?: BatchMessage; error?: { error?: ApiError } & ApiError } } | null)?.result;
  if (!result) return { status: "failed", error: "Empty batch result", kind: "bad_output" };
  if (result.type !== "succeeded" || !result.message) {
    const apiError = result.error?.error ?? result.error;
    const err = result.type === "errored" ? errorFromApi(400, apiError) : new ClaudeError("timeout", `Batch request ${result.type ?? "failed"}`);
    return { status: "failed", error: err.message, kind: err.kind };
  }
  const message = result.message;
  if (message.stop_reason === "refusal") return { status: "failed", error: "Claude declined to answer", kind: "refusal" };
  if (message.stop_reason === "max_tokens") return { status: "failed", error: "Reply cut off at max_tokens", kind: "max_tokens" };
  const text = (message.content ?? []).filter((block) => block.type === "text").map((block) => block.text ?? "").join("");
  const usage: ClaudeUsage = {
    inputTokens: message.usage?.input_tokens ?? 0,
    outputTokens: message.usage?.output_tokens ?? 0,
    cacheReadTokens: message.usage?.cache_read_input_tokens ?? 0,
    cacheWriteTokens: message.usage?.cache_creation_input_tokens ?? 0,
  };
  try {
    return { status: "ready", data: JSON.parse(text), model: message.model ?? "", usage };
  } catch {
    return { status: "failed", error: "Claude's reply was not valid JSON", kind: "bad_output" };
  }
}

/**
 * Checks a batch; returns "pending" until it has ended (then logs its usage once, for `task`).
 * Throws ClaudeError only for transport problems.
 */
export async function readClaudeBatch(batchId: string, log?: { task: ClaudeTask; effort?: string; context?: UsageContext }): Promise<ClaudeBatchOutcome> {
  const key = apiKey();
  const res = await fetch(`${API_URL}/batches/${encodeURIComponent(batchId)}`, { cache: "no-store", headers: headers(key) }).catch((err) => {
    throw new ClaudeError("network", err instanceof Error ? err.message : "network error");
  });
  const batch = (await res.json().catch(() => null)) as { processing_status?: string; results_url?: string | null; error?: ApiError } | null;
  if (!res.ok || !batch) throw errorFromApi(res.status, batch?.error);
  if (batch.processing_status !== "ended" || !batch.results_url) return { status: "pending" };

  const results = await fetch(batch.results_url, { cache: "no-store", headers: headers(key) }).catch((err) => {
    throw new ClaudeError("network", err instanceof Error ? err.message : "network error");
  });
  if (!results.ok) throw errorFromApi(results.status, undefined);
  const firstLine = (await results.text()).split("\n").find((line) => line.trim());
  let parsed: unknown = null;
  try {
    parsed = firstLine ? JSON.parse(firstLine) : null;
  } catch {
    parsed = null;
  }
  const outcome = outcomeFromBatchLine(parsed);
  if (outcome.status === "ready") {
    console.info("claude batch usage", JSON.stringify({ batchId, model: outcome.model, ...outcome.usage }));
  }
  if (log) {
    await recordClaudeUsage({
      task: log.task,
      model: outcome.status === "ready" ? outcome.model : claudeModel(log.task),
      effort: log.effort ?? claudeEffort(log.task),
      usage: outcome.status === "ready" ? outcome.usage : { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 },
      ok: outcome.status === "ready",
      errorKind: outcome.status === "failed" ? outcome.kind : undefined,
      batch: true,
      context: log.context,
    });
  }
  return outcome;
}

// ─── Usage log ───────────────────────────────────────────────────────────────

/** USD per million tokens (Nov 2026 list prices). Unknown models are logged at 0 and still counted in tokens. */
const PRICES: Array<{ match: RegExp; input: number; output: number; cacheRead: number; cacheWrite: number }> = [
  { match: /opus-5-5/, input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
  { match: /sonnet-5-5/, input: 2, output: 10, cacheRead: 0.1, cacheWrite: 2.5 },
  { match: /haiku-5-5/, input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite: 0.125 },
];

/** Estimated cost of one call in USD (the Batch API is half price). The Console bill is the source of truth. */
export function estimateCostUsd(model: string, usage: ClaudeUsage, batch = false) {
  const price = PRICES.find((p) => p.match.test(model));
  if (!price) return 0;
  const cost =
    (usage.inputTokens * price.input + usage.outputTokens * price.output + usage.cacheReadTokens * price.cacheRead + usage.cacheWriteTokens * price.cacheWrite) /
    1_000_000;
  return Math.round((batch ? cost / 2 : cost) * 10000) / 10000;
}

/** Writes one row to public.ai_usage. Never throws: logging must not break the feature. */
async function recordClaudeUsage(row: {
  task: ClaudeTask;
  model: string;
  effort?: string;
  usage: ClaudeUsage;
  ms?: number;
  ok: boolean;
  errorKind?: string;
  batch?: boolean;
  context?: UsageContext;
}) {
  try {
    const { error } = await getAdminClient().from("ai_usage").insert({
      school_id: row.context?.schoolId ?? null,
      user_id: row.context?.userId ?? null,
      task: row.task,
      provider: "claude",
      model: row.model,
      effort: row.effort ?? null,
      batch: Boolean(row.batch),
      input_tokens: row.usage.inputTokens,
      output_tokens: row.usage.outputTokens,
      cache_read_tokens: row.usage.cacheReadTokens,
      cache_write_tokens: row.usage.cacheWriteTokens,
      cost_usd: estimateCostUsd(row.model, row.usage, row.batch),
      duration_ms: row.ms ?? null,
      status: row.ok ? "ok" : "error",
      error_kind: row.errorKind ?? null,
    });
    if (error) console.error("ai usage log failed", error.message);
  } catch (err) {
    console.error("ai usage log failed", err instanceof Error ? err.message : err);
  }
}

/** A short Arabic note for the user when Claude failed and the fallback wrote the text instead. */
export function claudeFailureNotice(err: unknown) {
  const kind = err instanceof ClaudeError ? err.kind : "network";
  if (kind === "credits") return "انتهى رصيد التحليل المعمّق لهذا الشهر";
  if (kind === "rate_limit" || kind === "overloaded") return "خدمة التحليل المعمّق مشغولة الآن";
  if (kind === "timeout") return "استغرق التحليل المعمّق وقتًا أطول من المسموح";
  return "تعذر التحليل المعمّق الآن";
}
