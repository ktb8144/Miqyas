"use client";
import { useRef } from "react";

export interface WorksheetExercise {
  questionNumber: number;
  skill: string;
  question: string;
  options?: string[];
  type: "mcq" | "open" | "fill";
}

export interface WorksheetData {
  studentName?: string;
  unit: string;
  exercises: WorksheetExercise[];
  generatedAt: string;
}

interface WorksheetModalProps {
  worksheet: WorksheetData | null;
  loading: boolean;
  error?: string;
  onClose: () => void;
}

export function WorksheetModal({ worksheet, loading, error, onClose }: WorksheetModalProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const content = printRef.current?.innerHTML;
    if (!content) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8"/>
        <title>ورقة عمل علاجية — مِقياس</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; direction: rtl; padding: 20mm; color: #111; }
          .header { text-align: center; border-bottom: 2px solid #1D9E75; padding-bottom: 12px; margin-bottom: 20px; }
          .header h1 { font-size: 22px; color: #1D9E75; margin-bottom: 4px; }
          .header p { font-size: 13px; color: #555; }
          .meta { display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 13px; }
          .meta span { background: #f3f4f6; padding: 4px 10px; border-radius: 6px; }
          .exercise { margin-bottom: 22px; }
          .exercise-header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
          .q-num { width: 26px; height: 26px; border-radius: 50%; background: #1D9E75; color: white; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; flex-shrink: 0; }
          .skill-tag { font-size: 11px; background: #e0f2fe; color: #0369a1; padding: 2px 8px; border-radius: 10px; }
          .question { font-size: 14px; font-weight: 600; margin-bottom: 8px; padding-right: 34px; }
          .options { padding-right: 34px; }
          .option { display: flex; align-items: center; gap: 8px; margin-bottom: 5px; font-size: 13px; }
          .option-circle { width: 18px; height: 18px; border-radius: 50%; border: 1.5px solid #888; flex-shrink: 0; }
          .answer-line { border-bottom: 1px solid #aaa; height: 24px; margin-top: 8px; padding-right: 34px; margin-left: 60px; }
          @media print { body { padding: 15mm; } }
        </style>
      </head>
      <body>
        ${content}
      </body>
      </html>
    `);
    win.document.close();
    win.focus();
    win.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col" dir="rtl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h3 className="font-bold text-gray-900 text-lg">ورقة عمل علاجية</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500">
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5">
          {loading && (
            <div className="py-16 text-center">
              <div className="relative w-16 h-16 mx-auto mb-4">
                <div className="w-16 h-16 rounded-full border-4 border-gray-200" />
                <div className="absolute top-0 left-0 w-16 h-16 rounded-full border-4 border-t-transparent animate-spin" style={{ borderColor: "#7F77DD", borderTopColor: "transparent" }} />
              </div>
              <p className="text-gray-600 font-medium">جارٍ توليد ورقة العمل...</p>
              <p className="text-gray-400 text-sm mt-1">الذكاء الاصطناعي يُعِد تمارين مخصصة</p>
            </div>
          )}

          {error && !loading && (
            <div className="py-8 text-center">
              <div className="text-4xl mb-3">⚠️</div>
              <p className="text-red-600 font-medium">{error}</p>
            </div>
          )}

          {worksheet && !loading && (
            <div ref={printRef}>
              {/* Print header */}
              <div className="header text-center border-b-2 pb-4 mb-5" style={{ borderColor: "#1D9E75" }}>
                <h1 className="text-xl font-bold mb-1" style={{ color: "#1D9E75" }}>
                  ورقة عمل علاجية — مِقياس
                </h1>
                <p className="text-sm text-gray-500">
                  {worksheet.unit}
                  {worksheet.studentName ? ` — ${worksheet.studentName}` : " — فصل كامل"}
                </p>
              </div>

              <div className="meta flex justify-between text-xs text-gray-500 mb-5">
                <span className="bg-gray-100 px-3 py-1 rounded-lg">
                  {worksheet.exercises.length} تمرين
                </span>
                <span className="bg-gray-100 px-3 py-1 rounded-lg">
                  {worksheet.generatedAt}
                </span>
              </div>

              <div className="space-y-6">
                {worksheet.exercises.map((ex) => (
                  <div key={ex.questionNumber} className="exercise">
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className="w-7 h-7 rounded-full text-white text-xs font-bold flex items-center justify-center flex-shrink-0"
                        style={{ background: "#1D9E75" }}
                      >
                        {ex.questionNumber}
                      </span>
                      <span
                        className="text-xs px-2 py-0.5 rounded-full"
                        style={{ background: "#e0f2fe", color: "#0369a1" }}
                      >
                        {ex.skill}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-gray-900 mb-2 pr-9">{ex.question}</p>
                    {ex.type === "mcq" && ex.options && (
                      <div className="pr-9 space-y-1.5">
                        {ex.options.map((opt, i) => (
                          <div key={i} className="flex items-center gap-2 text-sm text-gray-700">
                            <span
                              className="w-5 h-5 rounded-full border-2 flex-shrink-0"
                              style={{ borderColor: "#9ca3af" }}
                            />
                            {opt}
                          </div>
                        ))}
                      </div>
                    )}
                    {(ex.type === "open" || ex.type === "fill") && (
                      <div className="pr-9 mt-2">
                        <div className="border-b border-gray-300 h-8" />
                        <div className="border-b border-gray-300 h-8 mt-1" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {worksheet && !loading && (
          <div className="p-5 border-t border-gray-100 flex gap-3">
            <button
              onClick={handlePrint}
              className="flex-1 py-3 rounded-xl text-white font-bold text-sm hover:opacity-90"
              style={{ background: "#1D9E75" }}
            >
              🖨️ طباعة
            </button>
            <button onClick={onClose} className="px-5 py-3 rounded-xl border border-gray-200 text-gray-600 text-sm hover:bg-gray-50">
              إغلاق
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
