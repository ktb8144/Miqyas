import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase-admin";
import { requireUserRole, authErrorResponse } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Marks the caller's own profile active once they have set a password. */
export async function POST(req: NextRequest) {
  const auth = await requireUserRole(req, ["admin", "principal", "supervisor", "teacher"]);
  if (!auth.ok) return authErrorResponse(auth);

  const { error } = await getAdminClient()
    .from("users")
    .update({ status: "active" })
    .eq("id", auth.profile.id)
    .eq("status", "invited");
  if (error) {
    console.error("activate user failed", error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
