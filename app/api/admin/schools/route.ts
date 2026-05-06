import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, requireAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

function normalizeSchool(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    name: String(row.school_name ?? row.name ?? ""),
    city: String(row.city ?? ""),
    school_type: String(row.school_type ?? ""),
    principal: String(row.principal_name ?? row.principal ?? "—"),
    teachers: Number(row.teachers ?? 0),
    students: Number(row.students ?? 0),
    status: normalizeStatus(row.status),
    score: String(row.score ?? "—"),
  };
}

function normalizeStatus(status: unknown) {
  const value = typeof status === "string" ? status : "";
  if (value === "active") return "نشطة";
  if (value === "trial") return "تجريبية";
  if (value === "inactive" || value === "disabled") return "موقوفة";
  return value || "تجريبية";
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
  const details =
    err && typeof err === "object"
      ? {
          code: "code" in err ? err.code : undefined,
          details: "details" in err ? err.details : undefined,
          hint: "hint" in err ? err.hint : undefined,
        }
      : {};

  return NextResponse.json(
    { success: false, error: message, ...details },
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
    const schoolType =
      typeof body.school_type === "string" && body.school_type.trim()
        ? body.school_type.trim()
        : "حكومية";

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
        principal_name: "غير محدد",
        school_name: name,
        city,
        school_type: schoolType,
        phone: "",
        trial_start: new Date().toISOString(),
        trial_end: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
        status: "trial",
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
