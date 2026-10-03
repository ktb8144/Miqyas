"use client";

import { COLORS } from "@/lib/theme";
import type { ClassReport } from "../_lib/types";

export function ReportModal({
  report, loading, error, onClose,
}: {
  report: ClassReport | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" dir="rtl">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 p-5 flex items-center justify-between rounded-t-2xl">
          <h2 className="font-bold text-gray-900 text-lg">تقرير الفصل — الذكاء الاصطناعي</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>
        <div className="p-6">
          {loading && (
            <div className="text-center py-12">
              <div className="relative w-16 h-16 mx-auto mb-4">
                <div className="w-16 h-16 rounded-full border-4 border-gray-200" />
                <div className="absolute top-0 left-0 w-16 h-16 rounded-full border-4 border-t-transparent animate-spin" style={{ borderColor: COLORS.brand, borderTopColor: "transparent" }} />
              </div>
              <p className="text-gray-600 font-medium">الذكاء الاصطناعي يحلل نتائج الفصل...</p>
              <p className="text-gray-400 text-sm mt-1">قد يستغرق ذلك بضع ثوانٍ</p>
            </div>
          )}
          {error && !loading && (
            <div className="rounded-xl p-4 text-center" style={{ background: "#fff5f5", border: "1px solid #fecaca" }}>
              <p className="text-red-700 font-medium mb-1">⚠️ تعذّر توليد التقرير</p>
              <p className="text-red-500 text-sm">{error}</p>
            </div>
          )}
          {report && !loading && (
            <div className="space-y-5">
              {[
                { label: "الملخص", icon: "📋", content: report.summary, color: COLORS.brand, bg: "#f0fdf8" },
                { label: "نقاط القوة", icon: "💪", content: report.strengths, color: COLORS.accent, bg: "#f5f3ff" },
                { label: "نقاط التحسين", icon: "📌", content: report.weaknesses, color: COLORS.warning, bg: "#fffbeb" },
                { label: "خطة التدخل", icon: "🎯", content: report.interventionPlan, color: COLORS.danger, bg: "#fff5f5" },
                { label: "توصيات للمعلم", icon: "💡", content: report.recommendations, color: COLORS.brand, bg: "#f0fdf8" },
              ].map((s) => (
                <div key={s.label} className="rounded-xl p-4" style={{ background: s.bg, border: `1px solid ${s.color}30` }}>
                  <div className="flex items-center gap-2 mb-2">
                    <span>{s.icon}</span>
                    <span className="font-bold text-sm" style={{ color: s.color }}>{s.label}</span>
                  </div>
                  <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-line">{s.content}</p>
                </div>
              ))}
              <div className="flex gap-3 pt-2">
                <button className="flex-1 py-2.5 rounded-xl text-white font-bold text-sm" style={{ background: COLORS.brand }} onClick={() => window.print()}>
                  🖨️ طباعة التقرير
                </button>
                <button className="flex-1 py-2.5 rounded-xl border-2 font-bold text-sm" style={{ borderColor: COLORS.brand, color: COLORS.brand }} onClick={onClose}>
                  إغلاق
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Add Class Modal ──────────────────────────────────────────────────────────
