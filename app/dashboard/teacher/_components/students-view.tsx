"use client";

import { LevelBadge } from "@/components/level-badge";
import { StudentImportFlow } from "@/components/student-import-flow";
import { toEnglishDigits } from "@/lib/format";
import { COLORS } from "@/lib/theme";
import type { TeacherDashboardState } from "../_lib/use-teacher-dashboard";
import { StudentProfileLink } from "@/components/student-profile/student-profile-link";

export function StudentsView({ d }: { d: TeacherDashboardState }) {
  const {
    teacherProfile,
    studentSaveError,
    manualSaving,
    showAddStudents,
    setShowAddStudents,
    addStudentMode,
    setAddStudentMode,
    manualNames,
    setManualNames,
    activeClass,
    activeStudents,
    activeClassPlanItem,
    getStudentPackageScore,
    generateReport,
    handleImportSave,
    handleManualSave,
    handleBackToClasses,
  } = d;
  if (!activeClass) return null;

  return (
    <>
      {/* Back button + heading */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleBackToClasses}
          className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-extrabold text-slate-500 transition hover:border-brand/40 hover:text-brand"
        >
          ← فصولي
        </button>
        <h2 className="text-2xl font-black text-brand-navy">{activeClass.name}</h2>
        <span className="text-sm font-bold text-slate-400">{activeClass.subject}</span>
      </div>

      {/* Report / print actions */}
      <div className="rounded-[1.5rem] border border-teal-100 bg-white p-5 shadow-[0_10px_34px_rgba(15,35,55,0.035)]">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="text-sm font-bold text-slate-400 mb-0.5">مهمة هذا الأسبوع</div>
            <div className="font-black text-brand-navy">
              {activeClassPlanItem
                ? `${activeClassPlanItem.plan.assessment_title} — ${activeClassPlanItem.plan.skill}`
                : `${activeClass.name} — ${activeClass.subject || teacherProfile?.subject || "مادة غير محددة"}`}
            </div>
            {activeClassPlanItem && (
              <p className="mt-1 text-xs font-bold text-slate-400">
                الأسبوع {toEnglishDigits(activeClassPlanItem.plan.week_number)} | {toEnglishDigits(activeClassPlanItem.plan.question_count)} أسئلة
              </p>
            )}
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={generateReport}
              disabled={activeStudents.every((s) => s.score === 0)}
              className="flex items-center gap-2 rounded-xl bg-brand-navy px-4 py-2.5 text-sm font-extrabold text-white transition hover:bg-brand-navy-light disabled:opacity-50"
            >
              توليد تقرير الفصل
            </button>
            <button className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-extrabold text-slate-500 transition hover:border-brand/40 hover:text-brand" onClick={() => window.print()}>
              طباعة
            </button>
          </div>
        </div>
      </div>

      {/* Student table */}
      <div className="overflow-hidden rounded-[1.5rem] border border-slate-100 bg-white shadow-[0_10px_34px_rgba(15,35,55,0.035)]">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="font-black text-brand-navy">قائمة الطلاب</h3>
            <p className="mt-0.5 text-sm font-bold text-slate-400">{toEnglishDigits(activeStudents.length)} طالب</p>
          </div>
          {/* Add students button */}
          <button
            onClick={() => { setShowAddStudents(true); setAddStudentMode("choice"); }}
            className="rounded-xl bg-brand px-4 py-2 text-sm font-extrabold text-white transition hover:bg-brand-dark"
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
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">رقم الطالب</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">اسم الطالب</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">آخر درجة</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">المستوى</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">إجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {activeStudents.map((s, i) => {
                  const packageScore = activeClass ? getStudentPackageScore(activeClass.id, s.id) : null;
                  return (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-400 text-sm">{toEnglishDigits(i + 1)}</td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-black text-brand">
                          رقم الطالب: {toEnglishDigits(s.studentCode ?? i + 1)}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900"><StudentProfileLink studentId={s.id} name={s.name} /></td>
                      <td className="px-4 py-3">
                        {packageScore ? (
                          <div>
                            <span className="font-bold text-gray-900">{toEnglishDigits(packageScore.score)}</span>
                            <span className="text-gray-400">/{toEnglishDigits(packageScore.total)}</span>
                            <span className="mr-2 text-xs font-bold text-slate-400">({toEnglishDigits(packageScore.percentage)}٪)</span>
                          </div>
                        ) : (
                          <span className="text-gray-300 text-sm">لم يقيم بعد</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {packageScore ? (
                          packageScore.level
                            ? <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-black text-brand">{packageScore.level}</span>
                            : <LevelBadge score={packageScore.score} total={packageScore.total} />
                        ) : <span className="text-gray-300 text-sm">—</span>}
                      </td>
                      <td className="px-4 py-3 text-xs font-bold text-slate-300">—</td>
                    </tr>
                  );
                })}
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
                style={{ borderColor: COLORS.accent, color: COLORS.accent }}
              >
                📷 تصوير كشف الأسماء
              </button>
              <button
                onClick={() => setAddStudentMode("manual")}
                className="flex-1 py-4 rounded-xl border-2 font-bold text-sm hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                style={{ borderColor: COLORS.brand, color: COLORS.brand }}
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
              {studentSaveError && (
                <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                  {studentSaveError}
                </div>
              )}
              <p className="text-sm text-gray-600">أدخل اسماً في كل سطر:</p>
              <textarea
                value={manualNames}
                onChange={(e) => setManualNames(e.target.value)}
                rows={6}
                placeholder={"اسم الطالب الأول\nاسم الطالب الثاني\nاسم الطالب الثالث"}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 resize-y"
                style={{ direction: "rtl" }}
              />
              <div className="flex gap-3">
                <button
                  onClick={handleManualSave}
                  disabled={!manualNames.trim() || manualSaving}
                  className="px-5 py-2.5 rounded-lg text-white text-sm font-bold hover:opacity-90 disabled:opacity-50"
                  style={{ background: COLORS.brand }}
                >
                  {manualSaving ? "جارٍ الحفظ..." : "حفظ"}
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

    </>
  );
}
