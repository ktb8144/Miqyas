"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";
import { DemoBanner } from "@/components/demo-banner";
import { LevelBadge } from "@/components/level-badge";
import { StudentImportFlow } from "@/components/student-import-flow";
import { BatchOMRScanner } from "@/components/batch-omr-scanner";
import { students as DEMO_STUDENTS, getLevel } from "@/lib/demo-data";
import { supabase } from "@/lib/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Student {
  id: number;
  name: string;
  score: number;
  total: number;
}

interface ClassItem {
  id: string;
  name: string;
  grade: number;
  subject: string;
  teacherId: string;
  schoolId: string;
}

interface ClassReport {
  summary: string;
  strengths: string;
  weaknesses: string;
  interventionPlan: string;
  recommendations: string;
}

// ─── Demo data ────────────────────────────────────────────────────────────────

const DEMO_CLASSES: ClassItem[] = [
  { id: "c1", name: "الثالث أ", grade: 3, subject: "رياضيات", teacherId: "t1", schoolId: "s1" },
  { id: "c2", name: "الثالث ب", grade: 3, subject: "رياضيات", teacherId: "t1", schoolId: "s1" },
];

type ClassStudentsMap = Record<string, Student[]>;

const INITIAL_CLASS_STUDENTS: ClassStudentsMap = {
  c1: DEMO_STUDENTS,
  c2: [],
};

// ─── Report Modal ─────────────────────────────────────────────────────────────

