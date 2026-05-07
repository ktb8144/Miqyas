"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";
import { DemoBanner } from "@/components/demo-banner";
import { assessments, teachers, nafisSkills, monthlyData, school } from "@/lib/demo-data";
import { supabase } from "@/lib/supabase";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line
} from "recharts";

const TABS = ["لوحة القيادة", "مسار نافس", "أداء المعلمين", "التنبيهات", "التحسن"];

function StatusBadge({ status, overdueDays }: { status: string; overdueDays?: number }) {
  if (status === "completed") return (
    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-sm font-extrabold text-emerald-700">
      مكتمل
    </span>
  );
  if (status === "overdue") return (
    <span className="inline-flex items-center gap-1 rounded-full border border-rose-100 bg-rose-50 px-3 py-1 text-sm font-extrabold text-rose-700">
      متأخر {overdueDays} {overdueDays === 1 ? "يوم" : "أيام"}
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-100 bg-amber-50 px-3 py-1 text-sm font-extrabold text-amber-700">
      لم يبدأ
    </span>
  );
}

function NafisBar({ name, score }: { name: string; score: number }) {
  const color = score >= 90 ? "#7F77DD" : score >= 70 ? "#1D9E75" : score >= 50 ? "#BA7517" : "#E24B4A";
  const label = score >= 90 ? "متقدم" : score >= 70 ? "متمكن" : score >= 50 ? "أساسي" : "دون الأساسي";
  return (
    <div className="mb-4">
      <div className="flex justify-between items-center mb-1">
        <span className="text-sm font-extrabold text-[#0b2447]">{name}</span>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold" style={{ color }}>{score}%</span>
          <span className="text-xs px-2 py-0.5 rounded-full text-white" style={{ background: color }}>{label}</span>
        </div>
      </div>
      <div className="h-2.5 w-full rounded-full bg-slate-100">
        <div className="h-2.5 rounded-full transition-all" style={{ width: `${score}%`, background: color }} />
      </div>
    </div>
  );
}

