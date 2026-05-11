import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminClient, requireAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const schoolCreateSchema = z.object({
  name: z.string().trim().min(1),
  city: z.string().trim().min(1),
  region: z.string().trim().min(1).nullable().optional(),
  type: z.string().trim().min(1).default("حكومية"),
  subscription_type: z.string().trim().min(1).default("trial"),
  subscription_start: z.string().trim().min(1).optional(),
  subscription_end: z.string().trim().min(1).optional(),
  active: z.boolean().default(true),
  trial: z.boolean().default(true),
});

function normalizeSchool(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    city: String(row.city ?? ""),
    region: row.region === null ? null : String(row.region ?? ""),
    type: String(row.type ?? ""),
    principal: "—",
    teachers: Number(row.teachers ?? 0),
    students: Number(row.students ?? 0),
    status: normalizeSchoolStatus(row.active, row.trial),
    score: String(row.score ?? "—"),
  };
}

function normalizeSchoolStatus(active: unknown, trial: unknown) {
  if (active === false) return "موقوفة";
  if (trial === true) return "تجريبية";
  return "نشطة";
}

function logSchoolError(action: string, err: unknown) {
  const details =
    err && typeof err === "object"
      ? {
          code: "code" in err ? err.code : undefined,
          message: "message" in err ? err.message : undefined,
          details: "details" in err ? err.details : undefined,
          hint: "hint" in err ? err.hint : undefined,
        }
      : { message: err instanceof Error ? err.message : "Unknown error" };

  console.error(`admin schools ${action} failed`, details);
}

function errorResponse(err: unknown, fallback = "تعذر تنفيذ العملية على المدارس") {
  const code = err && typeof err === "object" && "code" in err ? err.code : undefined;
  const message = err && typeof err === "object" && "message" in err ? String(err.message) : "";
  const details = err && typeof err === "object" && "details" in err ? String(err.details) : undefined;
  const hint = err && typeof err === "object" && "hint" in err ? String(err.hint) : undefined;

  return NextResponse.json(
    {
      success: false,
      error:
        code === "PGRST204"
          ? "تعذر حفظ المدرسة بسبب عدم تطابق أعمدة جدول schools في Supabase."
          : message.includes("violates not-null constraint")
            ? "تعذر حفظ المدرسة بسبب نقص حقل مطلوب في جدول schools."
            : message.includes("violates check constraint")
              ? "تعذر حفظ المدرسة بسبب قيمة غير مسموحة في أحد الحقول."
              : fallback,
      details,
      hint,
      code,
    },
    { status: 500 }
  );
}

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);

  if (!admin.ok) {
    console.warn("admin schools list blocked", {
      status: admin.status,
      reason: admin.error,
    });

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
    logSchoolError("list", err);
    return errorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);

  if (!admin.ok) {
    console.warn("admin schools create blocked", {
      status: admin.status,
      reason: admin.error,
    });

    return NextResponse.json(
      { success: false, error: admin.error },
      { status: admin.status }
    );
  }

  try {
    const parsed = schoolCreateSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "تحقق من بيانات المدرسة المطلوبة: اسم المدرسة والمدينة مطلوبان" },
        { status: 400 }
      );
    }

    const {
      name,
      city,
      region = null,
      type,
      subscription_type: subscriptionType,
      active,
      trial,
    } = parsed.data;
    const subscriptionStart = parsed.data.subscription_start ?? new Date().toISOString().slice(0, 10);
    const subscriptionEnd =
      parsed.data.subscription_end ?? new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const { data, error } = await getAdminClient()
      .from("schools")
      .insert({
        name,
        city,
        region,
        type,
        subscription_type: subscriptionType,
        subscription_start: subscriptionStart,
        subscription_end: subscriptionEnd,
        active,
        trial,
      })
      .select("*")
      .single();

    if (error) throw error;

    return NextResponse.json(
      { success: true, data: normalizeSchool(data) },
      { status: 201 }
    );
  } catch (err) {
    logSchoolError("create", err);
    return errorResponse(err, "تعذر إنشاء المدرسة في Supabase");
  }
}
