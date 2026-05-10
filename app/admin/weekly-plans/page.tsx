"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { formatSchoolDateRange, toEnglishDigits } from "@/lib/format";

type WeeklyPlan = {
  id: string;
  academic_year: string;
  week_number: number;
  start_date: string;
  end_date: string;
  start_hijri: string;
  end_hijri: string;
  grade: number;
  grade_label: string;
  subject: string;
  domain: string | null;
  skill: string;
  learning_goal: string | null;
  assessment_title: string;
  question_count: number;
  difficulty_level: string;
  status: string;
};

const statusLabels: Record<string, string> = {
  active: "مفعلة",
  inactive: "معطلة",
  archived: "مؤرشفة",
};

const difficultyLabels: Record<string, string> = {
  easy: "سهل",
  medium: "متوسط",
  hard: "متقدم",
  nafs_simulation: "محاكاة نافس",
};

export default function WeeklyPlansAdminPage() {
  const [plans, setPlans] = useState<WeeklyPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [grade, setGrade] = useState("");
  const [subject, setSubject] = useState("");
  const [week, setWeek] = useState("");
  const [status, setStatus] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (grade) params.set("grade", grade);
    if (subject) params.set("subject", subject);
    if (week) params.set("week", week);
    if (status) params.set("status", status);
    return params.toString();
  }, [grade, subject, week, status]);

  const loadPlans = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/weekly-plans${query ? `?${query}` : ""}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "تعذر تحميل الخطط");
      setPlans(json.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تحميل الخطط");
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void loadPlans();
  }, [loadPlans]);

  async function toggleStatus(plan: WeeklyPlan) {
    const nextStatus = plan.status === "active" ? "inactive" : "active";
    setBusyId(plan.id);
    try {
      const res = await fetch(`/api/admin/weekly-plans/${plan.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "تعذر تحديث الخطة");
      setPlans((prev) => prev.map((item) => (item.id === plan.id ? json.data : item)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تحديث الخطة");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="min-h-screen bg-[#f7fafc] text-[#0b2447]" dir="rtl">
      <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
          <BrandLogo size="sm" contextTitle="إدارة الخطة الأسبوعية" contextSubtitle="الصفوف 3-6، والعلوم للصفوف 4-6" />
          <Link href="/admin" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-extrabold text-slate-500">
            العودة للوحة الإدارة
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-5 py-8 lg:px-8">
        <section className="rounded-[1.5rem] border border-slate-100 bg-white p-5 shadow-[0_10px_34px_rgba(15,35,55,0.035)]">
          <div className="grid gap-3 md:grid-cols-5">
            <select value={grade} onChange={(event) => setGrade(event.target.value)} className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-bold">
              <option value="">كل الصفوف</option>
              {[3, 4, 5, 6].map((item) => <option key={item} value={item}>الصف {toEnglishDigits(item)}</option>)}
            </select>
            <select value={subject} onChange={(event) => setSubject(event.target.value)} className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-bold">
              <option value="">كل المواد</option>
              <option value="رياضيات">رياضيات</option>
              <option value="لغة عربية">لغة عربية</option>
              <option value="علوم">علوم</option>
            </select>
            <select value={week} onChange={(event) => setWeek(event.target.value)} className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-bold">
              <option value="">كل الأسابيع</option>
              {Array.from({ length: 24 }, (_, index) => index + 1).map((item) => <option key={item} value={item}>الأسبوع {toEnglishDigits(item)}</option>)}
            </select>
            <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-bold">
              <option value="">كل الحالات</option>
              <option value="active">مفعلة</option>
              <option value="inactive">معطلة</option>
              <option value="archived">مؤرشفة</option>
            </select>
            <button onClick={loadPlans} className="rounded-xl bg-[#159f91] px-4 py-3 text-sm font-extrabold text-white">
              تحديث
            </button>
          </div>
        </section>

        {error && <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div>}
        {loading && <div className="rounded-xl bg-white p-6 text-center text-sm font-bold text-slate-400">جارٍ تحميل الخطط...</div>}

        {!loading && (
          <section className="overflow-hidden rounded-[1.5rem] border border-slate-100 bg-white shadow-[0_10px_34px_rgba(15,35,55,0.035)]">
            <div className="border-b border-slate-100 p-5">
              <h1 className="text-xl font-black">الخطط الأسبوعية</h1>
              <p className="mt-1 text-sm font-bold text-slate-400">{toEnglishDigits(plans.length)} خطة ظاهرة حسب الفلاتر</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-right">الأسبوع</th>
                    <th className="px-4 py-3 text-right">التاريخ</th>
                    <th className="px-4 py-3 text-right">الصف</th>
                    <th className="px-4 py-3 text-right">المادة</th>
                    <th className="px-4 py-3 text-right">المجال</th>
                    <th className="px-4 py-3 text-right">المهارة</th>
                    <th className="px-4 py-3 text-right">الصعوبة</th>
                    <th className="px-4 py-3 text-right">الحالة</th>
                    <th className="px-4 py-3 text-right">إجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {plans.map((plan) => (
                    <tr key={plan.id} className="hover:bg-slate-50/60">
                      <td className="px-4 py-3 font-black">{toEnglishDigits(plan.week_number)}</td>
                      <td className="px-4 py-3 font-bold text-slate-500">
                        {formatSchoolDateRange({
                          startDate: plan.start_date,
                          endDate: plan.end_date,
                          startHijri: plan.start_hijri,
                          endHijri: plan.end_hijri,
                        })}
                      </td>
                      <td className="px-4 py-3">{plan.grade_label}</td>
                      <td className="px-4 py-3">{plan.subject}</td>
                      <td className="px-4 py-3">{plan.domain ?? "—"}</td>
                      <td className="px-4 py-3 font-bold">{plan.skill}</td>
                      <td className="px-4 py-3">{difficultyLabels[plan.difficulty_level] ?? plan.difficulty_level}</td>
                      <td className="px-4 py-3">{statusLabels[plan.status] ?? plan.status}</td>
                      <td className="px-4 py-3">
                        <button
                          disabled={busyId === plan.id}
                          onClick={() => toggleStatus(plan)}
                          className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-extrabold text-slate-500 disabled:opacity-60"
                        >
                          {plan.status === "active" ? "تعطيل" : "تفعيل"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
