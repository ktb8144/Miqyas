import "server-only";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase-admin";

export type AppRole = "admin" | "principal" | "supervisor" | "teacher";

export type AppProfile = {
  id: string;
  auth_id: string;
  name: string | null;
  email: string | null;
  role: AppRole;
  school_id: string | null;
  grade: number | null;
  subject: string | null;
};

/**
 * Single auth guard for every API route.
 * Reads the session cookie, loads the user's profile and checks the role.
 */
export async function requireUserRole(req: NextRequest, roles: AppRole[]) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll() {
          // API guards only need to read the incoming session cookie.
        },
      },
    }
  );

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { ok: false as const, status: 401, error: "يرجى تسجيل الدخول أولًا" };
  }

  const { data: profile, error: profileError } = await getAdminClient()
    .from("users")
    .select("id, auth_id, name, email, role, school_id, grade, subject")
    .eq("auth_id", user.id)
    .single<AppProfile>();

  if (profileError || !profile || !roles.includes(profile.role)) {
    return { ok: false as const, status: 403, error: "ليست لديك صلاحية لتنفيذ هذا الإجراء" };
  }

  // A suspended school's staff keep their data but lose access until the school is re-activated.
  if (profile.role !== "admin" && profile.school_id) {
    const { data: school } = await getAdminClient().from("schools").select("active").eq("id", profile.school_id).maybeSingle();
    if (school && school.active === false) {
      return { ok: false as const, status: 403, error: "اشتراك مدرستك موقوف حاليًا. تواصل مع فريق دالة لإعادة التفعيل." };
    }
  }

  return { ok: true as const, user, profile };
}

/** Shortcut for admin-only routes. */
export function requireAdmin(req: NextRequest) {
  return requireUserRole(req, ["admin"]);
}

/** Standard JSON error for a failed guard. */
export function authErrorResponse(auth: { status: number; error: string }) {
  return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
}
