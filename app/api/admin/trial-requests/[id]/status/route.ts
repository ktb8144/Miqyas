import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminClient } from "@/lib/supabase-admin";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

type Params = {
  params: {
    id: string;
  };
};

const statusSchema = z.object({
  status: z.enum(["new", "contacted", "closed"]),
});

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
    { success: false, error: "تعذر تحديث حالة طلب التجربة" },
    { status: 500 }
  );
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const admin = await requireAdmin(req);

  if (!admin.ok) {
    console.warn("admin trial requests status blocked", {
      status: admin.status,
      reason: admin.error,
    });

    return NextResponse.json(
      { success: false, error: admin.error },
      { status: admin.status }
    );
  }

  try {
    const parsed = statusSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "حالة طلب التجربة غير صحيحة" },
        { status: 400 }
      );
    }
    const { status } = parsed.data;

    const { data, error } = await getAdminClient()
      .from("trial_requests")
      .update({ status })
      .eq("id", params.id)
      .select("*")
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: normalizeTrialRequest(data),
    });
  } catch (err) {
    logTrialRequestError("status", err);
    return errorResponse();
  }
}
