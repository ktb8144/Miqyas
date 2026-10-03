import "server-only";
import { getAdminClient } from "@/lib/supabase-admin";

export interface AdminOverview {
  schools: { total: number };
  users: {
    total: number;
    byRole: { admin: number; principal: number; teacher: number };
  };
  students: { total: number };
  questions: { total: number };
}

async function countRows(
  table: "schools" | "users" | "students" | "package_questions",
  filters?: Record<string, string>
) {
  let query = getAdminClient().from(table).select("id", { count: "exact", head: true });

  Object.entries(filters ?? {}).forEach(([column, value]) => {
    query = query.eq(column, value);
  });

  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

export async function getAdminOverview(): Promise<AdminOverview> {
  const [schools, users, admins, principals, teachers, students, questions] = await Promise.all([
    countRows("schools"),
    countRows("users"),
    countRows("users", { role: "admin" }),
    countRows("users", { role: "principal" }),
    countRows("users", { role: "teacher" }),
    countRows("students"),
    countRows("package_questions"),
  ]);

  return {
    schools: { total: schools },
    users: { total: users, byRole: { admin: admins, principal: principals, teacher: teachers } },
    students: { total: students },
    questions: { total: questions },
  };
}
