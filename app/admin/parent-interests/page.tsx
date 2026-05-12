"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { toEnglishDigits } from "@/lib/format";

type ParentInterestRow = {
  id: string;
  interestedAt: string;
  studentName: string;
  schoolName: string;
  className: string;
  skillName: string;
  score: number | null;
  totalQuestions: number | null;
  creatorName: string;
  creatorEmail: string | null;
  linkStatus: string;
  whatsappPhone: string | null;
  email: string | null;
  relation: string | null;
  consentAt: string | null;
};

function formatDate(value: string | null) {
  if (!value) return "—";
  return toEnglishDigits(new Intl.DateTimeFormat("ar-SA-u-nu-latn", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value)));
}

function statusClass(value: string) {
  if (value === "صالح") return "bg-emerald-50 text-emerald-700";
  if (value === "منتهي") return "bg-amber-50 text-amber-700";
  if (value === "ملغي") return "bg-rose-50 text-rose-700";
  return "bg-slate-50 text-slate-500";
}

export default function ParentInterestsAdminPage() {
  const [rows, setRows] = useState<ParentInterestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [skillFilter, setSkillFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const loadRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (skillFilter.trim()) params.set("skill", skillFilter.trim());
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/admin/parent-interests?${params.toString()}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "تعذر تحميل اهتمامات أولياء الأمور");
      setRows(json.data ?? []);
    } catch (err) {
      setRows([]);
      setError(err instanceof Error ? err.message : "تعذر تحميل اهتمامات أولياء الأمور");
    } finally {
      setLoading(false);
    }
  }, [skillFilter, statusFilter]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const summary = useMemo(() => {
    const withContact = rows.filter((row) => row.whatsappPhone || row.email).length;
    const validLinks = rows.filter((row) => row.linkStatus === "صالح").length;
    return { total: rows.length, withContact, validLinks };
  }, [rows]);

  return (
    <div className="min-h-screen bg-[#f8fafc]" dir="rtl">
      <header className="border-b border-slate-100 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-5 lg:px-8">
          <BrandLogo size="sm" contextTitle="اهتمامات أولياء الأمور" contextSubtitle="تفاصيل الأدمن فقط" />
          <Link
            href="/admin"
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-extrabold text-slate-600 transition hover:border-[#159f91]/40 hover:text-[#159f91]"
          >
            العودة للوحة الإدارة
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-5 py-8 lg:px-8">
        <section className="rounded-[1.5rem] border border-slate-100 bg-white p-6 shadow-[0_10px_34px_rgba(15,35,55,0.035)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-extrabold text-[#159f91]">خصوصية عالية</p>
              <h1 className="mt-2 text-2xl font-black text-[#0b2447]">تفاصيل اهتمام أولياء الأمور بالتدريبات الإضافية</h1>
              <p className="mt-2 max-w-3xl text-sm font-bold leading-7 text-slate-500">
                هذه التفاصيل تظهر للأدمن فقط. المعلم وقائد المدرسة يشاهدان مؤشرات عامة بدون أسماء الطلاب أو بيانات التواصل.
              </p>
            </div>
            <button
              onClick={() => void loadRows()}
              disabled={loading}
              className="rounded-xl bg-[#159f91] px-5 py-3 text-sm font-extrabold text-white transition hover:bg-[#10877b] disabled:opacity-50"
            >
              {loading ? "جارٍ التحديث..." : "تحديث"}
            </button>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-slate-50 p-4 text-center">
              <div className="text-2xl font-black text-[#0b2447]">{toEnglishDigits(summary.total)}</div>
              <div className="mt-1 text-xs font-bold text-slate-400">إجمالي الاهتمامات</div>
            </div>
            <div className="rounded-xl bg-teal-50 p-4 text-center">
              <div className="text-2xl font-black text-[#159f91]">{toEnglishDigits(summary.withContact)}</div>
              <div className="mt-1 text-xs font-bold text-slate-400">مع بيانات تواصل</div>
            </div>
            <div className="rounded-xl bg-emerald-50 p-4 text-center">
              <div className="text-2xl font-black text-emerald-700">{toEnglishDigits(summary.validLinks)}</div>
              <div className="mt-1 text-xs font-bold text-slate-400">روابط صالحة</div>
            </div>
          </div>
        </section>

        <section className="rounded-[1.5rem] border border-slate-100 bg-white p-5 shadow-[0_10px_34px_rgba(15,35,55,0.035)]">
          <div className="grid gap-3 md:grid-cols-[1fr_220px_auto]">
            <input
              value={skillFilter}
              onChange={(event) => setSkillFilter(event.target.value)}
              placeholder="فلترة حسب المهارة..."
              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-[#0b2447] outline-none transition focus:border-[#159f91] focus:bg-white"
            />
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-[#0b2447] outline-none transition focus:border-[#159f91] focus:bg-white"
            >
              <option value="">كل حالات الرابط</option>
              <option value="صالح">صالح</option>
              <option value="منتهي">منتهي</option>
              <option value="ملغي">ملغي</option>
            </select>
            <button
              onClick={() => void loadRows()}
              className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-extrabold text-slate-600 transition hover:border-[#159f91]/40 hover:text-[#159f91]"
            >
              تطبيق
            </button>
          </div>

          {error && (
            <div className="mt-4 rounded-xl border border-rose-100 bg-rose-50 p-4 text-sm font-bold text-rose-700">
              {error}
            </div>
          )}

          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[1150px] border-separate border-spacing-y-2 text-right text-sm">
              <thead>
                <tr className="text-xs font-black text-slate-400">
                  <th className="px-3 py-2">الطالب</th>
                  <th className="px-3 py-2">المدرسة</th>
                  <th className="px-3 py-2">الفصل</th>
                  <th className="px-3 py-2">المهارة</th>
                  <th className="px-3 py-2">النتيجة</th>
                  <th className="px-3 py-2">وقت الاهتمام</th>
                  <th className="px-3 py-2">منشئ الرابط</th>
                  <th className="px-3 py-2">حالة الرابط</th>
                  <th className="px-3 py-2">الواتساب</th>
                  <th className="px-3 py-2">الإيميل</th>
                  <th className="px-3 py-2">الصفة</th>
                  <th className="px-3 py-2">وقت الموافقة</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="rounded-xl bg-slate-50/70 font-bold text-slate-600">
                    <td className="rounded-r-xl px-3 py-3 text-[#0b2447]">{row.studentName}</td>
                    <td className="px-3 py-3">{row.schoolName}</td>
                    <td className="px-3 py-3">{row.className}</td>
                    <td className="px-3 py-3">{row.skillName || "غير محددة"}</td>
                    <td className="px-3 py-3">{row.score !== null && row.totalQuestions !== null ? toEnglishDigits(`${row.score}/${row.totalQuestions}`) : "—"}</td>
                    <td className="px-3 py-3">{formatDate(row.interestedAt)}</td>
                    <td className="px-3 py-3">
                      <div>{row.creatorName}</div>
                      {row.creatorEmail && <div className="text-xs text-slate-400">{row.creatorEmail}</div>}
                    </td>
                    <td className="px-3 py-3">
                      <span className={`rounded-full px-3 py-1 text-xs font-black ${statusClass(row.linkStatus)}`}>{row.linkStatus}</span>
                    </td>
                    <td className="px-3 py-3" dir="ltr">{row.whatsappPhone ?? "—"}</td>
                    <td className="px-3 py-3" dir="ltr">{row.email ?? "—"}</td>
                    <td className="px-3 py-3">{row.relation ?? "—"}</td>
                    <td className="rounded-l-xl px-3 py-3">{formatDate(row.consentAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!loading && rows.length === 0 && (
            <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm font-bold text-slate-400">
              لا توجد اهتمامات مسجلة حتى الآن.
            </div>
          )}
          {loading && (
            <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm font-bold text-slate-400">
              جارٍ تحميل البيانات...
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
