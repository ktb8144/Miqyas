import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, requireAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

function normalizeTrialRequest(row: Record<string, unknown>) {
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

function logTrialRequestError(action: string, err: unknown) {
  const details =
    err && typeof err === "object"
      ? {
          code: "code" in err ? err.code : undefined,
          message: "message" in err ? err.message : undefined,
          details: "details" in err ? err.details : undefined,
          hint: "hint" in err ? err.hint : undefined,
        }
      : { message: err instanceof Error ? err.message : "Unknown error" };

  console.error(`admin trial requests ${action} failed`, details);
}

function errorResponse() {
  return NextResponse.json(
    { success: false, error: "تعذر تحميل طلبات التجربة" },
    { status: 500 }
  );
}

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);

  if (!admin.ok) {
    console.warn("admin trial requests list blocked", {
      status: admin.status,
      reason: admin.error,
    });

    return NextResponse.json(
      { success: false, error: admin.error },
      { status: admin.status }
    );
  }

  try {
    const { data, error } = await getAdminClient()
      .from("trial_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: (data ?? []).map((row) => normalizeTrialRequest(row)),
    });
  } catch (err) {
    logTrialRequestError("list", err);
    return errorResponse();
  }
}
