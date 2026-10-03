import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase-admin";
import { requireAdmin, authErrorResponse } from "@/lib/auth";

export const dynamic = "force-dynamic";

type EventRow = {
  id: string;
  token_id: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type TokenRow = {
  id: string;
  student_id: string | null;
  school_id: string | null;
  class_id: string | null;
  created_by: string | null;
  expires_at: string;
  revoked_at: string | null;
};

type NamedRow = {
  id: string;
  name: string | null;
};

type CreatorRow = {
  id: string;
  name: string | null;
  email: string | null;
};

type ContactRow = {
  event_id: string | null;
  token_id: string | null;
  whatsapp_phone: string | null;
  email: string | null;
  relation: string | null;
  consent_at: string | null;
};

function getLinkStatus(token?: TokenRow) {
  if (!token) return "غير معروف";
  if (token.revoked_at) return "ملغي";
  if (new Date(token.expires_at).getTime() <= Date.now()) return "منتهي";
  return "صالح";
}

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin.ok) return authErrorResponse(admin);

  try {
    const db = getAdminClient();
    const { data: currentUser, error: currentUserError } = await db
      .from("users")
      .select("id, auth_id, role")
      .eq("auth_id", admin.user.id)
      .maybeSingle();

    if (currentUserError) throw currentUserError;
    if (!currentUser || currentUser.role !== "admin") {
      return NextResponse.json({ success: false, error: "غير مصرح" }, { status: 403 });
    }

    const params = req.nextUrl.searchParams;
    const schoolFilter = params.get("schoolId");
    const skillFilter = params.get("skill")?.trim();
    const statusFilter = params.get("status")?.trim();
    const dateFrom = params.get("dateFrom");
    const dateTo = params.get("dateTo");

    let eventQuery = db
      .from("parent_report_events")
      .select("id, token_id, metadata, created_at")
      .eq("event_type", "subscription_interest")
      .order("created_at", { ascending: false })
      .limit(500);

    if (dateFrom) eventQuery = eventQuery.gte("created_at", dateFrom);
    if (dateTo) eventQuery = eventQuery.lte("created_at", `${dateTo}T23:59:59.999Z`);

    const { data: events, error: eventsError } = await eventQuery;
    if (eventsError) throw eventsError;

    const eventRows = (events ?? []) as EventRow[];
    const tokenIds = Array.from(new Set(eventRows.map((event) => event.token_id).filter(Boolean)));
    if (!tokenIds.length) {
      return NextResponse.json({ success: true, data: [] });
    }

    const { data: tokens, error: tokensError } = await db
      .from("parent_report_tokens")
      .select("id, student_id, school_id, class_id, created_by, expires_at, revoked_at")
      .in("id", tokenIds);
    if (tokensError) throw tokensError;

    const tokenRows = (tokens ?? []) as TokenRow[];
    const filteredTokens = schoolFilter ? tokenRows.filter((token) => token.school_id === schoolFilter) : tokenRows;
    const allowedTokenIds = new Set(filteredTokens.map((token) => token.id));
    const studentIds = Array.from(new Set(filteredTokens.map((token) => token.student_id).filter(Boolean))) as string[];
    const schoolIds = Array.from(new Set(filteredTokens.map((token) => token.school_id).filter(Boolean))) as string[];
    const classIds = Array.from(new Set(filteredTokens.map((token) => token.class_id).filter(Boolean))) as string[];
    const creatorIds = Array.from(new Set(filteredTokens.map((token) => token.created_by).filter(Boolean))) as string[];

    const [studentsRes, schoolsRes, classesRes, creatorsRes, contactsRes] = await Promise.all([
      studentIds.length
        ? db.from("students").select("id, name").in("id", studentIds)
        : Promise.resolve({ data: [], error: null }),
      schoolIds.length
        ? db.from("schools").select("id, name").in("id", schoolIds)
        : Promise.resolve({ data: [], error: null }),
      classIds.length
        ? db.from("classes").select("id, name").in("id", classIds)
        : Promise.resolve({ data: [], error: null }),
      creatorIds.length
        ? db.from("users").select("id, name, email").in("id", creatorIds)
        : Promise.resolve({ data: [], error: null }),
      db
        .from("parent_interest_contacts")
        .select("event_id, token_id, whatsapp_phone, email, relation, consent_at")
        .in("token_id", tokenIds),
    ]);

    const firstError = studentsRes.error ?? schoolsRes.error ?? classesRes.error ?? creatorsRes.error ?? contactsRes.error;
    if (firstError) throw firstError;

    const studentsMap = new Map(((studentsRes.data ?? []) as NamedRow[]).map((row) => [row.id, row]));
    const schoolsMap = new Map(((schoolsRes.data ?? []) as NamedRow[]).map((row) => [row.id, row]));
    const classesMap = new Map(((classesRes.data ?? []) as NamedRow[]).map((row) => [row.id, row]));
    const creatorsMap = new Map(((creatorsRes.data ?? []) as CreatorRow[]).map((row) => [row.id, row]));
    const contactsMap = new Map(((contactsRes.data ?? []) as ContactRow[]).map((row) => [row.event_id ?? "", row]));
    const tokensMap = new Map(filteredTokens.map((token) => [token.id, token]));

    const rows = eventRows
      .filter((event) => allowedTokenIds.has(event.token_id))
      .map((event) => {
        const token = tokensMap.get(event.token_id);
        const linkStatus = getLinkStatus(token);
        const skillName = typeof event.metadata?.skill_name === "string" ? event.metadata.skill_name : "";
        const score = typeof event.metadata?.score === "number" ? event.metadata.score : null;
        const totalQuestions = typeof event.metadata?.total_questions === "number" ? event.metadata.total_questions : null;
        const contact = contactsMap.get(event.id);
        return {
          id: event.id,
          interestedAt: event.created_at,
          studentName: token?.student_id ? studentsMap.get(token.student_id)?.name ?? "غير معروف" : "غير معروف",
          schoolName: token?.school_id ? schoolsMap.get(token.school_id)?.name ?? "غير معروف" : "غير معروف",
          className: token?.class_id ? classesMap.get(token.class_id)?.name ?? "غير محدد" : "غير محدد",
          skillName,
          score,
          totalQuestions,
          creatorName: token?.created_by ? creatorsMap.get(token.created_by)?.name ?? "غير محدد" : "غير محدد",
          creatorEmail: token?.created_by ? creatorsMap.get(token.created_by)?.email ?? null : null,
          linkStatus,
          whatsappPhone: contact?.whatsapp_phone ?? null,
          email: contact?.email ?? null,
          relation: contact?.relation ?? null,
          consentAt: contact?.consent_at ?? null,
        };
      })
      .filter((row) => !skillFilter || row.skillName.includes(skillFilter))
      .filter((row) => !statusFilter || row.linkStatus === statusFilter);

    return NextResponse.json({ success: true, data: rows });
  } catch (err) {
    console.error("admin parent interests failed", err);
    return NextResponse.json({ success: false, error: "تعذر تحميل اهتمامات أولياء الأمور" }, { status: 500 });
  }
}
