"use client";

import { Camera, FileText, BarChart3 } from "lucide-react";
import { toEnglishDigits } from "@/lib/format";
import { levelColor } from "@/lib/levels";
import type { TeacherPackageAssignment } from "../_lib/types";

const DAY_FORMAT = new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

/** "الخميس 9 أكتوبر" from a YYYY-MM-DD date. */
export function formatTestDay(date: string | null | undefined) {
  if (!date) return "—";
  const d = new Date(`${date}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? "—" : DAY_FORMAT.format(d);
}

/** One test for one class: what to do this week, in at most three buttons. */
export function TestCard({
  item,
  studentCount,
  onScan,
  onResults,
  onPrint,
}: {
  item: TeacherPackageAssignment;
  studentCount: number;
  onScan: () => void;
  onResults: () => void;
  onPrint: () => void;
}) {
  const tested = item.testedCount ?? 0;
  const done = studentCount > 0 && tested >= studentCount;
  const upcoming = item.phase === "upcoming";
  const progress = studentCount ? Math.min(100, Math.round((tested / studentCount) * 100)) : 0;

  return (
    <div className="rounded-[1.25rem] border border-slate-100 bg-white p-4 shadow-[0_10px_34px_rgba(15,35,55,0.035)] sm:p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-extrabold text-brand">{item.className} · {item.subject}</p>
          <h3 className="mt-1 text-lg font-black leading-snug text-brand-navy">{item.packageTitle}</h3>
          <p className="mt-1 text-xs font-bold text-slate-400">
            {upcoming ? `يبدأ ${formatTestDay(item.startDate)} — يمكنك الطباعة الآن` : `حتى ${formatTestDay(item.endDate)}`}
          </p>
        </div>
        {item.average !== null && item.average !== undefined && tested > 0 ? (
          <div className="flex-shrink-0 text-center">
            <div className="text-2xl font-black" style={{ color: levelColor(item.average) }}>{toEnglishDigits(item.average)}%</div>
            <div className="text-[11px] font-bold text-slate-400">المتوسط</div>
          </div>
        ) : (
          <span className={`flex-shrink-0 rounded-full px-3 py-1 text-xs font-bold ${upcoming ? "bg-slate-50 text-slate-500" : "bg-amber-50 text-amber-700"}`}>
            {upcoming ? "قادم" : "لم يُصحَّح"}
          </span>
        )}
      </div>

      <div className="mb-4">
        <div className="mb-1 flex justify-between text-xs font-bold text-slate-500">
          <span>{done ? "✓ اكتمل التصحيح" : `صُحّحت ${toEnglishDigits(tested)} من ${toEnglishDigits(studentCount)} ورقة`}</span>
          <span>{toEnglishDigits(item.questionCount)} أسئلة</span>
        </div>
        <div className="h-2 rounded-full bg-slate-100">
          <div className="h-2 rounded-full bg-brand transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {item.studentPdfUrl ? (
          <a
            href={item.studentPdfUrl}
            target="_blank"
            rel="noreferrer"
            onClick={onPrint}
            className="flex flex-col items-center gap-1 rounded-xl border border-slate-200 py-2.5 text-xs font-extrabold text-slate-600 transition hover:border-brand/40 hover:text-brand"
          >
            <FileText className="h-4 w-4" />
            طباعة
          </a>
        ) : (
          <span className="flex flex-col items-center gap-1 rounded-xl border border-slate-100 py-2.5 text-xs font-extrabold text-slate-300">
            <FileText className="h-4 w-4" />
            طباعة
          </span>
        )}
        <button
          onClick={onScan}
          disabled={!studentCount}
          title={studentCount ? undefined : "أضف طلاب الفصل أولًا"}
          className="flex flex-col items-center gap-1 rounded-xl bg-brand py-2.5 text-xs font-extrabold text-white transition hover:bg-brand-dark disabled:opacity-50"
        >
          <Camera className="h-4 w-4" />
          {tested > 0 && !done ? "أكمل التصحيح" : "تصحيح"}
        </button>
        <button
          onClick={onResults}
          disabled={tested === 0}
          className="flex flex-col items-center gap-1 rounded-xl border border-slate-200 py-2.5 text-xs font-extrabold text-slate-600 transition hover:border-brand/40 hover:text-brand disabled:opacity-40"
        >
          <BarChart3 className="h-4 w-4" />
          النتائج
        </button>
      </div>
    </div>
  );
}
