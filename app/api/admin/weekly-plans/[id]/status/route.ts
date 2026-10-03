import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminClient } from "@/lib/supabase-admin";
import { requireAdmin, authErrorResponse } from "@/lib/auth";

export const dynamic = "force-dynamic";

const statusSchema = z.object({
  status: z.enum(["active", "inactive", "archived"]),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const admin = await requireAdmin(req);
  if (!admin.ok) return authErrorResponse(admin);

  try {
    const parsed = statusSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "حالة الخطة غير صحيحة" },
        { status: 400 }
      );
    }

    const { data, error } = await getAdminClient()
      .from("weekly_plans")
      .update({ status: parsed.data.status })
      .eq("id", params.id)
      .select("*")
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error("admin weekly plan status failed", err);
    return NextResponse.json(
      { success: false, error: "تعذر تحديث حالة الخطة" },
      { status: 500 }
    );
  }
}
