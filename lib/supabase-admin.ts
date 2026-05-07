import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";

// ─── Server-only admin client ─────────────────────────────────────────────────
export function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AssessmentResult {
  student_name: string;
  score: number;
  total: number;
  level: string;
  answers?: Record<string, string>;
}

export interface SchoolRegistration {
  principal_name: string;
  school_name: string;
  city: string;
  school_type: string;
  phone: string;
}

export interface AdminOverview {
  schools: {
    total: number;
  };
  users: {
    total: number;
    byRole: {
      admin: number;
      principal: number;
      teacher: number;
    };
  };
  students: {
    total: number;
  };
  questions: {
    total: number;
  };
}

// ─── Admin auth guard ─────────────────────────────────────────────────────────

export async function requireAdmin(req: NextRequest) {
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
    return { ok: false as const, status: 401, error: "Unauthorized" };
  }

  const db = getAdminClient();
  const { data: profile, error: profileError } = await db
    .from("users")
    .select("role")
    .eq("auth_id", user.id)
    .single();

  if (profileError || profile?.role !== "admin") {
    return { ok: false as const, status: 403, error: "Forbidden" };
  }

  return { ok: true as const, user };
}

export async function requireUserRole(
  req: NextRequest,
  roles: Array<"admin" | "principal" | "teacher">
) {
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

  const db = getAdminClient();
  const { data: profile, error: profileError } = await db
    .from("users")
    .select("id, auth_id, name, email, role, school_id, grade, subject")
    .eq("auth_id", user.id)
    .single();

  if (profileError || !profile || !roles.includes(profile.role)) {
    return { ok: false as const, status: 403, error: "ليست لديك صلاحية لتنفيذ هذا الإجراء" };
  }

  return { ok: true as const, user, profile };
}

// ─── Admin overview ───────────────────────────────────────────────────────────

async function countRows(
  table: "schools" | "users" | "students" | "weekly_questions",
  filters?: Record<string, string>
) {
  let query = getAdminClient()
    .from(table)
    .select("id", { count: "exact", head: true });

  Object.entries(filters ?? {}).forEach(([column, value]) => {
    query = query.eq(column, value);
  });

  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

export async function getAdminOverview(): Promise<AdminOverview> {
  const [
    schoolsTotal,
    usersTotal,
    adminsTotal,
    principalsTotal,
    teachersTotal,
    studentsTotal,
    questionsTotal,
  ] = await Promise.all([
    countRows("schools"),
    countRows("users"),
    countRows("users", { role: "admin" }),
    countRows("users", { role: "principal" }),
    countRows("users", { role: "teacher" }),
    countRows("students"),
    countRows("weekly_questions"),
  ]);

  return {
    schools: {
      total: schoolsTotal,
    },
    users: {
      total: usersTotal,
      byRole: {
        admin: adminsTotal,
        principal: principalsTotal,
        teacher: teachersTotal,
      },
    },
    students: {
      total: studentsTotal,
    },
    questions: {
      total: questionsTotal,
    },
  };
}

// ─── saveResults ─────────────────────────────────────────────────────────────

export async function saveResults(
  assessmentId: string,
  results: AssessmentResult[]
) {
  const db = getAdminClient();

  const rows = results.map((r) => ({
    assessment_id: assessmentId,
    student_name: r.student_name,
    score: r.score,
    total: r.total,
    level: r.level,
    answers: r.answers ?? {},
    created_at: new Date().toISOString(),
  }));

  const { data, error } = await db
    .from("assessment_results")
    .insert(rows)
    .select();

  if (error) throw error;
  return data;
}

// ─── getSchoolData ────────────────────────────────────────────────────────────

export async function getSchoolData(schoolId: string) {
  const db = getAdminClient();

  const { data, error } = await db
    .from("schools")
    .select(`
      *,
      teachers (
        id,
        name,
        grade,
        subject
      ),
      assessments (
        id,
        skill,
        grade,
        status,
        created_at,
        assessment_results (
          student_name,
          score,
          total,
          level
        )
      )
    `)
    .eq("id", schoolId)
    .single();

  if (error) throw error;
  return data;
}

// ─── registerSchool ───────────────────────────────────────────────────────────

export async function registerSchool(data: SchoolRegistration) {
  const db = getAdminClient();

  const { data: result, error } = await db
    .from("schools")
    .insert({
      name: data.school_name,
      city: data.city,
      region: null,
      type: data.school_type,
      subscription_type: "trial",
      subscription_start: new Date().toISOString().slice(0, 10),
      subscription_end: new Date(
        Date.now() + 60 * 24 * 60 * 60 * 1000 // 60 days free trial
      ).toISOString().slice(0, 10),
      active: true,
      trial: true,
    })
    .select()
    .single();

  if (error) throw error;
  return result;
}
