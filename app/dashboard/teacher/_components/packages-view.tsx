"use client";

import { toEnglishDigits } from "@/lib/format";
import { assignmentStatusLabel, packageTypeLabel } from "@/lib/labels";
import type { TeacherDashboardState } from "../_lib/use-teacher-dashboard";

export function PackagesView({ d }: { d: TeacherDashboardState }) {
  const {
    setView,
    classStudents,
    packages,
    packageAssignments,
    packagesLoading,
    packagesError,
    selectedPackageClasses,
    setSelectedPackageClasses,
    applyingPackageId,
    packageSuccess,
    setActivePackageAssignment,
    packageDateLabel,
    loadPackageWorkflow,
    handleApplyPackage,
    openPackageResults,
    markPackagePrinted,
  } = d;
  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-extrabold text-brand">التصحيح والنتائج</p>
          <h2 className="mt-1 text-2xl font-black tracking-normal text-brand-navy">مسار واحد لاعتماد نتائج دالا</h2>
          <p className="mt-2 text-sm font-bold text-slate-400">طبّق الحزمة على الفصل، ثم صحّح بالكاميرا أو اعرض تقرير الفصل.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={loadPackageWorkflow}
            disabled={packagesLoading}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-extrabold text-slate-500 transition hover:border-brand/40 hover:text-brand disabled:opacity-50"
          >
            {packagesLoading ? "جارٍ التحديث..." : "تحديث"}
          </button>
          <button
            onClick={() => setView("classes")}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-extrabold text-slate-500 transition hover:border-brand/40 hover:text-brand"
          >
            ← العودة
          </button>
        </div>
      </div>

      {packagesError && (
        <div className="rounded-[1.25rem] border border-red-100 bg-red-50 p-4 text-sm font-bold text-red-700">
          {packagesError}
        </div>
      )}

      {packageSuccess && (
        <div className="rounded-[1.25rem] border border-teal-100 bg-teal-50 p-4 text-sm font-bold text-brand">
          {packageSuccess}
        </div>
      )}

      <div className="rounded-[1.5rem] border border-slate-100 bg-white p-5 shadow-[0_10px_34px_rgba(15,35,55,0.035)]">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-xl font-black text-brand-navy">الاختبارات المتاحة</h3>
            <p className="mt-1 text-sm font-bold text-slate-400">اختبارات منشورة من إدارة دالا ومفعّلة لمدرستك.</p>
          </div>
          <span className="rounded-full bg-slate-50 px-3 py-1 text-sm font-bold text-slate-500">
            {toEnglishDigits(packages.length)} اختبار
          </span>
        </div>

        {packagesLoading ? (
          <div className="rounded-[1.25rem] border border-dashed border-teal-100 bg-teal-50/40 p-8 text-center font-bold text-slate-500">
            جارٍ تحميل حزم دالا...
          </div>
        ) : packages.length ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {packages.map((item) => {
              const selectedClassId = selectedPackageClasses[item.id] ?? item.matchingClasses[0]?.id ?? "";
              const hasMatchingClass = item.matchingClasses.length > 0;
              return (
                <div key={item.id} className="rounded-[1.25rem] border border-slate-100 bg-slate-50/40 p-5">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-extrabold text-brand">
                        {packageTypeLabel(item.package_type)} | الأسبوع {toEnglishDigits(item.week_number ?? "—")}
                      </div>
                      <h4 className="mt-1 text-lg font-black text-brand-navy">{item.title}</h4>
                      <p className="mt-1 text-sm font-bold text-slate-400">
                        {item.subject} | الصف {toEnglishDigits(item.grade)} | {packageDateLabel(item)}
                      </p>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-500">
                      {toEnglishDigits(item.question_count)} سؤال
                    </span>
                  </div>

                  <div className="mb-4 flex flex-wrap gap-2">
                    {[
                      { label: "تحميل ملف الأسئلة PDF", url: item.questions_pdf_url ?? item.student_pdf_url },
                      ...(item.answer_sheet_pdf_url ? [{ label: "تحميل ورقة الإجابة", url: item.answer_sheet_pdf_url }] : []),
                    ].map((link) => (
                      link.url ? (
                        <a
                          key={link.label}
                          href={link.url}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-extrabold text-slate-500 transition hover:border-brand/40 hover:text-brand"
                        >
                          {link.label}
                        </a>
                      ) : (
                        <button
                          key={link.label}
                          disabled
                          className="rounded-xl border border-slate-100 bg-white px-3 py-2 text-xs font-extrabold text-slate-300"
                        >
                          {link.label}
                        </button>
                      )
                    ))}
                  </div>

                  {hasMatchingClass ? (
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <select
                        value={selectedClassId}
                        onChange={(event) => setSelectedPackageClasses((prev) => ({ ...prev, [item.id]: event.target.value }))}
                        className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-brand-navy outline-none focus:border-brand"
                      >
                        {item.matchingClasses.map((classItem) => (
                          <option key={classItem.id} value={classItem.id}>{classItem.name}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => handleApplyPackage(item)}
                        disabled={!selectedClassId || applyingPackageId === item.id}
                        className="rounded-xl bg-brand px-4 py-2 text-sm font-extrabold text-white transition hover:bg-brand-dark disabled:opacity-50"
                      >
                        {applyingPackageId === item.id ? "جارٍ التطبيق..." : "تطبيق على فصل"}
                      </button>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-700">
                      أضف فصلًا مطابقًا للصف والمادة لتطبيق هذا الاختبار.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-[1.25rem] border border-dashed border-teal-100 bg-teal-50/40 p-8 text-center">
            <h3 className="text-xl font-black text-brand-navy">لا توجد اختبارات منشورة حاليًا من إدارة دالا.</h3>
            <p className="mt-2 text-sm font-bold text-slate-400">ستظهر هنا الحزم الأسبوعية عند نشرها وتفعيلها لمدرستك.</p>
          </div>
        )}
      </div>

      <div className="rounded-[1.5rem] border border-slate-100 bg-white p-5 shadow-[0_10px_34px_rgba(15,35,55,0.035)]">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-xl font-black text-brand-navy">اختبارات فصولي</h3>
            <p className="mt-1 text-sm font-bold text-slate-400">الحزم التي تم تطبيقها على فصولك.</p>
          </div>
          <span className="rounded-full bg-slate-50 px-3 py-1 text-sm font-bold text-slate-500">
            {toEnglishDigits(packageAssignments.length)} تعيين
          </span>
        </div>

        {packagesLoading ? (
          <div className="rounded-[1.25rem] border border-dashed border-teal-100 bg-teal-50/40 p-8 text-center font-bold text-slate-500">
            جارٍ تحميل اختبارات الفصول...
          </div>
        ) : packageAssignments.length ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {packageAssignments.map((item) => {
              const studentCount = classStudents[item.classId]?.length ?? 0;
              return (
                <div key={item.id} className="rounded-[1.25rem] border border-slate-100 bg-slate-50/40 p-5">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-extrabold text-brand">
                        {item.className} | الأسبوع {toEnglishDigits(item.weekNumber ?? "—")}
                      </div>
                      <h4 className="mt-1 text-lg font-black text-brand-navy">{item.packageTitle}</h4>
                      <p className="mt-1 text-sm font-bold text-slate-400">
                        {item.subject} | الصف {toEnglishDigits(item.grade ?? "—")} | {packageDateLabel(item)}
                      </p>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-brand">
                      {assignmentStatusLabel(item.status)}
                    </span>
                  </div>

                  <div className="mb-4 flex flex-wrap gap-2">
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-500">
                      {toEnglishDigits(item.questionCount)} سؤال
                    </span>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-500">
                      {toEnglishDigits(studentCount)} طالب
                    </span>
                  </div>

                  <div className="mb-4 flex flex-wrap gap-2">
                    {[
                      { label: "تحميل ملف الأسئلة PDF", url: item.studentPdfUrl },
                      ...(item.answerSheetPdfUrl ? [{ label: "تحميل ورقة الإجابة", url: item.answerSheetPdfUrl }] : []),
                    ].map((link) => (
                      link.url ? (
                        <a
                          key={link.label}
                          href={link.url}
                          target="_blank"
                          rel="noreferrer"
                          onClick={() => void markPackagePrinted(item.id)}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-extrabold text-slate-500 transition hover:border-brand/40 hover:text-brand"
                        >
                          {link.label}
                        </a>
                      ) : (
                        <button
                          key={link.label}
                          disabled
                          className="rounded-xl border border-slate-100 bg-white px-3 py-2 text-xs font-extrabold text-slate-300"
                        >
                          {link.label}
                        </button>
                      )
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={() => setActivePackageAssignment(item)}
                      disabled={!studentCount}
                      className="rounded-xl bg-brand-navy px-4 py-2 text-sm font-extrabold text-white transition hover:bg-brand-navy-light disabled:opacity-50"
                    >
                      تصحيح بالكاميرا
                    </button>
                    <button
                      disabled
                      title="سيتوفر الإدخال اليدوي المنظم داخل هذا المسار لاحقًا"
                      className="rounded-xl border border-slate-100 bg-white px-4 py-2 text-sm font-extrabold text-slate-300"
                    >
                      إدخال يدوي
                    </button>
                    <button
                      onClick={() => void openPackageResults(item)}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-extrabold text-slate-500 transition hover:border-brand/40 hover:text-brand"
                    >
                      عرض تقرير الفصل
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-[1.25rem] border border-dashed border-teal-100 bg-teal-50/40 p-8 text-center">
            <h3 className="text-xl font-black text-brand-navy">لم يتم تطبيق أي اختبار على فصولك بعد.</h3>
            <p className="mt-2 text-sm font-bold text-slate-400">اختر اختبارًا منشورًا ثم طبّقه على فصل مطابق للبدء.</p>
          </div>
        )}
      </div>
    </section>
  );
}
