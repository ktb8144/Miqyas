import { NextRequest, NextResponse } from "next/server";
import { PDFDocument } from "pdf-lib";
import { getAdminClient } from "@/lib/supabase-admin";
import { requireUserRole, authErrorResponse } from "@/lib/auth";
import { ClaudeError, claudeConfigured } from "@/lib/claude";
import { readNafsReport, type ReportFile } from "@/lib/nafs/report-reader";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * POST multipart/form-data, field "files": the school's NAFS report as one or more PDFs or photos.
 * Returns the numbers read from it for the principal to review — nothing is saved here, and the
 * file is not stored. Saving goes through PUT /api/principal/nafs-baseline as before.
 */

const MEDIA_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
const MAX_FILES = 8;
// Vercel rejects request bodies above 4.5 MB; the page shrinks photos before sending.
const MAX_TOTAL_BYTES = 4_200_000;
const MAX_PDF_PAGES = 20;
const MAX_READS_PER_HOUR = 10;

function fail(error: string, status: number) {
  return NextResponse.json({ success: false, error }, { status });
}

async function readsInLastHour(schoolId: string) {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error } = await getAdminClient()
    .from("ai_usage")
    .select("id", { count: "exact", head: true })
    .eq("school_id", schoolId)
    .eq("task", "nafs_report")
    .gte("created_at", since);
  return error ? 0 : count ?? 0;
}

async function pdfPages(bytes: Uint8Array) {
  try {
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
    return doc.getPageCount();
  } catch (err) {
    // pdf-lib cannot open every valid PDF; Claude may still read it, so the page check is skipped.
    console.warn("nafs report: could not count PDF pages", err);
    return null;
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireUserRole(req, ["principal"]);
  if (!auth.ok) return authErrorResponse(auth);
  const schoolId = auth.profile.school_id;
  if (!schoolId) return fail("حسابك غير مرتبط بمدرسة", 400);
  if (!claudeConfigured()) return fail("قراءة التقارير غير مفعّلة حاليًا. أدخل النتائج يدويًا أو من Excel.", 503);

  const form = await req.formData().catch(() => null);
  const files = (form?.getAll("files") ?? []).filter((f): f is File => typeof f === "object" && f !== null && "arrayBuffer" in f);
  if (!files.length) return fail("أرفق تقرير نافس (PDF أو صورة).", 400);
  if (files.length > MAX_FILES) return fail(`أرفق ${MAX_FILES} ملفات على الأكثر.`, 400);
  if (files.some((f) => !MEDIA_TYPES.has(f.type))) return fail("الصيغ المقبولة: PDF أو صور (JPG، PNG).", 400);
  const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
  if (totalBytes > MAX_TOTAL_BYTES) return fail("حجم الملفات كبير. أرسل التقرير بحجم أصغر من 4 ميجابايت، أو صوّر صفحاته.", 413);

  if ((await readsInLastHour(schoolId)) >= MAX_READS_PER_HOUR) {
    return fail("قرأت دالة تقارير كثيرة لمدرستك خلال الساعة الماضية. حاول بعد قليل.", 429);
  }

  const payload: ReportFile[] = [];
  for (const file of files) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (file.type === "application/pdf") {
      const pages = await pdfPages(bytes);
      if (pages !== null && pages > MAX_PDF_PAGES) return fail(`التقرير ${pages} صفحة؛ أرسل صفحات نتائج نافس فقط (حتى ${MAX_PDF_PAGES} صفحة).`, 400);
    }
    payload.push({ mediaType: file.type, data: Buffer.from(bytes).toString("base64") });
  }

  try {
    const reading = await readNafsReport(payload, { schoolId, userId: auth.profile.id });
    if (!reading.isReport) return fail("الملف لا يبدو تقرير نتائج نافس. تأكد من الملف وحاول مرة أخرى.", 422);
    if (!reading.baselines.length) {
      return fail("لم نستطع قراءة أرقام من التقرير. جرّب ملفًا أوضح، أو أدخل النتائج يدويًا.", 422);
    }
    return NextResponse.json({ success: true, baselines: reading.baselines, warnings: reading.warnings });
  } catch (err) {
    console.error("nafs report read failed", err);
    const kind = err instanceof ClaudeError ? err.kind : "network";
    if (kind === "credits") return fail("انتهى رصيد القراءة الآلية لهذا الشهر. أدخل النتائج يدويًا أو من Excel.", 503);
    if (kind === "timeout") return fail("استغرقت قراءة التقرير وقتًا طويلًا. جرّب صفحات النتائج فقط.", 504);
    if (kind === "rate_limit" || kind === "overloaded") return fail("خدمة القراءة مشغولة الآن. حاول بعد دقيقة.", 503);
    return fail("تعذرت قراءة التقرير الآن. حاول مرة أخرى أو أدخل النتائج يدويًا.", 500);
  }
}