function ReportModal({
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
                <div className="absolute top-0 left-0 w-16 h-16 rounded-full border-4 border-t-transparent animate-spin" style={{ borderColor: "#1D9E75", borderTopColor: "transparent" }} />
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
                { label: "الملخص", icon: "📋", content: report.summary, color: "#1D9E75", bg: "#f0fdf8" },
                { label: "نقاط القوة", icon: "💪", content: report.strengths, color: "#7F77DD", bg: "#f5f3ff" },
                { label: "نقاط التحسين", icon: "📌", content: report.weaknesses, color: "#BA7517", bg: "#fffbeb" },
                { label: "خطة التدخل", icon: "🎯", content: report.interventionPlan, color: "#E24B4A", bg: "#fff5f5" },
                { label: "توصيات للمعلم", icon: "💡", content: report.recommendations, color: "#1D9E75", bg: "#f0fdf8" },
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
                <button className="flex-1 py-2.5 rounded-xl text-white font-bold text-sm" style={{ background: "#1D9E75" }} onClick={() => window.print()}>
                  🖨️ طباعة التقرير
                </button>
                <button className="flex-1 py-2.5 rounded-xl border-2 font-bold text-sm" style={{ borderColor: "#1D9E75", color: "#1D9E75" }} onClick={onClose}>
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

function AddClassModal({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (cls: ClassItem) => void;
}) {
  const [name, setName] = useState("");
  const [grade, setGrade] = useState(1);
  const [subject, setSubject] = useState("رياضيات");
  const [saving, setSaving] = useState(false);

  const gradeLabels: Record<number, string> = {
    1: "الأول", 2: "الثاني", 3: "الثالث",
    4: "الرابع", 5: "الخامس", 6: "السادس",
  };

  const handleCreate = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const newClass: ClassItem = {
      id: `c${Date.now()}`,
      name: name.trim(),
      grade,
      subject,
      teacherId: "t1",
      schoolId: "s1",
    };
    onAdd(newClass);
    setSaving(false);
    onClose();
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
              onChange={(e) => setGrade(Number(e.target.value))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2"
              style={{ direction: "rtl" }}
            >
              {[1, 2, 3, 4, 5, 6].map((g) => (
                <option key={g} value={g}>{gradeLabels[g]}</option>
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
              <option value="عربية">عربية</option>
              <option value="علوم">علوم</option>
              <option value="قرآن">قرآن</option>
            </select>
          </div>
          <button
            onClick={handleCreate}
            disabled={!name.trim() || saving}
            className="w-full py-3 rounded-xl text-white font-bold text-sm disabled:opacity-50 hover:opacity-90"
            style={{ background: "#1D9E75" }}
          >
            {saving ? "جارٍ الإنشاء..." : "إنشاء الفصل"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function TeacherDashboard() {
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) window.location.href = "/login";
    });
  }, []);

  // ── View state ──────────────────────────────────────────────────────────────
  type View = "classes" | "students";
  const [view, setView] = useState<View>("classes");
  const [activeClassId, setActiveClassId] = useState<string | null>(null);

  // ── Classes state ────────────────────────────────────────────────────────────
  const [classes, setClasses] = useState<ClassItem[]>(DEMO_CLASSES);
  const [classStudents, setClassStudents] = useState<ClassStudentsMap>(INITIAL_CLASS_STUDENTS);
  const [showAddClass, setShowAddClass] = useState(false);

  // ── Student add (manual) state ───────────────────────────────────────────────
  const [showAddStudents, setShowAddStudents] = useState(false);
  const [addStudentMode, setAddStudentMode] = useState<"choice" | "import" | "manual">("choice");
  const [manualNames, setManualNames] = useState("");

  // ── Report state ─────────────────────────────────────────────────────────────
  const [reportOpen, setReportOpen] = useState(false);
  const [report, setReport] = useState<ClassReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  // ── Derived values ───────────────────────────────────────────────────────────
  const activeClass = classes.find((c) => c.id === activeClassId) ?? null;
  const activeStudents: Student[] = activeClassId ? (classStudents[activeClassId] ?? []) : [];

  const calcAvg = (students: Student[]) => {
    const scored = students.filter((s) => s.score > 0);
    if (!scored.length) return null;
    return Math.round(scored.reduce((acc, s) => acc + (s.score / s.total) * 100, 0) / scored.length);
  };

  const normalizeStudentName = (name: string) => name.trim().replace(/\s+/g, " ").toLowerCase();

  // ── Report generation ────────────────────────────────────────────────────────
  const generateReport = async () => {
    setReportOpen(true);
    setReport(null);
    setReportError(null);
    setReportLoading(true);
    try {
      const res = await fetch("/api/generate-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacherName: "عبدالله السالم",
          skill: "الكسور",
          grade: "الثالث",
          subject: "الرياضيات",
          results: activeStudents
            .filter((s) => s.score > 0)
            .map((s) => ({ name: s.name, score: s.score, total: s.total, level: getLevel(s.score, s.total) })),
        }),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error);
      setReport(json.report);
    } catch (err) {
      setReportError(err instanceof Error ? err.message : "خطأ غير معروف");
    } finally {
      setReportLoading(false);
    }
  };

  // ── Student handlers ─────────────────────────────────────────────────────────
  const handleImportSave = (names: string[]) => {
    if (!activeClassId) return;
    setClassStudents((prev) => {
      const existing = prev[activeClassId] ?? [];
      const existingByName = new Map(existing.map((student) => [normalizeStudentName(student.name), student]));
      const nextStudents: Student[] = names
        .map((name) => name.trim().replace(/\s+/g, " "))
        .filter(Boolean)
        .map((name, index) => {
          const existingStudent = existingByName.get(normalizeStudentName(name));
          return existingStudent ?? { id: Date.now() + index, name, score: 0, total: 10 };
        });

      return { ...prev, [activeClassId]: nextStudents };
    });
    setShowAddStudents(false);
    setAddStudentMode("choice");
  };

  const handleManualSave = () => {
    if (!activeClassId) return;
    const names = manualNames
      .split("\n")
      .map((n) => n.trim())
      .filter((n) => n.length > 0);
    if (!names.length) return;
    setClassStudents((prev) => {
      const existing = prev[activeClassId] ?? [];
      const startId = existing.length + 1;
      return {
        ...prev,
        [activeClassId]: [
          ...existing,
          ...names.map((name, i) => ({ id: startId + i, name, score: 0, total: 10 })),
        ],
      };
    });
    setManualNames("");
    setShowAddStudents(false);
    setAddStudentMode("choice");
  };

  const handleScanComplete = (results: { editedName: string; studentName: string; score: number }[]) => {
    if (!activeClassId) return;
    setClassStudents((prev) => {
      const updated = [...(prev[activeClassId] ?? [])];
      results.forEach((r, i) => {
        const name = r.editedName || r.studentName;
        const match = updated.find((s) => s.name === name) ?? updated[i];
        if (match) {
          match.score = r.score;
        }
      });
      return { ...prev, [activeClassId]: [...updated] };
    });
  };

  const handleAddClass = (cls: ClassItem) => {
    setClasses((prev) => [...prev, cls]);
    setClassStudents((prev) => ({ ...prev, [cls.id]: [] }));
  };

  const handleViewStudents = (classId: string) => {
    setActiveClassId(classId);
    setView("students");
    setShowAddStudents(false);
    setAddStudentMode("choice");
  };

  const handleBackToClasses = () => {
    setView("classes");
    setActiveClassId(null);
    setShowAddStudents(false);
    setAddStudentMode("choice");
    setManualNames("");
  };

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#f7fafc] text-[#0b2447]" dir="rtl">
      <DemoBanner />

      {reportOpen && (
        <ReportModal report={report} loading={reportLoading} error={reportError} onClose={() => setReportOpen(false)} />
      )}

      {showAddClass && (
        <AddClassModal
          onClose={() => setShowAddClass(false)}
          onAdd={handleAddClass}
        />
      )}

      {/* ── Header ─────────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 lg:px-8">
          <BrandLogo
            size="sm"
            contextTitle="لوحة المعلم"
            contextSubtitle="عبدالله السالم — الثالث رياضيات"
          />
          <button
            onClick={async () => { await supabase.auth.signOut(); router.push("/login"); }}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-extrabold text-slate-500 transition hover:border-[#159f91]/40 hover:text-[#159f91]"
          >
            خروج
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-8 px-5 py-8 lg:px-8">

        {/* ══════════════════════════════════════════════════════════════════════
            VIEW: CLASSES LIST
        ══════════════════════════════════════════════════════════════════════ */}
        {view === "classes" && (
          <>
            {/* ── SECTION 1: هذا الأسبوع ──────────────────────────────────────── */}
            <section>
              <div className="mb-4">
                <p className="text-sm font-extrabold text-[#159f91]">هذا الأسبوع</p>
                <h2 className="mt-2 text-2xl font-black tracking-normal text-[#0b2447]">مهمة التقييم الحالية</h2>
              </div>
              <div className="rounded-[1.5rem] border border-teal-100 bg-white p-6 shadow-[0_10px_34px_rgba(15,35,55,0.035)]">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <div className="text-sm font-bold text-slate-400 mb-1">مهمة هذا الأسبوع</div>
                    <h3 className="text-3xl font-black text-[#0b2447]">الكسور</h3>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="rounded-full bg-slate-50 px-3 py-1 text-sm font-bold text-slate-500">الثالث ابتدائي</span>
                      <span className="rounded-full bg-teal-50 px-3 py-1 text-sm font-bold text-[#159f91]">الرياضيات</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="rounded-full border border-emerald-100 bg-emerald-50 px-4 py-2 text-sm font-extrabold text-emerald-700">
                      مكتمل
                    </span>
                    <button
                      onClick={generateReport}
                      className="flex items-center gap-2 rounded-xl bg-[#0b2447] px-4 py-2.5 text-sm font-extrabold text-white transition hover:bg-[#12345f]"
                    >
                      توليد تقرير الفصل
                    </button>
                    <button className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-extrabold text-slate-500 transition hover:border-[#159f91]/40 hover:text-[#159f91]" onClick={() => window.print()}>
                      طباعة
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {/* ── SECTION 2: فصولي ──────────────────────────────────────────────── */}
            <section>
              <h2 className="mb-4 text-2xl font-black tracking-normal text-[#0b2447]">فصولي</h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {classes.map((cls) => {
                  const students = classStudents[cls.id] ?? [];
                  const avg = calcAvg(students);
                  return (
                    <div
                      key={cls.id}
                      className="flex flex-col gap-5 rounded-[1.5rem] border border-slate-100 bg-white p-6 shadow-[0_10px_34px_rgba(15,35,55,0.035)]"
                    >
                      {/* Class header */}
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="text-xl font-black text-[#0b2447]">{cls.name}</div>
                          <div className="mt-1 text-sm font-bold text-slate-400">{cls.subject}</div>
                        </div>
                        <button
                          title="إعدادات الفصل"
                          className="rounded-xl p-2 text-slate-300 transition hover:bg-slate-50 hover:text-[#159f91]"
                        >
                          ⚙️
                        </button>
                      </div>

                      {/* Stats */}
                      <div className="flex items-center gap-4">
                        <div className="text-center">
                          <div className="text-2xl font-black text-[#0b2447]">{students.length}</div>
                          <div className="text-xs font-bold text-slate-400">طالب</div>
                        </div>
                        <div className="h-10 w-px bg-slate-100" />
                        <div className="text-center">
                          {avg !== null ? (
                            <>
                              <div className="text-2xl font-bold" style={{ color: avg >= 70 ? "#1D9E75" : avg >= 50 ? "#BA7517" : "#E24B4A" }}>
                                {avg}٪
                              </div>
                              <div className="text-xs font-bold text-slate-400">متوسط هذا الأسبوع</div>
                            </>
                          ) : (
                            <>
                              <div className="text-2xl font-black text-slate-300">—</div>
                              <div className="text-xs font-bold text-slate-400">لا توجد درجات</div>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <button
                        onClick={() => handleViewStudents(cls.id)}
                        className="w-full rounded-xl bg-[#159f91] py-3 text-sm font-extrabold text-white shadow-[0_10px_24px_rgba(21,159,145,0.12)] transition hover:bg-[#10877b]"
                      >
                        عرض الطلاب
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Add class button */}
              <button
                onClick={() => setShowAddClass(true)}
                className="mt-5 w-full rounded-[1.25rem] border border-dashed border-[#159f91]/40 bg-white py-4 text-sm font-extrabold text-[#159f91] transition hover:bg-teal-50/50"
              >
                + إضافة فصل جديد
              </button>
            </section>
          </>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            VIEW: STUDENT LIST
        ══════════════════════════════════════════════════════════════════════ */}
        {view === "students" && activeClass && (
          <>
            {/* Back button + heading */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleBackToClasses}
                className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-extrabold text-slate-500 transition hover:border-[#159f91]/40 hover:text-[#159f91]"
              >
                ← فصولي
              </button>
              <h2 className="text-2xl font-black text-[#0b2447]">{activeClass.name}</h2>
              <span className="text-sm font-bold text-slate-400">{activeClass.subject}</span>
            </div>

            {/* Report / print actions */}
            <div className="rounded-[1.5rem] border border-teal-100 bg-white p-5 shadow-[0_10px_34px_rgba(15,35,55,0.035)]">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <div className="text-sm font-bold text-slate-400 mb-0.5">مهمة هذا الأسبوع</div>
                  <div className="font-black text-[#0b2447]">الكسور — الرياضيات</div>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <button
                    onClick={generateReport}
                    disabled={activeStudents.every((s) => s.score === 0)}
                    className="flex items-center gap-2 rounded-xl bg-[#0b2447] px-4 py-2.5 text-sm font-extrabold text-white transition hover:bg-[#12345f] disabled:opacity-50"
                  >
                    توليد تقرير الفصل
                  </button>
                  <button className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-extrabold text-slate-500 transition hover:border-[#159f91]/40 hover:text-[#159f91]" onClick={() => window.print()}>
                    طباعة
                  </button>
                </div>
              </div>
            </div>

            {/* Student table */}
            <div className="overflow-hidden rounded-[1.5rem] border border-slate-100 bg-white shadow-[0_10px_34px_rgba(15,35,55,0.035)]">
              <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h3 className="font-black text-[#0b2447]">قائمة الطلاب</h3>
                  <p className="mt-0.5 text-sm font-bold text-slate-400">{activeStudents.length} طالب</p>
                </div>
                {/* Add students button */}
                <button
                  onClick={() => { setShowAddStudents(true); setAddStudentMode("choice"); }}
                  className="rounded-xl bg-[#159f91] px-4 py-2 text-sm font-extrabold text-white transition hover:bg-[#10877b]"
                >
                  + إضافة طلاب
                </button>
              </div>

              {activeStudents.length === 0 ? (
                <div className="py-12 text-center text-gray-400">
                  <div className="text-4xl mb-3">👥</div>
                  <p className="font-medium">لا يوجد طلاب بعد — أضف طلاباً</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">#</th>
                        <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">اسم الطالب</th>
                        <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">آخر درجة</th>
                        <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">المستوى</th>
                        <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">إجراء</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {activeStudents.map((s, i) => (
                        <tr key={s.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-gray-400 text-sm">{i + 1}</td>
                          <td className="px-4 py-3 font-medium text-gray-900">{s.name}</td>
                          <td className="px-4 py-3">
                            {s.score > 0 ? (
                              <><span className="font-bold text-gray-900">{s.score}</span><span className="text-gray-400">/{s.total}</span></>
                            ) : (
                              <span className="text-gray-300 text-sm">لم يُقيَّم بعد</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {s.score > 0 ? <LevelBadge score={s.score} total={s.total} /> : <span className="text-gray-300 text-sm">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-gray-300 text-sm">—</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Add students panel */}
            {showAddStudents && (
              <div className="rounded-[1.5rem] border border-slate-100 bg-white p-5 shadow-[0_10px_34px_rgba(15,35,55,0.035)]">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-gray-900">إضافة طلاب</h3>
                  <button onClick={() => { setShowAddStudents(false); setAddStudentMode("choice"); setManualNames(""); }} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
                </div>

                {addStudentMode === "choice" && (
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={() => setAddStudentMode("import")}
                      className="flex-1 py-4 rounded-xl border-2 font-bold text-sm hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                      style={{ borderColor: "#7F77DD", color: "#7F77DD" }}
                    >
                      📷 تصوير كشف الأسماء
                    </button>
                    <button
                      onClick={() => setAddStudentMode("manual")}
                      className="flex-1 py-4 rounded-xl border-2 font-bold text-sm hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                      style={{ borderColor: "#1D9E75", color: "#1D9E75" }}
                    >
                      ✏️ إضافة يدوي
                    </button>
                  </div>
                )}

                {addStudentMode === "import" && (
                  <StudentImportFlow
                    initialNames={activeStudents.map((student) => student.name)}
                    onSave={handleImportSave}
                  />
                )}

                {addStudentMode === "manual" && (
                  <div className="space-y-3">
                    <p className="text-sm text-gray-600">أدخل اسماً في كل سطر:</p>
                    <textarea
                      value={manualNames}
                      onChange={(e) => setManualNames(e.target.value)}
                      rows={6}
                      placeholder={"أحمد محمد السلمي\nعبدالرحمن خالد\nسلطان فهد العنزي"}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 resize-y"
                      style={{ direction: "rtl" }}
                    />
                    <div className="flex gap-3">
                      <button
                        onClick={handleManualSave}
                        disabled={!manualNames.trim()}
                        className="px-5 py-2.5 rounded-lg text-white text-sm font-bold hover:opacity-90 disabled:opacity-50"
                        style={{ background: "#1D9E75" }}
                      >
                        حفظ
                      </button>
                      <button
                        onClick={() => setAddStudentMode("choice")}
                        className="px-5 py-2.5 rounded-lg border text-gray-600 text-sm font-medium hover:bg-gray-50"
                      >
                        رجوع
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Batch OMR Scanner */}
            <BatchOMRScanner
              totalStudents={activeStudents.length}
              subject={activeClass.subject}
              grade={activeClass.grade}
              weekNumber={5}
              onComplete={handleScanComplete}
            />
          </>
        )}
      </main>
    </div>
  );
}
