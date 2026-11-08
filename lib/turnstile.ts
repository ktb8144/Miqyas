import "server-only";

/**
 * Cloudflare Turnstile: proves a form was sent by a person in a browser, not a script.
 * The widget on the page gives a token; the server must check it here (a token can be forged,
 * expires after 5 minutes and works only once).
 *
 * Environment:
 *   NEXT_PUBLIC_TURNSTILE_SITE_KEY  public key the widget uses (set at build time)
 *   TURNSTILE_SECRET_KEY            secret key for the check below
 * Without TURNSTILE_SECRET_KEY the check is off, so a deploy without keys never blocks sign-ups.
 * Preview deployments use Cloudflare's test keys (always pass); see docs/turnstile.md.
 */

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export function turnstileEnabled() {
  return Boolean(process.env.TURNSTILE_SECRET_KEY);
}

/** The visitor's IP as Vercel/Cloudflare pass it on (helps Cloudflare judge the token). */
export function visitorIp(headers: Headers) {
  return headers.get("cf-connecting-ip") || headers.get("x-real-ip") || headers.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined;
}

export type TurnstileCheck = { ok: true } | { ok: false; reason: "missing" | "invalid" | "expired" | "unavailable" };

export async function verifyTurnstile(token: string | undefined, ip?: string, expectedAction?: string): Promise<TurnstileCheck> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return { ok: true };
  if (!token || token.length > 2048) return { ok: false, reason: "missing" };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip) body.set("remoteip", ip);
    const res = await fetch(VERIFY_URL, { method: "POST", body, cache: "no-store", signal: controller.signal });
    const result = (await res.json().catch(() => null)) as { success?: boolean; action?: string; "error-codes"?: string[] } | null;
    if (!result) return { ok: false, reason: "unavailable" };
    if (!result.success) {
      const codes = result["error-codes"] ?? [];
      console.warn("turnstile rejected", codes);
      // A bad secret is our configuration problem, not the visitor's.
      if (codes.some((code) => code.includes("secret"))) return { ok: false, reason: "unavailable" };
      return { ok: false, reason: codes.includes("timeout-or-duplicate") ? "expired" : "invalid" };
    }
    // Cloudflare's test keys report no action; real tokens carry the one the widget was given.
    if (expectedAction && result.action && result.action !== expectedAction) return { ok: false, reason: "invalid" };
    return { ok: true };
  } catch (err) {
    console.error("turnstile check failed", err instanceof Error ? err.message : err);
    return { ok: false, reason: "unavailable" };
  } finally {
    clearTimeout(timer);
  }
}

export function turnstileMessage(reason: Exclude<TurnstileCheck, { ok: true }>["reason"]) {
  if (reason === "missing") return "انتظر حتى يكتمل التحقق أسفل النموذج، ثم أعد المحاولة.";
  if (reason === "expired") return "انتهت صلاحية التحقق. أعد المحاولة.";
  if (reason === "unavailable") return "تعذر التحقق الآن. حاول بعد قليل.";
  return "لم يكتمل التحقق من أنك لست برنامجًا آليًا. أعد المحاولة.";
}
