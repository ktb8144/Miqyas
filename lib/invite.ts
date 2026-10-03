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

export type InviteMethod =
  | "email_invite"
  | "password_reset_email"
  | "password_reset_link"
  | "temporary_password_created";

type AuthErrorLike = { code?: string; status?: number; message?: string } | null | undefined;

function isEmailTaken(error: AuthErrorLike) {
  if (!error) return false;
  return (
    error.code === "email_exists" ||
    error.code === "user_already_exists" ||
    /already (been )?registered|already exists/i.test(error.message ?? "")
  );
}

/**
 * Checks the profile table before any auth account is created, so a duplicate never leaves
 * a half-created user behind. Returns an Arabic message for the first conflict, or null.
 */
export async function findProfileConflict(email: string, phone: string | null | undefined) {
  const db = getAdminClient();

  const byEmail = await db.from("users").select("id").ilike("email", email).limit(1);
  if (byEmail.error) throw byEmail.error;
  if (byEmail.data?.length) return "يوجد مستخدم بهذا البريد مسبقًا";

  if (phone) {
    const byPhone = await db.from("users").select("id").eq("phone", phone).limit(1);
    if (byPhone.error) throw byPhone.error;
    if (byPhone.data?.length) return "رقم الجوال مسجّل لمستخدم آخر. استخدم رقمًا مختلفًا أو اتركه فارغًا.";
  }

  return null;
}

/** Maps a unique-constraint error from the users table to an Arabic message, or null. */
export function describeProfileInsertError(error: unknown) {
  const e = error as { code?: string; message?: string } | null;
  if (e?.code !== "23505") return null;
  if (e.message?.includes("phone")) return "رقم الجوال مسجّل لمستخدم آخر. استخدم رقمًا مختلفًا أو اتركه فارغًا.";
  if (e.message?.includes("email")) return "يوجد مستخدم بهذا البريد مسبقًا";
  return "هذا المستخدم مسجّل مسبقًا";
}

/** Removes an auth account created moments ago when its profile could not be saved. */
export async function deleteAuthUserQuietly(userId: string) {
  const { error } = await getAdminClient().auth.admin.deleteUser(userId);
  if (error) console.error("rollback: failed to delete auth user", userId, error);
}

/**
 * Creates (or reuses) the Supabase Auth account for a new user and emails them a link.
 * 1. Normal email invitation.
 * 2. If the email already has an auth account with no profile (left over from an earlier
 *    failed attempt), reuse that account and email a password-reset link instead.
 * 3. Otherwise (e.g. email rate limit), create the account with a random password and
 *    generate a password-reset link the admin can share manually.
 *
 * `created` tells the caller whether the auth account is new, so it is only rolled back
 * when this call created it.
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
    return {
      userId: invited.user.id,
      created: true,
      method: "email_invite" as InviteMethod,
      actionLink: null as string | null,
    };
  }

  if (isEmailTaken(inviteError)) {
    const { data: linkData, error: linkError } = await db.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo },
    });
    if (linkError || !linkData.user) throw linkError ?? new Error("Existing auth user not found");

    const linked = await db.from("users").select("id").eq("auth_id", linkData.user.id).limit(1);
    if (linked.error) throw linked.error;
    if (linked.data?.length) throw new Error("Auth account is already linked to another profile");

    const { error: resetError } = await db.auth.resetPasswordForEmail(email, { redirectTo });
    return {
      userId: linkData.user.id,
      created: false,
      method: (resetError ? "password_reset_link" : "password_reset_email") as InviteMethod,
      actionLink: resetError ? linkData.properties?.action_link ?? null : null,
    };
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
    created: true,
    method: (linkError ? "temporary_password_created" : "password_reset_link") as InviteMethod,
    actionLink: linkData?.properties?.action_link ?? null,
  };
}
