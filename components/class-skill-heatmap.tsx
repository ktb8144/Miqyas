"use client";

interface HeatmapResult {
  paperId: string;
  editedName: string;
  answers: Record<string, string>;
  error: boolean;
}

interface ClassSkillHeatmapProps {
  results: HeatmapResult[];
  answerKey: Record<string, string>;
  subSkills: Record<string, string>;
  onGenerateClassWorksheet: (weakSkills: string[]) => void;
}

export function ClassSkillHeatmap({
  results,
  answerKey,
  subSkills,
  onGenerateClassWorksheet,
}: ClassSkillHeatmapProps) {
  const validResults = results.filter((r) => !r.error);
  const questionKeys = Object.keys(subSkills).sort((a, b) => {
    const numA = parseInt(a.replace("q", ""));
    const numB = parseInt(b.replace("q", ""));
    return numA - numB;
  });

  if (validResults.length === 0) return null;

  // Calculate failure rate per skill
  const failRates: Record<string, number> = {};
  questionKeys.forEach((q) => {
    const failed = validResults.filter((r) => r.answers[q] !== answerKey[q]).length;
    failRates[q] = (failed / validResults.length) * 100;
  });

  const weakSkills = questionKeys.filter((q) => failRates[q] > 50);
  const weakestQ = questionKeys.reduce((a, b) => (failRates[a] > failRates[b] ? a : b));
  const strongestQ = questionKeys.reduce((a, b) => (failRates[a] < failRates[b] ? a : b));

  return (
    <div className="mt-5" dir="rtl">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-bold text-gray-900">خريطة مهارات الفصل</h4>
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm inline-block" style={{ background: "#dcfce7" }} />
            صحيح
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm inline-block" style={{ background: "#fef2f2" }} />
            خطأ
          </span>
        </div>
      </div>

      {/* Alert: class-wide weak skill */}
      {weakSkills.length > 0 && (
        <div className="mb-4 p-3 rounded-xl text-sm flex items-start gap-2" style={{ background: "#fef3c7", border: "1px solid #fcd34d", color: "#92400e" }}>
          <span className="flex-shrink-0">⚠️</span>
          <div className="flex-1">
            <span className="font-bold">أكثر من نصف الفصل يعاني في: </span>
            {weakSkills.map((q) => subSkills[q]).join("، ")}
          </div>
          <button
            onClick={() => onGenerateClassWorksheet(weakSkills.map((q) => subSkills[q]))}
            className="flex-shrink-0 px-3 py-1.5 rounded-lg text-white text-xs font-bold hover:opacity-90"
            style={{ background: "#BA7517" }}
          >
            ورقة عمل للفصل
          </button>
        </div>
      )}

      {/* Heatmap grid */}
      <div className="rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-right px-3 py-2 font-medium text-gray-600 whitespace-nowrap min-w-[120px]">
                الطالب
              </th>
              {questionKeys.map((q) => (
                <th key={q} className="px-1.5 py-2 font-medium text-gray-600 text-center whitespace-nowrap min-w-[90px]">
                  <div>{subSkills[q]}</div>
                  <div className="text-gray-400 font-normal">({Math.round(failRates[q])}% خطأ)</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {validResults.map((r) => (
              <tr key={r.paperId} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-medium text-gray-800 whitespace-nowrap">
                  {r.editedName || "—"}
                </td>
                {questionKeys.map((q) => {
                  const correct = r.answers[q] === answerKey[q];
                  return (
                    <td key={q} className="px-1.5 py-2 text-center">
                      <span
                        className="inline-flex items-center justify-center w-7 h-7 rounded-md text-xs font-bold"
                        style={
                          correct
                            ? { background: "#dcfce7", color: "#15803d" }
                            : { background: "#fef2f2", color: "#b91c1c" }
                        }
                      >
                        {correct ? "✓" : "✗"}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
          {/* Summary row */}
          <tfoot>
            <tr className="border-t border-gray-200 bg-gray-50">
              <td className="px-3 py-2 text-xs font-bold text-gray-600">نسبة الخطأ</td>
              {questionKeys.map((q) => (
                <td key={q} className="px-1.5 py-2 text-center">
                  <span
                    className="text-xs font-bold"
                    style={{ color: failRates[q] > 50 ? "#b91c1c" : failRates[q] > 30 ? "#92400e" : "#15803d" }}
                  >
                    {Math.round(failRates[q])}%
                  </span>
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Summary */}
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="p-3 rounded-xl text-sm" style={{ background: "#dcfce7", border: "1px solid #86efac" }}>
          <div className="text-xs text-green-600 mb-0.5">الأقوى</div>
          <div className="font-bold text-green-800">{subSkills[strongestQ]}</div>
          <div className="text-xs text-green-600">{Math.round(100 - failRates[strongestQ])}% صحيح</div>
        </div>
        <div className="p-3 rounded-xl text-sm" style={{ background: "#fef2f2", border: "1px solid #fca5a5" }}>
          <div className="text-xs text-red-600 mb-0.5">الأضعف</div>
          <div className="font-bold text-red-800">{subSkills[weakestQ]}</div>
          <div className="text-xs text-red-600">{Math.round(failRates[weakestQ])}% خطأ</div>
        </div>
      </div>
    </div>
  );
}
