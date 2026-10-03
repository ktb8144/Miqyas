"use client";

import { useState } from "react";
import { COLORS } from "@/lib/theme";
import { gradeLabel } from "@/lib/labels";

export function AddClassModal({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (input: { name: string; grade: number; subject: string }) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [grade, setGrade] = useState(3);
  const [subject, setSubject] = useState("رياضيات");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await onAdd({ name: name.trim(), grade, subject });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر إنشاء الفصل");
    } finally {
      setSaving(false);
    }
  };

  const handleGradeChange = (nextGrade: number) => {
    setGrade(nextGrade);
    if (nextGrade === 3 && subject === "علوم") {
      setSubject("رياضيات");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" dir="rtl">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="sticky top-0 bg-white border-b border-gray-100 p-5 flex items-center justify-between rounded-t-2xl">
          <h2 className="font-bold text-gray-900 text-lg">إضافة فصل جديد</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>
        <div className="p-6 space-y-4">
          {error && (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">اسم الفصل</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="الثالث أ"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2"
              style={{ direction: "rtl" }}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">الصف الدراسي</label>
            <select
              value={grade}
              onChange={(e) => handleGradeChange(Number(e.target.value))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2"
              style={{ direction: "rtl" }}
            >
              {[3, 4, 5, 6].map((g) => (
                <option key={g} value={g}>{gradeLabel(g)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">المادة</label>
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2"
              style={{ direction: "rtl" }}
            >
              <option value="رياضيات">رياضيات</option>
              <option value="لغة عربية">لغة عربية</option>
              {grade !== 3 && <option value="علوم">علوم</option>}
            </select>
          </div>
          <button
            onClick={handleCreate}
            disabled={!name.trim() || saving}
            className="w-full py-3 rounded-xl text-white font-bold text-sm disabled:opacity-50 hover:opacity-90"
            style={{ background: COLORS.brand }}
          >
            {saving ? "جارٍ الإنشاء..." : "إنشاء الفصل"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
