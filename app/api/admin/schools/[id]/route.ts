import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminClient } from "@/lib/supabase-admin";
import { requireAdmin, authErrorResponse } from "@/lib/auth";
import { normalizeSchool, schoolErrorResponse } from "@/lib/admin/normalize";
import { logDbError } from "@/lib/api";

export const dynamic = "force-dynamic";

type Params = {
  params: {
    id: string;
  };
};

const schoolUpdateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  city: z.string().trim().min(1).optional(),
  region: z.string().trim().min(1).nullable().optional(),
  type: z.string().trim().min(1).optional(),
  subscription_type: z.string().trim().min(1).optional(),
  subscription_start: z.string().trim().min(1).optional(),
  subscription_end: z.string().trim().min(1).optional(),
  active: z.boolean().optional(),
  trial: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: Params) {
  const admin = await requireAdmin(req);

  if (!admin.ok) return authErrorResponse(admin);

  try {
    const parsed = schoolUpdateSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "تحقق من بيانات المدرسة" },
        { status: 400 }
      );
    }

    const body = parsed.data;
    const updates: {
      name?: string;
      city?: string;
      region?: string | null;
      type?: string;
      subscription_type?: string;
      subscription_start?: string;
      subscription_end?: string;
      active?: boolean;
      trial?: boolean;
    } = {};

    if (body.name) updates.name = body.name;
    if (body.city) updates.city = body.city;
    if (typeof body.region === "string") updates.region = body.region;
    if (body.region === null) updates.region = null;
    if (body.type) updates.type = body.type;
    if (body.subscription_type) updates.subscription_type = body.subscription_type;
    if (body.subscription_start) updates.subscription_start = body.subscription_start;
    if (body.subscription_end) updates.subscription_end = body.subscription_end;
    if (typeof body.active === "boolean") updates.active = body.active;
    if (typeof body.trial === "boolean") updates.trial = body.trial;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { success: false, error: "No updates provided" },
        { status: 400 }
      );
    }

    const { data, error } = await getAdminClient()
      .from("schools")
      .update(updates)
      .eq("id", params.id)
      .select("*")
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: normalizeSchool(data),
    });
  } catch (err) {
    logDbError("admin schools update", err);
    return schoolErrorResponse(err, "تعذر تحديث المدرسة في Supabase");
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const admin = await requireAdmin(req);

  if (!admin.ok) return authErrorResponse(admin);

  try {
    const { data, error } = await getAdminClient()
      .from("schools")
      .update({ active: false })
      .eq("id", params.id)
      .select("*")
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: normalizeSchool(data),
    });
  } catch (err) {
    logDbError("admin schools disable", err);
    return schoolErrorResponse(err, "تعذر إيقاف المدرسة في Supabase");
  }
}
