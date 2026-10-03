"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { COLORS } from "@/lib/theme";
import { EmptyState } from "./ui";
import type { PrincipalDashboardState } from "../_lib/use-principal-dashboard";

export function ImprovementTab({ d }: { d: PrincipalDashboardState }) {
  const { report } = d;
  if (!report) return null;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="mb-6 font-bold text-gray-900">مؤشر التحسن</h3>
        {report.improvement.value === null ? (
          <EmptyState>{report.improvement.label}</EmptyState>
        ) : (
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={[{ label: "البداية", avg: report.kpis.performanceAverage ?? 0 }, { label: "الحالي", avg: report.improvement.value }]}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Line type="monotone" dataKey="avg" stroke={COLORS.brand} strokeWidth={3} dot={{ fill: COLORS.brand, r: 5 }} name="المتوسط %" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
