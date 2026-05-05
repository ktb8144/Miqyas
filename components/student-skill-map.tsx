"use client";

interface StudentSkillMapProps {
  studentName: string;
  answers: Record<string, string>;
  answerKey: Record<string, string>;
  subSkills: Record<string, string>;
  onGenerateWorksheet: (weakSkills: string[]) => void;
  onClose: () => void;
}

export function StudentSkillMap({
  studentName,
  answers,
  answerKey,
  subSkills,
  onGenerateWorksheet,
  onClose,
}: StudentSkillMapProps) {
  const mastered: string[] = [];
  const needsWork: string[] = [];

  Object.entries(subSkills).forEach(([q, skill]) => {
    if (answers[q] && answers[q] === answerKey[q]) {
      mastered.push(skill);
    } else {
      needsWork.push(skill);
    }
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col" dir="rtl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div>
            <h3 className="font-bold text-gray-900 text-lg">تشخيص المهارات</h3>
            <p className="text-sm text-gray-500 mt-0.5">{studentName}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500">
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5 space-y-5">
          {/* Mastered */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#1D9E75" }} />
              <span className="font-bold text-gray-800 text-sm">أتقنها ({mastered.length})</span>
            </div>
            {mastered.length === 0 ? (
              <p className="text-sm text-gray-400 italic">لا توجد مهارات مُتقنة في هذا الاختبار</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {mastered.map((skill) => (
                  <span
                    key={skill}
                    className="px-3 py-1.5 rounded-full text-sm font-medium"
                    style={{ background: "#dcfce7", color: "#15803d", border: "1px solid #86efac" }}
                  >
                    ✓ {skill}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Needs work */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#E24B4A" }} />
              <span className="font-bold text-gray-800 text-sm">يحتاج تعزيز ({needsWork.length})</span>
            </div>
            {needsWork.length === 0 ? (
              <p className="text-sm text-gray-400 italic">أتقن الطالب جميع المهارات!</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {needsWork.map((skill) => (
                  <span
                    key={skill}
                    className="px-3 py-1.5 rounded-full text-sm font-medium"
                    style={{ background: "#fef2f2", color: "#b91c1c", border: "1px solid #fca5a5" }}
                  >
                    ✗ {skill}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-gray-100 flex gap-3">
          {needsWork.length > 0 && (
            <button
              onClick={() => onGenerateWorksheet(needsWork)}
              className="flex-1 py-3 rounded-xl text-white font-bold text-sm hover:opacity-90 transition-all"
              style={{ background: "#7F77DD" }}
            >
              توليد ورقة عمل علاجية
            </button>
          )}
          <button
            onClick={onClose}
            className="px-5 py-3 rounded-xl border border-gray-200 text-gray-600 text-sm hover:bg-gray-50"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}
