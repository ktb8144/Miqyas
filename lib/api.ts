import "server-only";
import { NextResponse } from "next/server";

/** Pulls the useful fields out of a Supabase/Postgres error (or any thrown value). */
export function describeDbError(err: unknown) {
  if (err && typeof err === "object") {
    return {
      code: "code" in err ? String(err.code) : undefined,
      message: "message" in err ? String(err.message) : undefined,
      details: "details" in err ? String(err.details) : undefined,
      hint: "hint" in err ? String(err.hint) : undefined,
    };
  }
  return { message: err instanceof Error ? err.message : "Unknown error" };
}

/** One logging format for every API route: `[context] failed { code, message, ... }`. */
export function logDbError(context: string, err: unknown) {
  console.error(`${context} failed`, describeDbError(err));
}

/** Standard JSON error response. */
export function errorJson(message: string, status = 500) {
  return NextResponse.json({ success: false, error: message }, { status });
}

/** "" / "  " / undefined → null, otherwise the trimmed string. */
export function emptyToNull(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** Redirect URL used in Supabase invitation emails. */
export function getInviteRedirectTo() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  if (appUrl) {
    return `${appUrl}/auth/callback`;
  }
  if (process.env.NODE_ENV === "development") {
    return "http://localhost:3000/auth/callback";
  }
  throw new Error("NEXT_PUBLIC_APP_URL is required for invitation emails");
}
