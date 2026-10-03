import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase-admin";
import { requireUserRole } from "@/lib/auth";

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
  metadata: Record<string, unknown> | null;
};

export async function GET(req: NextRequest) {
  const auth = await requireUserRole(req, ["admin", "principal", "supervisor"]);
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
    if (!currentUser || !["admin", "principal", "supervisor"].includes(currentUser.role)) {
      return NextResponse.json(
        { success: false, error: "ليست لديك صلاحية لعرض هذه الإحصاءات", generatedAt: new Date().toISOString() },
        { status: 403, headers: NO_STORE_HEADERS }
      );
    }

    const schoolId = currentUser.school_id;
    if (!schoolId && currentUser.role !== "admin") {
      return NextResponse.json(
        { success: false, error: "الحساب غير مرتبط بمدرسة", generatedAt: new Date().toISOString() },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    let tokenQuery = db
      .from("parent_report_tokens")
      .select("id, open_count", { count: "exact" });

    if (schoolId) tokenQuery = tokenQuery.eq("school_id", schoolId);

    const { data: tokens, error: tokenError, count: totalLinksCount } = await tokenQuery;
    if (tokenError) throw tokenError;

    const tokenRows = (tokens ?? []) as TokenRow[];
    const tokenIds = tokenRows.map((item) => item.id);
    const { data: events, error: eventsError } = tokenIds.length
      ? await db
          .from("parent_report_events")
          .select("token_id, event_type, metadata")
          .in("token_id", tokenIds)
      : { data: [], error: null };

    if (eventsError) throw eventsError;

    const eventRows = (events ?? []) as EventRow[];
    const openedReports = tokenRows.filter((item) => Number(item.open_count ?? 0) > 0).length;
    const missionClicks = eventRows.filter((item) => item.event_type === "open_mission").length;
    const completedMissions = eventRows.filter((item) => item.event_type === "mission_completed").length;
    const subscriptionEvents = eventRows.filter((item) => item.event_type === "subscription_interest");
    const skillCounts = new Map<string, number>();

    subscriptionEvents.forEach((event) => {
      const skill = typeof event.metadata?.skill_name === "string" ? event.metadata.skill_name.trim() : "";
      if (skill) skillCounts.set(skill, (skillCounts.get(skill) ?? 0) + 1);
    });

    const topInterestedSkill = Array.from(skillCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([skillName, count]) => ({ skillName, count }))[0] ?? null;
    const totalLinks = totalLinksCount ?? tokenRows.length;

    return NextResponse.json({
      success: true,
      generatedAt: new Date().toISOString(),
      data: {
        totalLinks,
        openedReports,
        openRate: totalLinks ? Math.round((openedReports / totalLinks) * 100) : null,
        missionClicks,
        completedMissions,
        subscriptionInterestCount: subscriptionEvents.length,
        unopenedLinks: totalLinks - openedReports,
        topInterestedSkill,
      },
    }, { headers: NO_STORE_HEADERS });
  } catch (err) {
    console.error("principal parent report stats failed", err);
    return NextResponse.json(
      { success: false, error: "تعذر تحميل تفاعل أولياء الأمور", generatedAt: new Date().toISOString() },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
