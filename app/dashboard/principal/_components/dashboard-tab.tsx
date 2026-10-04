"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatNumber, toEnglishDigits } from "@/lib/format";
import { COLORS } from "@/lib/theme";
import { ETEC_LEVELS, getLevelFromPercentage, levelColor } from "@/lib/levels";
import { EmptyState, formatPct } from "./ui";
import type { PrincipalDashboardState } from "../_lib/use-principal-dashboard";

const LEVELS = ["متقدم", "متمكن", "أساسي", "دون الأساسي"] as const;
const WEEK_LABEL = new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", { day: "numeric", month: "short", timeZone: "UTC" });

function weekLabel(date: string) {
  return WEEK_LABEL.format(new Date(`${date}T00:00:00Z`));
}

function Stat({ label, value, sub, tone = "navy" }: { label: string; value: string; sub?: string; tone?: "navy" | "brand" | "danger" | "warning" }) {
  const color = { navy: "text-brand-navy", brand: "text-brand", danger: "text-danger", warning: "text-warning" }[tone];
  return (
    <div className="rounded-[1.25rem] border border-slate-100 bg-white p-4 shadow-[0_10px_34px_rgba(15,35,55,0.035)] sm:p-5">
      <div className="text-xs font-bold text-slate-500 sm:text-sm">{label}</div>
      <div className={`mt-1 text-2xl font-black sm:text-3xl ${color}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs font-bold text-slate-400">{sub}</div>}
    </div>
  );
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[1.25rem] border border-slate-100 bg-white p-4 shadow-[0_10px_34px_rgba(15,35,55,0.035)] sm:p-6">
      <h3 className="font-black text-brand-navy">{title}</h3>
      {subtitle && <p className="mt-0.5 text-xs font-bold text-slate-400">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </div>
  );
}

/** The principal's home: four numbers, one chart, and what needs attention this week. */
export function DashboardTab({ d }: { d: PrincipalDashboardState }) {
  const { report, chartData, setActiveTab } = d;
  if (!report) return null;

  const avg = report.kpis.performanceAverage;
  const week = report.thisWeek;
  const trend = report.trend.filter((point) => point.average !== null);
  const levelsTotal = LEVELS.reduce((sum, level) => sum + report.levelDistribution[level], 0);

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="متوسط المدرسة"
          value={formatPct(avg)}
          sub={avg === null ? "لا توجد نتائج بعد" : getLevelFromPercentage(avg)}
          tone="brand"
        />
        <Stat
          label="اختبار هذا الأسبوع"
          value={week.classesTotal ? `${toEnglishDigits(week.classesDone)}/${toEnglishDigits(week.classesTotal)}` : "—"}
          sub={week.classesTotal ? "فصول صحّحت" : "لا يوجد اختبار هذا الأسبوع"}
        />
        <Stat
          label="الطلاب المختبَرون"
          value={formatNumber(report.testedStudents)}
          sub={`من ${formatNumber(report.kpis.studentsCount)} طالب`}
        />
        <Stat
          label="يحتاجون دعمًا"
          value={formatNumber(report.kpis.atRiskCount)}
          sub="متوسطهم دون 50%"
          tone={report.kpis.atRiskCount ? "danger" : "navy"}
        />
      </div>

      {trend.length >= 2 ? (
        <Card title="تطور متوسط المدرسة" subtitle="متوسط درجات الطلاب في كل أسبوع">
          <div dir="ltr">
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={trend.map((point) => ({ ...point, label: weekLabel(point.weekStart) }))} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={COLORS.brand} stopOpacity={0.25} />
                    <stop offset="100%" stopColor={COLORS.brand} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f6" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} reversed tickLine={false} axisLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#64748b" }} orientation="right" tickLine={false} axisLine={false} width={36} />
                <Tooltip
                  formatter={(value) => [`${value}%`, "المتوسط"]}
                  labelFormatter={(label) => `أسبوع ${label}`}
                  contentStyle={{ direction: "rtl", borderRadius: 12, fontSize: 12 }}
                />
                <Area type="monotone" dataKey="average" stroke={COLORS.brand} strokeWidth={2.5} fill="url(#trendFill)" dot={{ r: 3, fill: COLORS.brand }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      ) : (
        <Card title="متوسط الفصول" subtitle="يظهر تطور المدرسة أسبوعًا بأسبوع بعد أسبوعين من النتائج">
          {chartData.some((item) => item.avg > 0) ? (
            <div dir="ltr">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eef2f6" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} reversed tickLine={false} axisLine={false} interval={0} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#64748b" }} orientation="right" tickLine={false} axisLine={false} width={36} />
                  <Tooltip formatter={(value) => [`${value}%`, "المتوسط"]} contentStyle={{ direction: "rtl", borderRadius: 12, fontSize: 12 }} />
                  <Bar dataKey="avg" fill={COLORS.brand} radius={[6, 6, 0, 0]} maxBarSize={36} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState>تظهر الرسوم بعد تصحيح أول اختبار.</EmptyState>
          )}
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="مستويات الطلاب" subtitle="حسب متوسط كل طالب، بمستويات هيئة تقويم التعليم">
          {levelsTotal ? (
            <>
              <div className="flex h-4 overflow-hidden rounded-full bg-slate-100">
                {LEVELS.map((level) => {
                  const count = report.levelDistribution[level];
                  return count ? (
                    <div key={level} style={{ width: `${(count / levelsTotal) * 100}%`, background: ETEC_LEVELS[level].color }} title={level} />
                  ) : null;
                })}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {LEVELS.map((level) => {
                  const count = report.levelDistribution[level];
                  return (
                    <div key={level} className="rounded-xl bg-slate-50 p-2 text-center">
                      <div className="text-lg font-black" style={{ color: ETEC_LEVELS[level].color }}>
                        {toEnglishDigits(Math.round((count / levelsTotal) * 100))}%
                      </div>
                      <div className="text-[11px] font-bold text-slate-500">{level} · {toEnglishDigits(count)}</div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <EmptyState>لا توجد نتائج بعد.</EmptyState>
          )}
        </Card>

        <Card title="أضعف المهارات" subtitle="من إجابات الطلاب في آخر 60 يومًا">
          {report.weakSkills.length ? (
            <div className="space-y-3">
              {report.weakSkills.slice(0, 3).map((item) => (
                <div key={item.skill}>
                  <div className="mb-1 flex justify-between gap-3 text-sm font-bold">
                    <span className="min-w-0 truncate text-slate-700">{item.skill}</span>
                    <span className="flex-shrink-0" style={{ color: levelColor(item.average) }}>{toEnglishDigits(item.average)}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100">
                    <div className="h-2 rounded-full" style={{ width: `${item.average}%`, background: levelColor(item.average) }} />
                  </div>
                </div>
              ))}
              <button onClick={() => setActiveTab(2)} className="text-xs font-extrabold text-brand hover:underline">
                عرض الطلاب الذين يحتاجون دعمًا ←
              </button>
            </div>
          ) : (
            <EmptyState>لا توجد إجابات كافية بعد.</EmptyState>
          )}
        </Card>
      </div>

      {week.classesTotal > 0 && (
        <Card
          title={week.pending.length ? "فصول لم تصحّح اختبار هذا الأسبوع" : "اختبار هذا الأسبوع"}
          subtitle={week.pending.length ? "تذكير المعلم يكفي غالبًا" : undefined}
        >
          {week.pending.length ? (
            <ul className="divide-y divide-slate-100">
              {week.pending.map((item, index) => (
                <li key={`${item.className}-${index}`} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-brand-navy">{item.className}</p>
                    <p className="truncate text-xs font-bold text-slate-400">{item.teacherName}</p>
                  </div>
                  <span className="flex-shrink-0 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">
                    {toEnglishDigits(item.tested)}/{toEnglishDigits(item.studentsCount)} ورقة
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-xl bg-teal-50 p-3 text-sm font-bold text-brand">✓ كل الفصول صحّحت اختبار هذا الأسبوع.</p>
          )}
        </Card>
      )}
    </div>
  );
}
