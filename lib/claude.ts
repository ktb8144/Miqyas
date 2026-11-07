import "server-only";

/**
 * Minimal Claude Messages API client for Dala's text-only analysis tasks (no SDK dependency).
 *
 * - Streams the reply (server-sent events) so long thinking never leaves an idle connection.
 * - Adaptive thinking is always on for Opus 5.5; `output_config.effort` sets how deep it thinks.
 * - The reply is constrained to a JSON schema (`output_config.format`), then the caller still
 *   validates it against its own data, exactly like the Gemini path.
 *
 * Every call here sends aggregated, anonymous numbers only. Never send student names or images.
 *
 * Environment:
 *   ANTHROPIC_API_KEY             key from the Dala workspace in the Claude Console (required)
 *   CLAUDE_DISABLED=true          switch Claude off without removing the key (falls back to Gemini/rules)
 *   CLAUDE_MODEL                  default model for every task (default: claude-opus-5-5)
 *   CLAUDE_MODEL_<TASK>           per-task model, e.g. CLAUDE_MODEL_CLASS_REPORT=claude-haiku-5-5
 *   CLAUDE_EFFORT_<TASK>          low | medium | high | xhigh | max (defaults below)
 */

export type ClaudeEffort = "low" | "medium" | "high" | "xhigh" | "max";
export type ClaudeTask = "class_report" | "nafs_analysis";

const API_URL = "https://api.anthropic.com/v1/messages";
const API_VERSION = "2023-06-01";
const DEFAULT_MODEL = "claude-opus-5-5";
const EFFORTS: ClaudeEffort[] = ["low", "medium", "high", "xhigh", "max"];

/** How deep each task thinks unless overridden. Opus 5.5 itself defaults to "medium". */
const DEFAULT_EFFORT: Record<ClaudeTask, ClaudeEffort> = {
  class_report: "high",
  nafs_analysis: "max",
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
};

function apiKey() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || process.env.CLAUDE_DISABLED === "true") throw new ClaudeError("not_configured", "ANTHROPIC_API_KEY is not configured");
  return key;
}

function headers(key: string) {
  return { "content-type": "application/json", "x-api-key": key, "anthropic-version": API_VERSION };
}

/** The Messages API body shared by live calls and batches. */
function messageParams({ task, system, prompt, schema, maxTokens = 32000 }: JsonRequest) {
  const effort = claudeEffort(task);
  return {
    effort,
    params: {
      model: claudeModel(task),
      max_tokens: maxTokens,
      // The instructions are identical for every class/school, so they are cached.
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: prompt }],
      thinking: { type: "adaptive" },
      output_config: { effort, format: { type: "json_schema", schema } },
    },
  };
}

/**
 * Sends one request and returns the parsed JSON reply. Throws ClaudeError on any failure, so
 * callers can fall back (Gemini, then fixed rules).
 */
export async function generateClaudeJson({
  timeoutMs = 180000,
  ...request
}: JsonRequest & { timeoutMs?: number }): Promise<ClaudeJsonResult> {
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
    usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 },
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

/** Checks a batch; returns "pending" until it has ended. Throws ClaudeError only for transport problems. */
export async function readClaudeBatch(batchId: string): Promise<ClaudeBatchOutcome> {
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
  return outcome;
}

/** A short Arabic note for the user when Claude failed and the fallback wrote the text instead. */
export function claudeFailureNotice(err: unknown) {
  const kind = err instanceof ClaudeError ? err.kind : "network";
  if (kind === "credits") return "انتهى رصيد التحليل المعمّق لهذا الشهر";
  if (kind === "rate_limit" || kind === "overloaded") return "خدمة التحليل المعمّق مشغولة الآن";
  if (kind === "timeout") return "استغرق التحليل المعمّق وقتًا أطول من المسموح";
  return "تعذر التحليل المعمّق الآن";
}
