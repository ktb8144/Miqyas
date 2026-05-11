import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminClient, requireAdmin } from "@/lib/supabase-admin";

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

function normalizeSchool(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    city: String(row.city ?? ""),
    region: row.region === null ? null : String(row.region ?? ""),
    type: String(row.type ?? ""),
    principal: "—",
    teachers: Number(row.teachers ?? 0),
    students: Number(row.students ?? 0),
    status: normalizeSchoolStatus(row.active, row.trial),
    score: String(row.score ?? "—"),
  };
}

function normalizeSchoolStatus(active: unknown, trial: unknown) {
  if (active === false) return "موقوفة";
  if (trial === true) return "تجريبية";
  return "نشطة";
}

function logSchoolError(action: string, err: unknown) {
  const details =
    err && typeof err === "object"
      ? {
          code: "code" in err ? err.code : undefined,
          message: "message" in err ? err.message : undefined,
          details: "details" in err ? err.details : undefined,
          hint: "hint" in err ? err.hint : undefined,
        }
      : { message: err instanceof Error ? err.message : "Unknown error" };

  console.error(`admin schools ${action} failed`, details);
}

function errorResponse(err: unknown, fallback = "تعذر تنفيذ العملية على المدرسة") {
  const code = err && typeof err === "object" && "code" in err ? err.code : undefined;
  const message = err && typeof err === "object" && "message" in err ? String(err.message) : "";
  const details = err && typeof err === "object" && "details" in err ? String(err.details) : undefined;
  const hint = err && typeof err === "object" && "hint" in err ? String(err.hint) : undefined;

  return NextResponse.json(
    {
      success: false,
      error:
        code === "PGRST204"
          ? "تعذر حفظ المدرسة بسبب عدم تطابق أعمدة جدول schools في Supabase."
          : message.includes("violates not-null constraint")
            ? "تعذر حفظ المدرسة بسبب نقص حقل مطلوب في جدول schools."
            : message.includes("violates check constraint")
              ? "تعذر حفظ المدرسة بسبب قيمة غير مسموحة في أحد الحقول."
              : fallback,
      details,
      hint,
      code,
    },
    { status: 500 }
  );
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const admin = await requireAdmin(req);

  if (!admin.ok) {
    console.warn("admin schools update blocked", {
      status: admin.status,
      reason: admin.error,
    });

    return NextResponse.json(
      { success: false, error: admin.error },
      { status: admin.status }
    );
  }

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
    logSchoolError("update", err);
    return errorResponse(err, "تعذر تحديث المدرسة في Supabase");
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const admin = await requireAdmin(req);

  if (!admin.ok) {
    console.warn("admin schools disable blocked", {
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
    logSchoolError("disable", err);
    return errorResponse(err, "تعذر إيقاف المدرسة في Supabase");
  }
}
