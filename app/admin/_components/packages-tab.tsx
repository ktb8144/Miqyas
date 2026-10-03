"use client";

import { FileJson } from "lucide-react";
import { toEnglishDigits } from "@/lib/format";
import { COLORS } from "@/lib/theme";
import { packageStatusLabel, packageTypeLabel } from "@/lib/labels";
import type { AdminAssessmentPackage } from "../_lib/types";
import {
  EmptyState,
  ErrorState,
  PageHeader,
  PrimaryButton,
  SearchBar,
  SoftButton,
  StatusBadge,
} from "./ui";

export function PackagesTab({
  packages,
  loading,
  error,
  search,
  onSearch,
  onRetry,
  onCreate,
  onEdit,
  onImport,
  onPublish,
  onApplyClasses,
  onWithdraw,
  onArchive,
  busyPackageId,
}: {
  packages: AdminAssessmentPackage[];
  loading: boolean;
  error: string | null;
  search: string;
  onSearch: (value: string) => void;
  onRetry: () => void;
  onCreate: () => void;
  onEdit: (item: AdminAssessmentPackage) => void;
  onImport: (item: AdminAssessmentPackage) => void;
  onPublish: (item: AdminAssessmentPackage) => void;
  onApplyClasses: (item: AdminAssessmentPackage) => void;
  onWithdraw: (item: AdminAssessmentPackage) => void;
  onArchive: (item: AdminAssessmentPackage) => void;
  busyPackageId: string | null;
}) {
  return (
    <div className="space-y-8">
      <PageHeader
        title="حزم الاختبارات"
        description="إنشاء حزم دالة الأسبوعية، ربط ملفات PDF، استيراد مفتاح الإجابة وخريطة المهارات، ثم نشرها للمدارس."
        action={<PrimaryButton onClick={onCreate}>إنشاء حزمة</PrimaryButton>}
      />
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <SearchBar placeholder="ابحث بعنوان الحزمة أو المادة أو الحالة..." value={search} onChange={onSearch} />
        <SoftButton disabled title="Excel قريبًا">
          <FileJson className="h-4 w-4" />
          استيراد Excel · قريبًا
        </SoftButton>
      </div>
      {error && <ErrorState message={error} onRetry={onRetry} />}
      <div className="grid gap-4">
        {packages.map((item) => {
          const pdfReady = Boolean(item.questions_pdf_url || item.student_pdf_url);
          const readiness = !pdfReady
            ? { label: "ناقصة ملف الأسئلة", color: COLORS.warning, bg: "#fffbeb" }
            : item.question_count <= 0
              ? { label: "ناقصة مفتاح الإجابة", color: COLORS.warning, bg: "#fffbeb" }
              : item.incomplete_question_count > 0
                ? { label: "تحتاج ربط مهارات", color: COLORS.danger, bg: "#fff5f5" }
                : item.status !== "published" || item.assigned_school_count <= 0
                  ? { label: "غير منشورة", color: "#64748b", bg: "#f8fafc" }
                  : { label: "جاهزة للتجربة", color: COLORS.brand, bg: "#f0fdf8" };
          const busy = busyPackageId === item.id;
          return (
            <div key={item.id} className="rounded-[1.5rem] border border-slate-100 bg-white p-5 shadow-[0_10px_34px_rgba(15,35,55,0.035)]">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={packageStatusLabel(item.status)} />
                    <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-bold text-slate-500">{packageTypeLabel(item.package_type)}</span>
                    <span className="rounded-full px-3 py-1 text-xs font-bold" style={{ color: readiness.color, background: readiness.bg }}>{readiness.label}</span>
                    <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-bold text-slate-500">{item.subject}</span>
                    <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-bold text-slate-500">صف {toEnglishDigits(item.grade)}</span>
                  </div>
                  <h3 className="mt-3 text-xl font-black text-brand-navy">{item.title}</h3>
                  <p className="mt-2 text-sm font-bold text-slate-400">
                    الأسبوع {toEnglishDigits(item.week_number ?? "—")} · نموذج {toEnglishDigits(item.assessment_code ?? "—")} · {toEnglishDigits(item.duration_minutes ?? "—")} دقيقة
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
                  <div className="rounded-xl bg-slate-50 px-4 py-3">
                    <div className="text-lg font-black text-brand-navy">{toEnglishDigits(item.question_count)}</div>
                    <div className="text-xs font-bold text-slate-400">سؤال</div>
                  </div>
                  <div className="rounded-xl bg-slate-50 px-4 py-3">
                    <div className="text-lg font-black text-brand-navy">{toEnglishDigits(item.assigned_school_count)}</div>
                    <div className="text-xs font-bold text-slate-400">مدرسة</div>
                  </div>
                  <div className="rounded-xl bg-slate-50 px-4 py-3">
                    <div className={`text-lg font-black ${pdfReady ? "text-brand" : "text-amber-600"}`}>{pdfReady ? "جاهز" : "ناقص"}</div>
                    <div className="text-xs font-bold text-slate-400">ملف الأسئلة</div>
                  </div>
                  <div className="rounded-xl bg-slate-50 px-4 py-3">
                    <div className="text-lg font-black text-brand-navy">{item.published_at ? "نُشر" : "—"}</div>
                    <div className="text-xs font-bold text-slate-400">النشر</div>
                  </div>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <SoftButton onClick={() => onEdit(item)} disabled={busy}>تعديل</SoftButton>
                <SoftButton onClick={() => onImport(item)} disabled={busy}>استيراد/تعديل مفتاح الإجابة</SoftButton>
                <SoftButton onClick={() => onPublish(item)} disabled={busy || item.status === "archived"}>نشر للمدارس</SoftButton>
                <SoftButton onClick={() => onApplyClasses(item)} disabled={busy || item.status !== "published"}>تطبيق على كل الفصول المطابقة</SoftButton>
                <SoftButton onClick={() => onWithdraw(item)} disabled={busy || item.status !== "published"}>سحب من المدارس</SoftButton>
                <SoftButton onClick={() => onArchive(item)} disabled={busy || item.status === "archived"} title={item.status === "archived" ? "مؤرشفة بالفعل" : undefined}>
                  أرشفة
                </SoftButton>
              </div>
            </div>
          );
        })}
        {!loading && packages.length === 0 && (
          <EmptyState message="لا توجد حزم اختبارات بعد. أنشئ أول حزمة للأسبوع التجريبي." />
        )}
        {loading && <EmptyState message="جارٍ تحميل حزم الاختبارات..." />}
      </div>
    </div>
  );
}
