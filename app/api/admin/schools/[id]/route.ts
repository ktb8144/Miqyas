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

function toDatabaseStatus(status: string) {
  if (status === "نشطة" || status === "active") return "active";
  if (status === "تجريبية" || status === "trial") return "trial";
  if (status === "موقوفة" || status === "inactive" || status === "disabled") {
    return "inactive";
  }
  return status;
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
    const updates: Record<string, string> = {};

    if (typeof body.name === "string") updates.school_name = body.name.trim();
    if (typeof body.city === "string") updates.city = body.city.trim();
    if (typeof body.school_type === "string") updates.school_type = body.school_type.trim();
    if (typeof body.status === "string") updates.status = toDatabaseStatus(body.status.trim());

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
      .update({ status: "inactive" })
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
