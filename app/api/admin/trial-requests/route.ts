import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase-admin";
import { requireAdmin, authErrorResponse } from "@/lib/auth";
import { normalizeTrialRequest } from "@/lib/admin/normalize";
import { errorJson, logDbError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);

  if (!admin.ok) return authErrorResponse(admin);

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
    logDbError("admin trial requests list", err);
    return errorJson("تعذر تحميل طلبات التجربة");
  }
}
