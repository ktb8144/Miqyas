"use client";

import { toEnglishDigits } from "@/lib/format";
import { EmptyState } from "./ui";
import type { PrincipalDashboardState } from "../_lib/use-principal-dashboard";

export function AlertsTab({ d }: { d: PrincipalDashboardState }) {
  const { report } = d;
  if (!report) return null;

  return (
    <div className="space-y-4">
      {report.alerts.length ? report.alerts.map((alert) => (
        <div key={`${alert.type}-${alert.title}`} className="rounded-xl border p-5" style={{ background: alert.type === "risk" ? "#fff5f5" : "#f8fafc", borderColor: alert.type === "risk" ? "#fecaca" : "#e2e8f0" }}>
          <h3 className="font-bold text-brand-navy">{alert.title}</h3>
          <p className="mt-1 text-sm font-bold text-slate-500">{toEnglishDigits(alert.detail)}</p>
        </div>
      )) : <EmptyState>لا توجد تنبيهات إدارية حالية</EmptyState>}
    </div>
  );
}
