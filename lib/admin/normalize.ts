import "server-only";
import { NextResponse } from "next/server";
import { describeDbError } from "@/lib/api";

// Row → API shape converters shared by the admin API routes.

export function normalizeUser(row: Record<string, unknown>) {
  const school = row.schools as { name?: string } | null | undefined;
  return {
    id: String(row.id),
    auth_id: row.auth_id ? String(row.auth_id) : null,
    name: String(row.name ?? ""),
    email: String(row.email ?? ""),
    role: String(row.role ?? "teacher"),
    school_id: row.school_id ? String(row.school_id) : null,
    phone: row.phone ? String(row.phone) : null,
    school: school?.name ?? "كل المدارس",
    status: String(row.status ?? "نشط"),
  };
}

export function normalizeSchoolStatus(active: unknown, trial: unknown) {
  if (active === false) return "موقوفة";
  if (trial === true) return "تجريبية";
  return "نشطة";
}

export function normalizeSchool(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    city: String(row.city ?? ""),
    region: row.region === null ? null : String(row.region ?? ""),
    type: String(row.type ?? ""),
    principal: row.principal ? String(row.principal) : "—",
    teachers: Number(row.teachers ?? 0),
    students: Number(row.students ?? 0),
    status: normalizeSchoolStatus(row.active, row.trial),
    score: String(row.score ?? "—"),
    active: row.active !== false,
    trial: row.trial === true,
    subscriptionEnd: row.subscription_end ? String(row.subscription_end) : null,
  };
}

export function normalizeTrialRequest(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    school_name: String(row.school_name ?? ""),
    phone: String(row.phone ?? ""),
    email: String(row.email ?? ""),
    message: String(row.message ?? ""),
    status: String(row.status ?? "new"),
    created_at: String(row.created_at ?? ""),
  };
}

/**
 * Friendly Arabic message for a failed write to `schools`.
 * Database internals (details / hint) are logged server-side, not sent to the browser.
 */
export function schoolErrorResponse(err: unknown, fallback: string) {
  const { code, message = "" } = describeDbError(err);
  const error =
    code === "PGRST204"
      ? "تعذر حفظ المدرسة بسبب عدم تطابق أعمدة جدول schools في Supabase."
      : message.includes("violates not-null constraint")
        ? "تعذر حفظ المدرسة بسبب نقص حقل مطلوب في جدول schools."
        : message.includes("violates check constraint")
          ? "تعذر حفظ المدرسة بسبب قيمة غير مسموحة في أحد الحقول."
          : fallback;

  return NextResponse.json({ success: false, error, code }, { status: 500 });
}