function TeacherCard({ teacher }: { teacher: typeof teachers[0] }) {
  const overall = (teacher.activation + teacher.submission) / 2;
  const badge = overall >= 85 ? { label: "ممتاز", color: "#1D9E75", bg: "#f0fdf8" }
    : overall >= 70 ? { label: "جيد", color: "#BA7517", bg: "#fffbeb" }
    : { label: "يحتاج دعم", color: "#E24B4A", bg: "#fff5f5" };

  return (
    <div className="rounded-[1.5rem] border border-slate-100 bg-white p-5 shadow-[0_10px_34px_rgba(15,35,55,0.035)] transition-all hover:-translate-y-0.5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="font-black text-[#0b2447]">{teacher.name}</div>
          <div className="text-sm font-bold text-slate-400">{teacher.grade} — {teacher.subject}</div>
        </div>
        <span className="px-3 py-1 rounded-full text-sm font-bold" style={{ color: badge.color, background: badge.bg }}>
          {badge.label}
        </span>
      </div>
      <div className="grid grid-cols-5 gap-2">
        {[
          { label: "التفعيل", value: `${teacher.activation}%`, good: teacher.activation >= 80 },
          { label: "التسليم", value: `${teacher.submission}%`, good: teacher.submission >= 80 },
          { label: "التحسن", value: `${teacher.improvement > 0 ? "+" : ""}${teacher.improvement}%`, good: teacher.improvement > 0 },
          { label: "دون الأساسي", value: `${teacher.belowBasic}%`, good: teacher.belowBasic <= 20 },
          { label: "السرعة", value: teacher.speed, good: teacher.speed === "سريع" },
        ].map((kpi, i) => (
          <div key={i} className="rounded-xl bg-slate-50/80 p-2 text-center">
            <div className={`text-sm font-bold ${kpi.good ? "text-green-600" : "text-red-500"}`}>{kpi.value}</div>
            <div className="mt-0.5 text-xs font-bold text-slate-400">{kpi.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PrincipalDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState(0);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace("/login");
        return;
      }
      setCheckingSession(false);
    });
  }, [router]);

  return (
    <div className="min-h-screen bg-[#f7fafc] text-[#0b2447]" dir="rtl">
      <DemoBanner />

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
          <BrandLogo
            size="sm"
            contextTitle="لوحة مدير المدرسة"
            contextSubtitle={school.name}
          />
          <div className="flex items-center gap-3">
            <span className="hidden rounded-full bg-slate-50 px-4 py-2 text-sm font-extrabold text-slate-500 sm:inline-flex">{school.principal}</span>
            <button
              onClick={async () => { await supabase.auth.signOut(); router.push("/login"); }}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-extrabold text-slate-500 transition hover:border-[#159f91]/40 hover:text-[#159f91]"
            >
              خروج
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-5 pb-3 lg:px-8">
          {TABS.map((tab, i) => (
            <button
              key={i}
              onClick={() => setActiveTab(i)}
              className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-extrabold transition-all ${
                activeTab === i
                  ? "bg-[#159f91] text-white shadow-[0_10px_24px_rgba(21,159,145,0.12)]"
                  : "bg-slate-50 text-slate-500 hover:text-[#0b2447]"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-8 lg:px-8">
        {checkingSession && (
          <div className="mb-6 rounded-[1.5rem] border border-slate-100 bg-white p-6 text-center text-sm font-extrabold text-slate-500 shadow-[0_10px_34px_rgba(15,35,55,0.035)]">
            جارٍ تحميل لوحة المدرسة...
          </div>
        )}

        {/* TAB 1: لوحة القيادة */}
        {activeTab === 0 && !checkingSession && (
          <div className="space-y-6">
            {/* Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "المعلمون المنجزون", value: "٢/٤", sub: "هذا الأسبوع", color: "#1D9E75", icon: "👨‍🏫" },
                { label: "متوسط المدرسة", value: "٧٠٪", sub: "في جميع المهارات", color: "#1D9E75", icon: "📊" },
                { label: "طلاب دون الأساسي", value: "٤", sub: "يحتاجون تدخلاً", color: "#E24B4A", icon: "⚠️" },
                { label: "مهارات دون ٥٠٪", value: "٠", sub: "لا توجد الآن", color: "#1D9E75", icon: "✅" },
              ].map((m, i) => (
                <div key={i} className="rounded-[1.5rem] border border-slate-100 bg-white p-5 shadow-[0_10px_34px_rgba(15,35,55,0.035)]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-2xl">{m.icon}</span>
                    <span className="text-xs font-bold text-slate-400">{m.sub}</span>
                  </div>
                  <div className="mb-1 text-3xl font-black" style={{ color: m.color }}>{m.value}</div>
                  <div className="text-sm font-bold text-slate-500">{m.label}</div>
                </div>
              ))}
            </div>

            {/* Assessments Table */}
            <div className="overflow-hidden rounded-[1.5rem] border border-slate-100 bg-white shadow-[0_10px_34px_rgba(15,35,55,0.035)]">
              <div className="border-b border-slate-100 p-5">
                <h3 className="font-black text-[#0b2447]">تقييمات هذا الأسبوع</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-slate-100 bg-slate-50/70">
                    <tr>
                      <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">المهارة</th>
                      <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">الصف</th>
                      <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">المعلم</th>
                      <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">الحالة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {assessments.map((a) => (
                      <tr key={a.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">{a.skill}</td>
                        <td className="px-4 py-3 text-gray-600">{a.grade}</td>
                        <td className="px-4 py-3 text-gray-600">{a.teacher}</td>
                        <td className="px-4 py-3"><StatusBadge status={a.status} overdueDays={a.overdueDays} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* NAFIS Score */}
            <div className="rounded-[1.5rem] border border-slate-100 bg-white p-6 shadow-[0_10px_34px_rgba(15,35,55,0.035)]">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black text-[#0b2447]">جاهزية نافس</h3>
                  <p className="text-sm font-bold text-slate-400">بناءً على التقييمات الأسبوعية</p>
                </div>
                <div className="text-center">
                  <div className="text-5xl font-bold" style={{ color: "#BA7517" }}>٦٩٪</div>
                  <div className="text-green-600 font-medium text-sm mt-1">↑ تحسن هذا الشهر</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: مسار نافس */}
        {activeTab === 1 && !checkingSession && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-gray-900 text-lg">مسار نافس الشامل</h3>
                <span className="px-3 py-1 rounded-full text-sm font-bold" style={{ color: "#BA7517", background: "#fffbeb" }}>
                  جاهزية ٦٩٪
                </span>
              </div>
            </div>
            {Object.entries(nafisSkills).map(([subject, skills]) => (
              <div key={subject} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                <h4 className="font-bold text-gray-900 mb-4 text-lg flex items-center gap-2">
                  {subject === "الرياضيات" ? "📐" : subject === "اللغة العربية" ? "📖" : "🔬"}
                  {subject}
                </h4>
                {skills.map((s) => <NafisBar key={s.name} {...s} />)}
              </div>
            ))}
          </div>
        )}

        {/* TAB 3: أداء المعلمين */}
        {activeTab === 2 && !checkingSession && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-2">
              <h3 className="font-bold text-gray-900">تقرير أداء المعلمين</h3>
              <p className="text-sm text-gray-500">بناءً على ٥ مؤشرات أداء رئيسية</p>
            </div>
            {teachers.map((t) => <TeacherCard key={t.id} teacher={t} />)}
          </div>
        )}

        {/* TAB 4: التنبيهات */}
        {activeTab === 3 && !checkingSession && (
          <div className="space-y-4">
            <div className="rounded-xl border p-5" style={{ background: "#fff5f5", borderColor: "#fecaca" }}>
              <h3 className="font-bold mb-3" style={{ color: "#E24B4A" }}>🔴 تنبيهات عاجلة</h3>
              <div className="space-y-3">
                <div className="bg-white rounded-lg p-4 border border-red-100">
                  <p className="font-medium text-gray-900">❌ تقييم متأخر: الفهم القرائي — فهد العمري</p>
                  <p className="text-sm text-gray-500 mt-1">متأخر ٣ أيام — الثالث ابتدائي</p>
                </div>
                <div className="bg-white rounded-lg p-4 border border-red-100">
                  <p className="font-medium text-gray-900">❌ تقييم متأخر: المعادلات — راشد المطيري</p>
                  <p className="text-sm text-gray-500 mt-1">متأخر يوم واحد — السادس ابتدائي</p>
                </div>
                <div className="bg-white rounded-lg p-4 border border-red-100">
                  <p className="font-medium text-gray-900">⚠️ عبدالرحمن خالد — رياضيات الثالث</p>
                  <p className="text-sm text-gray-500 mt-1">نتيجة ٤/١٠ — دون الأساسي — يحتاج تدخلاً فورياً</p>
                </div>
                <div className="bg-white rounded-lg p-4 border border-red-100">
                  <p className="font-medium text-gray-900">⚠️ يوسف أحمد الشمري — رياضيات الثالث</p>
                  <p className="text-sm text-gray-500 mt-1">نتيجة ٣/١٠ — دون الأساسي — يحتاج تدخلاً فورياً</p>
                </div>
              </div>
            </div>
            <div className="rounded-xl border p-5" style={{ background: "#f0fdf8", borderColor: "#86efac" }}>
              <h3 className="font-bold mb-3" style={{ color: "#1D9E75" }}>🟢 إنجازات هذا الأسبوع</h3>
              <div className="space-y-3">
                <div className="bg-white rounded-lg p-4 border border-green-100">
                  <p className="font-medium text-gray-900">✅ سلطان فهد العنزي — علامة كاملة ١٠/١٠</p>
                  <p className="text-sm text-gray-500 mt-1">مستوى متقدم في مهارة الكسور</p>
                </div>
                <div className="bg-white rounded-lg p-4 border border-green-100">
                  <p className="font-medium text-gray-900">✅ عمر خالد الرشيدي — ٩/١٠</p>
                  <p className="text-sm text-gray-500 mt-1">مستوى متقدم في مهارة الكسور</p>
                </div>
                <div className="bg-white rounded-lg p-4 border border-green-100">
                  <p className="font-medium text-gray-900">✅ عبدالله السالم — ٢ تقييم مكتمل بوقت قياسي</p>
                  <p className="text-sm text-gray-500 mt-1">أعلى معدل تسليم هذا الأسبوع</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: التحسن */}
        {activeTab === 4 && !checkingSession && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <h3 className="font-bold text-gray-900 mb-6">تطور مستويات الطلاب — شهر بشهر</h3>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="متقدم" stackId="a" fill="#7F77DD" />
                  <Bar dataKey="متمكن" stackId="a" fill="#1D9E75" />
                  <Bar dataKey="أساسي" stackId="a" fill="#BA7517" />
                  <Bar dataKey="دون الأساسي" stackId="a" fill="#E24B4A" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <h3 className="font-bold text-gray-900 mb-6">متوسط المدرسة الشهري</h3>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={[
                  { month: "يناير", avg: 62 },
                  { month: "فبراير", avg: 65 },
                  { month: "مارس", avg: 67 },
                  { month: "أبريل", avg: 68 },
                  { month: "مايو", avg: 70 },
                ]}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis domain={[50, 80]} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="avg" stroke="#1D9E75" strokeWidth={3} dot={{ fill: "#1D9E75", r: 5 }} name="المتوسط %" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
