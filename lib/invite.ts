import "server-only";
import { randomBytes } from "node:crypto";
import { getAdminClient } from "@/lib/supabase-admin";

/** Redirect URL used in Supabase invitation / recovery emails. */
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

/** Random throw-away password (never shown to anyone; the user sets their own via the link). */
function temporaryPassword() {
  return `${randomBytes(18).toString("base64url")}Aa1!`;
}

export type InviteMethod = "email_invite" | "password_reset_link" | "temporary_password_created";

/**
 * Creates the Supabase Auth account for a new user.
 * 1. Try a normal email invitation.
 * 2. If that fails (e.g. email rate limit), create the account with a random password
 *    and generate a password-reset link the admin can share manually.
 */
export async function inviteOrCreateAuthUser(email: string, name: string, role: string) {
  const db = getAdminClient();
  const metadata = { name, role };
  const redirectTo = getInviteRedirectTo();

  const { data: invited, error: inviteError } = await db.auth.admin.inviteUserByEmail(email, {
    data: metadata,
    redirectTo,
  });
  if (!inviteError && invited.user) {
    return { userId: invited.user.id, method: "email_invite" as InviteMethod, actionLink: null as string | null };
  }

  const { data: created, error: createError } = await db.auth.admin.createUser({
    email,
    password: temporaryPassword(),
    email_confirm: false,
    user_metadata: metadata,
  });
  if (createError || !created.user) {
    throw createError ?? new Error("Failed to create auth user");
  }

  const { data: linkData, error: linkError } = await db.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo },
  });

  return {
    userId: created.user.id,
    method: (linkError ? "temporary_password_created" : "password_reset_link") as InviteMethod,
    actionLink: linkData?.properties?.action_link ?? null,
  };
}
