import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, requireUserRole } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
};

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
    return NextResponse.json(
      { success: false, error: auth.error, generatedAt: new Date().toISOString() },
      { status: auth.status, headers: NO_STORE_HEADERS }
    );
  }

  try {
    const db = getAdminClient();
    const { data: currentUser, error: currentUserError } = await db
      .from("users")
      .select("id, auth_id, role, school_id")
      .eq("auth_id", auth.user.id)
      .maybeSingle();

    if (currentUserError) throw currentUserError;
    if (!currentUser || currentUser.role !== "teacher") {
      return NextResponse.json(
        { success: false, error: "تعذر تحديد حساب المعلم الحالي", generatedAt: new Date().toISOString() },
        { status: 403, headers: NO_STORE_HEADERS }
      );
    }

    const schoolId = currentUser.school_id;
    if (!schoolId) {
      return NextResponse.json(
        { success: false, error: "حساب المعلم غير مرتبط بمدرسة", generatedAt: new Date().toISOString() },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const { data: tokens, error: tokenError, count: totalLinksCount } = await db
      .from("parent_report_tokens")
      .select("id, open_count", { count: "exact" })
      .eq("created_by", currentUser.id)
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
    const subscriptionInterestCount = eventRows.filter((item) => item.event_type === "subscription_interest").length;
    const totalLinks = totalLinksCount ?? tokenRows.length;

    console.info("teacher parent report stats", {
      authUserId: auth.user.id,
      currentUserId: currentUser.id,
      currentUserRole: currentUser.role,
      currentUserSchoolId: currentUser.school_id,
      totalLinks,
      openedReports,
      eventsCount: eventRows.length,
      subscriptionInterestCount,
      generatedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      generatedAt: new Date().toISOString(),
      data: {
        totalLinks,
        openedReports,
        openRate: totalLinks ? Math.round((openedReports / totalLinks) * 100) : null,
        missionOpens,
        missionCompleted,
        subscriptionInterestCount,
        unopenedLinks: totalLinks - openedReports,
      },
    }, { headers: NO_STORE_HEADERS });
  } catch (err) {
    console.error("teacher parent report stats failed", err);
    return NextResponse.json(
      { success: false, error: "تعذر تحميل تفاعل أولياء الأمور", generatedAt: new Date().toISOString() },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
