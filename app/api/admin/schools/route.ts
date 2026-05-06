import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, requireAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

function normalizeSchool(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    city: String(row.city ?? ""),
    principal: String(row.principal ?? "—"),
    teachers: Number(row.teachers ?? 0),
    students: Number(row.students ?? 0),
    status: String(row.status ?? "نشطة"),
    score: String(row.score ?? "—"),
  };
}

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);

  if (!admin.ok) {
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
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);

  if (!admin.ok) {
    return NextResponse.json(
      { success: false, error: admin.error },
      { status: admin.status }
    );
  }

  try {
    const body = await req.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const city = typeof body.city === "string" ? body.city.trim() : "";

    if (!name) {
      return NextResponse.json(
        { success: false, error: "name is required" },
        { status: 400 }
      );
    }

    const { data, error } = await getAdminClient()
      .from("schools")
      .insert({ name, city, status: "نشطة" })
      .select("*")
      .single();

    if (error) throw error;

    return NextResponse.json(
      { success: true, data: normalizeSchool(data) },
      { status: 201 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
