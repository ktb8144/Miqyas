import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, requireAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

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

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);

  if (!admin.ok) {
    console.warn("admin schools list blocked", {
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
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: (data ?? []).map((row) => normalizeSchool(row)),
    });
  } catch (err) {
    logSchoolError("list", err);
    return errorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);

  if (!admin.ok) {
    console.warn("admin schools create blocked", {
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
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const city = typeof body.city === "string" ? body.city.trim() : "";
    const region =
      typeof body.region === "string" && body.region.trim()
        ? body.region.trim()
        : null;
    const type =
      typeof body.type === "string" && body.type.trim()
        ? body.type.trim()
        : "حكومية";
    const subscriptionType =
      typeof body.subscription_type === "string" && body.subscription_type.trim()
        ? body.subscription_type.trim()
        : "trial";
    const subscriptionStart =
      typeof body.subscription_start === "string" && body.subscription_start.trim()
        ? body.subscription_start.trim()
        : new Date().toISOString().slice(0, 10);
    const subscriptionEnd =
      typeof body.subscription_end === "string" && body.subscription_end.trim()
        ? body.subscription_end.trim()
        : new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const active = typeof body.active === "boolean" ? body.active : true;
    const trial = typeof body.trial === "boolean" ? body.trial : true;

    if (!name) {
      return NextResponse.json(
        { success: false, error: "name is required" },
        { status: 400 }
      );
    }
    if (!city) {
      return NextResponse.json(
        { success: false, error: "city is required" },
        { status: 400 }
      );
    }

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
    logSchoolError("create", err);
    return errorResponse(err);
  }
}
