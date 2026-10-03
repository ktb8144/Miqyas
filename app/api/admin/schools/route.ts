import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminClient } from "@/lib/supabase-admin";
import { requireAdmin, authErrorResponse } from "@/lib/auth";
import { normalizeSchool, schoolErrorResponse } from "@/lib/admin/normalize";
import { logDbError } from "@/lib/api";

export const dynamic = "force-dynamic";

const schoolCreateSchema = z.object({
  name: z.string().trim().min(1),
  city: z.string().trim().min(1),
  region: z.string().trim().min(1).nullable().optional(),
  type: z.string().trim().min(1).default("حكومية"),
  subscription_type: z.string().trim().min(1).default("trial"),
  subscription_start: z.string().trim().min(1).optional(),
  subscription_end: z.string().trim().min(1).optional(),
  active: z.boolean().default(true),
  trial: z.boolean().default(true),
});

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);

  if (!admin.ok) return authErrorResponse(admin);

  try {
    const { data, error } = await getAdminClient()
      .from("schools")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: (data ?? []).map((row) => normalizeSchool(row)),
    });
  } catch (err) {
    logDbError("admin schools list", err);
    return schoolErrorResponse(err, "تعذر تنفيذ العملية على المدارس");
  }
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);

  if (!admin.ok) return authErrorResponse(admin);

  try {
    const parsed = schoolCreateSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "تحقق من بيانات المدرسة المطلوبة: اسم المدرسة والمدينة مطلوبان" },
        { status: 400 }
      );
    }

    const {
      name,
      city,
      region = null,
      type,
      subscription_type: subscriptionType,
      active,
      trial,
    } = parsed.data;
    const subscriptionStart = parsed.data.subscription_start ?? new Date().toISOString().slice(0, 10);
    const subscriptionEnd =
      parsed.data.subscription_end ?? new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const { data, error } = await getAdminClient()
      .from("schools")
      .insert({
        name,
        city,
        region,
        type,
        subscription_type: subscriptionType,
        subscription_start: subscriptionStart,
        subscription_end: subscriptionEnd,
        active,
        trial,
      })
      .select("*")
      .single();

    if (error) throw error;

    return NextResponse.json(
      { success: true, data: normalizeSchool(data) },
      { status: 201 }
    );
  } catch (err) {
    logDbError("admin schools create", err);
    return schoolErrorResponse(err, "تعذر إنشاء المدرسة في Supabase");
  }
}
