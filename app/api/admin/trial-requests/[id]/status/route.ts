import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminClient } from "@/lib/supabase-admin";
import { requireAdmin, authErrorResponse } from "@/lib/auth";
import { normalizeTrialRequest } from "@/lib/admin/normalize";
import { errorJson, logDbError } from "@/lib/api";

export const dynamic = "force-dynamic";

type Params = {
  params: {
    id: string;
  };
};

const statusSchema = z.object({
  status: z.enum(["new", "contacted", "closed"]),
});

export async function PATCH(req: NextRequest, { params }: Params) {
  const admin = await requireAdmin(req);

  if (!admin.ok) return authErrorResponse(admin);

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
    logDbError("admin trial requests status", err);
    return errorJson("تعذر تحديث حالة طلب التجربة");
  }
}
