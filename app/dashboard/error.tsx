"use client";
import { useEffect } from "react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard error:", error);
  }, [error]);

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-gray-50 px-4"
      dir="rtl"
    >
      <div className="bg-white rounded-2xl shadow-md p-8 max-w-md w-full text-center">
        <div className="text-5xl mb-4">⚠️</div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          حدث خطأ في تحميل الصفحة
        </h2>
        <p className="text-sm text-gray-500 mb-2">{error.message}</p>
        {error.digest && (
          <p className="text-xs text-gray-400 font-mono mb-4">{error.digest}</p>
        )}
        <div className="flex gap-3 justify-center mt-6">
          <button
            onClick={reset}
            className="px-6 py-2.5 rounded-xl text-white font-bold text-sm"
            style={{ background: "#1D9E75" }}
          >
            إعادة المحاولة
          </button>
          <button
            onClick={() => { window.location.href = "/login"; }}
            className="px-6 py-2.5 rounded-xl border border-gray-300 text-gray-700 text-sm"
          >
            العودة لتسجيل الدخول
          </button>
        </div>
      </div>
    </div>
  );
}
