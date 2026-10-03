import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase-admin";
import { requireUserRole, authErrorResponse } from "@/lib/auth";
import { normalizeSubject } from "@/lib/subjects";
import type { ClassRow as DbClassRow } from "@/lib/db/rows";

export const dynamic = "force-dynamic";

type ClassRow = Pick<DbClassRow, "id" | "name" | "grade" | "subject">;

function normalizeGrade(grade: number | string | null | undefined) {
  const value = Number(grade);
  return Number.isFinite(value) ? value : null;
}

export async function GET(req: NextRequest) {
  const auth = await requireUserRole(req, ["teacher"]);
  if (!auth.ok) return authErrorResponse(auth);

  try {
    const db = getAdminClient();
    const today = new Date().toISOString().slice(0, 10);

    const { data: classRows, error: classesError } = await db
      .from("classes")
      .select("id, name, grade, subject")
      .eq("teacher_id", auth.profile.id)
      .eq("school_id", auth.profile.school_id)
      .order("created_at", { ascending: false });

    if (classesError) throw classesError;

    const classes = (classRows ?? []) as ClassRow[];
    const currentPlans: Array<{ plan: unknown; class: ClassRow }> = [];
    const upcomingPlans: Array<{ plan: unknown; class: ClassRow }> = [];

    await Promise.all(
      classes.map(async (classItem) => {
        const grade = normalizeGrade(classItem.grade);
        const subject = normalizeSubject(classItem.subject);
        if (!grade || !["رياضيات", "لغة عربية", "علوم"].includes(subject)) return;
        if (subject === "علوم" && grade === 3) return;

        const { data: currentPlan, error: currentError } = await db
          .from("weekly_plans")
          .select("*")
          .eq("grade", grade)
          .eq("subject", subject)
          .eq("status", "active")
          .lte("start_date", today)
          .gte("end_date", today)
          .order("week_number", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (currentError) throw currentError;

        if (currentPlan) {
          currentPlans.push({ plan: currentPlan, class: classItem });
          return;
        }

        const { data: upcomingPlan, error: upcomingError } = await db
          .from("weekly_plans")
          .select("*")
          .eq("grade", grade)
          .eq("subject", subject)
          .eq("status", "active")
          .gt("start_date", today)
          .order("start_date", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (upcomingError) throw upcomingError;
        if (upcomingPlan) upcomingPlans.push({ plan: upcomingPlan, class: classItem });
      })
    );

    return NextResponse.json({
      success: true,
      currentPlans,
      upcomingPlans,
      source: currentPlans.length ? "current_week" : upcomingPlans.length ? "upcoming" : "none",
    });
  } catch (err) {
    console.error("teacher current plan failed", err);
    return NextResponse.json(
      { success: false, error: "تعذر تحميل خطة الأسبوع" },
      { status: 500 }
    );
  }
}
