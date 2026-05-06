import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, requireAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

type Params = {
  params: {
    id: string;
  };
};

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

function errorResponse(err: unknown) {
  const message = err instanceof Error ? err.message : "Unknown error";
  const code = err && typeof err === "object" && "code" in err ? err.code : undefined;
  const details =
    err && typeof err === "object"
      ? {
          code,
          details: "details" in err ? err.details : undefined,
          hint: "hint" in err ? err.hint : undefined,
        }
      : {};

  return NextResponse.json(
    {
      success: false,
      error:
        code === "PGRST204"
          ? "تعذر حفظ المدرسة بسبب عدم تطابق أعمدة جدول schools في Supabase."
          : message,
      ...details,
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
    const body = await req.json();
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

    if (typeof body.name === "string") updates.name = body.name.trim();
    if (typeof body.city === "string") updates.city = body.city.trim();
    if (typeof body.region === "string") updates.region = body.region.trim() || null;
    if (body.region === null) updates.region = null;
    if (typeof body.type === "string") updates.type = body.type.trim();
    if (typeof body.subscription_type === "string") updates.subscription_type = body.subscription_type.trim();
    if (typeof body.subscription_start === "string") updates.subscription_start = body.subscription_start.trim();
    if (typeof body.subscription_end === "string") updates.subscription_end = body.subscription_end.trim();
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
    return errorResponse(err);
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
    return errorResponse(err);
  }
}
