import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function logTrialRequestError(err: unknown) {
  const details =
    err && typeof err === "object"
      ? {
          code: "code" in err ? err.code : undefined,
          message: "message" in err ? err.message : undefined,
          details: "details" in err ? err.details : undefined,
          hint: "hint" in err ? err.hint : undefined,
        }
      : { message: err instanceof Error ? err.message : "Unknown error" };

  console.error("trial request create failed", details);
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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const name = cleanText(body.name);
    const schoolName = cleanText(body.school_name);
    const phone = cleanText(body.phone);
    const email = cleanText(body.email).toLowerCase();
    const message = cleanText(body.message);

    if (!name || !schoolName || !phone || !email) {
      return NextResponse.json(
        { success: false, error: "name, school_name, phone and email are required" },
        { status: 400 }
      );
    }

    const { data, error } = await getAdminClient()
      .from("trial_requests")
      .insert({
        name,
        school_name: schoolName,
        phone,
        email,
        message: message || null,
        status: "new",
      })
      .select("id, status, created_at")
      .single();

    if (error) throw error;

    return NextResponse.json(
      { success: true, data },
      { status: 201 }
    );
  } catch (err) {
    logTrialRequestError(err);
    return errorResponse(err);
  }
}
