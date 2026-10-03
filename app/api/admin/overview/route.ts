import { NextRequest, NextResponse } from "next/server";
import { getAdminOverview } from "@/lib/admin-overview";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);

  if (!admin.ok) {
    return NextResponse.json(
      { success: false, error: admin.error },
      { status: admin.status }
    );
  }

  try {
    const overview = await getAdminOverview();

    return NextResponse.json({
      success: true,
      data: overview,
      meta: {
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error("admin overview failed", err);
    return NextResponse.json(
      { success: false, error: "تعذر تحميل ملخص لوحة الإدارة" },
      { status: 500 }
    );
  }
}
