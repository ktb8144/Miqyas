"use client";

import { Download } from "lucide-react";
import { EmptyState, PageHeader, SoftButton } from "./ui";

export function ReportsTab() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="التقارير والتحليلات"
        description="متابعة أداء المدارس والمعلمين والطلاب واكتشاف أكثر المهارات ضعفًا على مستوى النظام."
        action={
          <SoftButton disabled title="قريبًا">
            <Download className="h-4 w-4" />
            تصدير التقرير · قريبًا
          </SoftButton>
        }
      />
      <div className="rounded-[1.5rem] border border-slate-100 bg-white p-6 shadow-[0_10px_34px_rgba(15,35,55,0.035)]">
        <h2 className="text-lg font-black text-brand-navy">تقارير النظام</h2>
        <p className="mt-2 text-sm font-bold leading-7 text-slate-500">
          لا يتم عرض مؤشرات تجريبية في لوحة الإدارة. ستظهر التقارير هنا بعد ربط نتائج الحزم وبيانات المدارس الفعلية.
        </p>
        <div className="mt-6">
          <EmptyState message="لا توجد تقارير فعلية جاهزة بعد." />
        </div>
      </div>
    </div>
  );
}
