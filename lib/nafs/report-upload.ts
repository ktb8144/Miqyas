import { shrinkImage } from "@/lib/import/shrink-image";
import type { NafsBaseline } from "@/lib/nafs/baseline";

/** Browser only. Sends the NAFS report (PDF or photos) to be read; nothing is saved by this call. */

export type NafsReportResult = { baselines: NafsBaseline[]; warnings: string[] };

// Keep in step with MAX_TOTAL_BYTES in app/api/principal/nafs-report/route.ts.
const MAX_REPORT_BYTES = 4_200_000;

export async function uploadNafsReport(list: FileList | File[] | null): Promise<NafsReportResult> {
  const picked = Array.from(list ?? []);
  if (!picked.length) throw new Error("اختر ملف التقرير أولًا.");
  const files = await Promise.all(picked.map((file) => shrinkImage(file)));
  if (files.reduce((sum, f) => sum + f.size, 0) > MAX_REPORT_BYTES) {
    throw new Error("حجم الملف كبير. أرسل التقرير بحجم أصغر من 4 ميجابايت، أو صوّر صفحاته.");
  }
  const body = new FormData();
  files.forEach((file) => body.append("files", file));
  const res = await fetch("/api/principal/nafs-report", { method: "POST", body });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) throw new Error(json.error || "تعذرت قراءة التقرير");
  return { baselines: json.baselines as NafsBaseline[], warnings: (json.warnings as string[]) ?? [] };
}
