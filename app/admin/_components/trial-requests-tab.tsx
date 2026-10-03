"use client";

import { ClipboardList } from "lucide-react";
import { toEnglishDigits, formatNumber } from "@/lib/format";
import type { AdminTrialRequest } from "../_lib/types";
import { ErrorState, PageHeader, SoftButton, StatusBadge } from "./ui";

export function TrialRequestsTab({
  requests,
  loading,
  error,
  onRetry,
  busyTrialRequestId,
  onUpdateStatus,
}: {
  requests: AdminTrialRequest[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  busyTrialRequestId: string | null;
  onUpdateStatus: (request: AdminTrialRequest, status: string) => void;
}) {
  return (
    <div className="space-y-8">
      <PageHeader
        title="طلبات التجربة"
        description="متابعة طلبات المدارس القادمة من الصفحة الرئيسية وتحديث حالة التواصل معها."
        action={
          <SoftButton>
            <ClipboardList className="h-4 w-4" />
            {loading ? "جارٍ تحميل الطلبات..." : `${formatNumber(requests.length)} طلب`}
          </SoftButton>
        }
      />
      {error && <ErrorState message={error} onRetry={onRetry} />}

      <div className="rounded-[1.5rem] border border-slate-100 bg-white shadow-[0_10px_34px_rgba(15,35,55,0.035)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-400">
                <th className="px-5 py-4 text-right font-extrabold">الاسم</th>
                <th className="px-5 py-4 text-right font-extrabold">المدرسة</th>
                <th className="px-5 py-4 text-right font-extrabold">الجوال</th>
                <th className="px-5 py-4 text-right font-extrabold">الإيميل</th>
                <th className="px-5 py-4 text-right font-extrabold">الحالة</th>
                <th className="px-5 py-4 text-right font-extrabold">التاريخ</th>
                <th className="px-5 py-4 text-right font-extrabold">تحديث الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {requests.map((request) => (
                <tr key={request.id} className="transition hover:bg-slate-50/70">
                  <td className="px-5 py-4 font-extrabold text-brand-navy">{request.name}</td>
                  <td className="px-5 py-4 font-bold text-slate-500">{request.school_name}</td>
                  <td className="px-5 py-4 font-bold text-slate-500">{request.phone}</td>
                  <td className="px-5 py-4 font-bold text-slate-500">{request.email}</td>
                  <td className="px-5 py-4"><StatusBadge status={request.status} /></td>
                  <td className="px-5 py-4 font-bold text-slate-500">
                    {request.created_at ? toEnglishDigits(new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(request.created_at))) : "—"}
                  </td>
                  <td className="px-5 py-4">
                    <select
                      value={request.status}
                      disabled={busyTrialRequestId === request.id}
                      onChange={(event) => onUpdateStatus(request, event.target.value)}
                      className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs font-extrabold text-brand-navy outline-none transition focus:border-brand/40 focus:bg-white disabled:opacity-60"
                    >
                      <option value="new">جديد</option>
                      <option value="contacted">تم التواصل</option>
                      <option value="closed">مغلق</option>
                    </select>
                  </td>
                </tr>
              ))}
              {!loading && requests.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-sm font-extrabold text-slate-400">
                    لا توجد طلبات تجربة حتى الآن
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
