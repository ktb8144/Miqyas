import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authErrorResponse, requireUserRole } from "@/lib/auth";
import { errorJson, logDbError } from "@/lib/api";
import { buildTeacherEvidence } from "@/lib/teachers/evidence";

export const dynamic = "force-dynamic";

const dateParam = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable();

export async function GET(req: NextRequest) {
  const auth = await requireUserRole(req, ["teacher"]);
  if (!auth.ok) return authErrorResponse(auth);

  const url = new URL(req.url);
  const from = dateParam.safeParse(url.searchParams.get("from") || null);
  const to = dateParam.safeParse(url.searchParams.get("to") || null);
  if (!from.success || !to.success) return errorJson("صيغة التاريخ غير صحيحة", 400);

  try {
    const evidence = await buildTeacherEvidence(auth.profile, { from: from.data, to: to.data });
    return NextResponse.json({ success: true, data: evidence }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    logDbError("teacher evidence", err);
    return errorJson("تعذر تحميل ملف الشواهد");
  }
}
