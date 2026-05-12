import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, requireUserRole } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

type TokenRow = {
  id: string;
  open_count: number | null;
};

type EventRow = {
  token_id: string;
  event_type: string;
};

export async function GET(req: NextRequest) {
  const auth = await requireUserRole(req, ["teacher"]);
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  try {
    const schoolId = auth.profile.school_id;
    if (!schoolId) {
      return NextResponse.json({ success: false, error: "حساب المعلم غير مرتبط بمدرسة" }, { status: 400 });
    }

    const db = getAdminClient();
    const { data: tokens, error: tokenError } = await db
      .from("parent_report_tokens")
      .select("id, open_count")
      .eq("created_by", auth.profile.id)
      .eq("school_id", schoolId);

    if (tokenError) throw tokenError;

    const tokenRows = (tokens ?? []) as TokenRow[];
    const tokenIds = tokenRows.map((item) => item.id);
    const { data: events, error: eventsError } = tokenIds.length
      ? await db
          .from("parent_report_events")
          .select("token_id, event_type")
          .in("token_id", tokenIds)
      : { data: [], error: null };

    if (eventsError) throw eventsError;

    const eventRows = (events ?? []) as EventRow[];
    const openedReports = tokenRows.filter((item) => Number(item.open_count ?? 0) > 0).length;
    const missionOpens = eventRows.filter((item) => item.event_type === "open_mission").length;
    const missionCompleted = eventRows.filter((item) => item.event_type === "mission_completed").length;
    const totalLinks = tokenRows.length;

    return NextResponse.json({
      success: true,
      data: {
        totalLinks,
        openedReports,
        openRate: totalLinks ? Math.round((openedReports / totalLinks) * 100) : null,
        missionOpens,
        missionCompleted,
        unopenedLinks: totalLinks - openedReports,
      },
    });
  } catch (err) {
    console.error("teacher parent report stats failed", err);
    return NextResponse.json({ success: false, error: "تعذر تحميل تفاعل أولياء الأمور" }, { status: 500 });
  }
}
