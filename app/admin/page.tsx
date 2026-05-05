"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  BookOpenCheck,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ClipboardList,
  Download,
  FileText,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  MoreHorizontal,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  TrendingUp,
  UserRoundCog,
  UsersRound,
} from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { supabase } from "@/lib/supabase";

type Tab = "overview" | "schools" | "users" | "questions" | "reports";

type OverviewData = {
  schools: { total: number };
  users: {
    total: number;
    byRole: {
      admin: number;
      principal: number;
      teacher: number;
    };
  };
  students: { total: number };
  questions: { total: number };
};

type ApiState = "idle" | "loading" | "ready" | "error";

const fallbackOverview: OverviewData = {
  schools: { total: 12 },
  users: {
    total: 61,
    byRole: {
      admin: 2,
      principal: 12,
      teacher: 47,
    },
  },
  students: { total: 1240 },
  questions: { total: 320 },
};

const schools = [
  { name: "مدرسة الملك فهد", city: "الرياض", principal: "محمد القحطاني", teachers: 8, students: 248, status: "نشطة", score: "86%" },
  { name: "مدرسة الأمير سلطان", city: "جدة", principal: "عبدالله العتيبي", teachers: 12, students: 340, status: "نشطة", score: "82%" },
  { name: "مدرسة ابن خلدون", city: "الدمام", principal: "سارة الغامدي", teachers: 5, students: 186, status: "تجريبية", score: "74%" },
  { name: "مدرسة الوفاء", city: "مكة", principal: "نورة الحربي", teachers: 3, students: 92, status: "موقوفة", score: "—" },
];

const users = [
  { name: "فهد المطيري", email: "admin@miqyas.sa", role: "admin", school: "كل المدارس", status: "نشط" },
  { name: "محمد القحطاني", email: "principal@miqyas.sa", role: "principal", school: "مدرسة الملك فهد", status: "نشط" },
  { name: "عبدالله السالم", email: "teacher@miqyas.sa", role: "teacher", school: "مدرسة الملك فهد", status: "نشط" },
  { name: "سارة الغامدي", email: "sarah@miqyas.sa", role: "principal", school: "مدرسة ابن خلدون", status: "دعوة مرسلة" },
];

const questions = [
  { subject: "رياضيات", grade: "الثالث", skill: "الكسور", week: "الأسبوع 5", difficulty: "متوسط", status: "مفعل" },
  { subject: "لغتي", grade: "الرابع", skill: "الفهم القرائي", week: "الأسبوع 5", difficulty: "سهل", status: "مفعل" },
  { subject: "علوم", grade: "الخامس", skill: "الطاقة", week: "الأسبوع 4", difficulty: "متقدم", status: "مسودة" },
  { subject: "رياضيات", grade: "السادس", skill: "النسبة", week: "الأسبوع 4", difficulty: "متوسط", status: "مفعل" },
];

const activity = [
  { title: "تمت إضافة مدرسة جديدة", detail: "مدرسة ابن خلدون - الدمام", time: "قبل 18 دقيقة", icon: Building2 },
  { title: "اكتمل تصحيح دفعة أوراق", detail: "الثالث أ - 32 ورقة", time: "قبل ساعة", icon: ClipboardList },
  { title: "تم تحديث دور مستخدم", detail: "عبدالله السالم أصبح teacher", time: "اليوم", icon: UserRoundCog },
  { title: "تقرير أسبوعي جاهز", detail: "أداء المدارس للأسبوع الخامس", time: "أمس", icon: FileText },
];

const weakSkills = [
  { skill: "الكسور", value: 52, color: "#ef4444" },
  { skill: "الفهم القرائي", value: 59, color: "#f59e0b" },
  { skill: "القسمة", value: 64, color: "#f59e0b" },
  { skill: "الهندسة", value: 78, color: "#14b8a6" },
];

const navItems = [
  { id: "overview", label: "لوحة عامة", icon: LayoutDashboard },
  { id: "schools", label: "المدارس", icon: Building2 },
  { id: "users", label: "المستخدمون", icon: UsersRound },
  { id: "questions", label: "الأسئلة الأسبوعية", icon: BookOpenCheck },
  { id: "reports", label: "التقارير", icon: BarChart3 },
] satisfies { id: Tab; label: string; icon: typeof LayoutDashboard }[];

function formatNumber(value: number) {
  return new Intl.NumberFormat("ar-SA").format(value);
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "نشطة" || status === "نشط" || status === "مفعل"
      ? "border-emerald-100 bg-emerald-50 text-emerald-700"
      : status === "تجريبية" || status === "دعوة مرسلة" || status === "مسودة"
        ? "border-amber-100 bg-amber-50 text-amber-700"
        : "border-rose-100 bg-rose-50 text-rose-700";

  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${tone}`}>
      {status}
    </span>
  );
}

function PrimaryButton({ children }: { children: React.ReactNode }) {
  return (
    <button className="inline-flex items-center gap-2 rounded-xl bg-[#159f91] px-4 py-2.5 text-sm font-extrabold text-white shadow-[0_10px_24px_rgba(21,159,145,0.12)] transition hover:bg-[#10877b]">
      <Plus className="h-4 w-4" />
      {children}
    </button>
  );
}

function SoftButton({ children }: { children: React.ReactNode }) {
  return (
    <button className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-extrabold text-[#0b2447] transition hover:border-[#159f91]/40 hover:text-[#159f91]">
      {children}
    </button>
  );
}

function StatCard({
  title,
  value,
  hint,
  icon: Icon,
  accent,
}: {
  title: string;
  value: string;
  hint: string;
  icon: typeof LayoutDashboard;
  accent: string;
}) {
  return (
    <div className="rounded-[1.5rem] border border-slate-100 bg-white p-6 shadow-[0_10px_34px_rgba(15,35,55,0.035)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-slate-400">{title}</p>
          <p className="mt-3 text-3xl font-black text-[#0b2447]">{value}</p>
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl" style={{ backgroundColor: `${accent}14`, color: accent }}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
      <p className="mt-5 text-xs font-bold text-slate-400">{hint}</p>
    </div>
  );
}

function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div>
        <p className="mb-2 text-sm font-extrabold text-[#159f91]">مدير النظام</p>
        <h1 className="text-3xl font-black tracking-normal text-[#0b2447]">{title}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-500">{description}</p>
      </div>
      {action}
    </div>
  );
}

function SearchBar({ placeholder }: { placeholder: string }) {
  return (
    <div className="relative w-full md:max-w-sm">
      <Search className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        className="w-full rounded-xl border border-slate-100 bg-white py-3 pl-4 pr-11 text-sm font-semibold text-[#0b2447] outline-none transition placeholder:text-slate-300 focus:border-[#159f91]/40"
        placeholder={placeholder}
      />
    </div>
  );
}

function OverviewTab({ overview, state }: { overview: OverviewData; state: ApiState }) {
  const stats = [
    {
      title: "المدارس",
      value: formatNumber(overview.schools.total),
      hint: "عدد المدارس المسجلة في المنصة",
      icon: Building2,
      accent: "#159f91",
    },
    {
      title: "المستخدمون",
      value: formatNumber(overview.users.total),
      hint: `admin ${overview.users.byRole.admin} · principal ${overview.users.byRole.principal} · teacher ${overview.users.byRole.teacher}`,
      icon: UsersRound,
      accent: "#0b2447",
    },
    {
      title: "الطلاب",
      value: formatNumber(overview.students.total),
      hint: "طلاب مرتبطون بمدارس وفصول",
      icon: GraduationCap,
      accent: "#14b8a6",
    },
    {
      title: "الأسئلة",
      value: formatNumber(overview.questions.total),
      hint: "أسئلة أسبوعية جاهزة أو منشورة",
      icon: ClipboardList,
      accent: "#f59e0b",
    },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title="لوحة مدير النظام"
        description="نظرة مركزية على المدارس والمستخدمين والطلاب والأسئلة، مع مؤشرات تساعدك على متابعة تشغيل المنصة."
        action={
          <div className="flex gap-3">
            <SoftButton>
              <Download className="h-4 w-4" />
              تصدير ملخص
            </SoftButton>
            <PrimaryButton>إضافة مدرسة</PrimaryButton>
          </div>
        }
      />

      {state === "error" && (
        <div className="rounded-2xl border border-amber-100 bg-amber-50 px-5 py-4 text-sm font-bold text-amber-800">
          تعذر تحميل الإحصاءات الحية، ويتم عرض بيانات تجريبية مؤقتة.
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.title} {...stat} />
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[1.5rem] border border-slate-100 bg-white p-6 shadow-[0_10px_34px_rgba(15,35,55,0.035)]">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black text-[#0b2447]">آخر النشاطات</h2>
              <p className="mt-1 text-sm text-slate-400">أحدث العمليات على مستوى النظام</p>
            </div>
            <Activity className="h-5 w-5 text-[#159f91]" />
          </div>
          <div className="space-y-4">
            {activity.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="flex items-start gap-4 rounded-2xl bg-slate-50/70 p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#159f91]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-extrabold text-[#0b2447]">{item.title}</p>
                      <span className="shrink-0 text-xs font-bold text-slate-400">{item.time}</span>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">{item.detail}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-slate-100 bg-white p-6 shadow-[0_10px_34px_rgba(15,35,55,0.035)]">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black text-[#0b2447]">المهارات الأضعف</h2>
              <p className="mt-1 text-sm text-slate-400">حسب نتائج آخر أسبوع</p>
            </div>
            <TrendingDown className="h-5 w-5 text-rose-500" />
          </div>
          <div className="space-y-5">
            {weakSkills.map((item) => (
              <div key={item.skill}>
                <div className="mb-2 flex items-center justify-between text-sm font-bold">
                  <span className="text-[#0b2447]">{item.skill}</span>
                  <span className="text-slate-400">{item.value}%</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full" style={{ width: `${item.value}%`, backgroundColor: item.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SchoolsTab() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="إدارة المدارس"
        description="عرض المدارس، إضافة مدرسة جديدة، وتفعيل أو تعطيل الوصول حسب حالة الاشتراك والتجربة."
        action={<PrimaryButton>إضافة مدرسة</PrimaryButton>}
      />
      <div className="rounded-[1.5rem] border border-slate-100 bg-white shadow-[0_10px_34px_rgba(15,35,55,0.035)]">
        <div className="flex flex-col gap-4 border-b border-slate-100 p-5 md:flex-row md:items-center md:justify-between">
          <SearchBar placeholder="ابحث باسم المدرسة أو المدينة" />
          <SoftButton>
            <Settings className="h-4 w-4" />
            إعدادات المدارس
          </SoftButton>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-400">
                <th className="px-5 py-4 text-right font-extrabold">المدرسة</th>
                <th className="px-5 py-4 text-right font-extrabold">المدينة</th>
                <th className="px-5 py-4 text-right font-extrabold">المدير</th>
                <th className="px-5 py-4 text-right font-extrabold">المعلمون</th>
                <th className="px-5 py-4 text-right font-extrabold">الطلاب</th>
                <th className="px-5 py-4 text-right font-extrabold">الأداء</th>
                <th className="px-5 py-4 text-right font-extrabold">الحالة</th>
                <th className="px-5 py-4 text-right font-extrabold">إجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {schools.map((school) => (
                <tr key={school.name} className="transition hover:bg-slate-50/70">
                  <td className="px-5 py-4 font-extrabold text-[#0b2447]">{school.name}</td>
                  <td className="px-5 py-4 font-bold text-slate-500">{school.city}</td>
                  <td className="px-5 py-4 font-bold text-slate-500">{school.principal}</td>
                  <td className="px-5 py-4 font-bold text-slate-500">{school.teachers}</td>
                  <td className="px-5 py-4 font-bold text-slate-500">{formatNumber(school.students)}</td>
                  <td className="px-5 py-4 font-extrabold text-[#159f91]">{school.score}</td>
                  <td className="px-5 py-4"><StatusBadge status={school.status} /></td>
                  <td className="px-5 py-4">
                    <button className="rounded-xl border border-slate-100 p-2 text-slate-400 transition hover:text-[#159f91]">
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function UsersTab() {
  const roleLabel: Record<string, string> = {
    admin: "مدير نظام",
    principal: "مدير مدرسة",
    teacher: "معلم",
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="إدارة المستخدمين"
        description="إنشاء حسابات وربط المستخدمين بالمدارس مع تحديد الدور المناسب: admin أو principal أو teacher."
        action={<PrimaryButton>إضافة مستخدم</PrimaryButton>}
      />
      <div className="rounded-[1.5rem] border border-slate-100 bg-white shadow-[0_10px_34px_rgba(15,35,55,0.035)]">
        <div className="flex flex-col gap-4 border-b border-slate-100 p-5 md:flex-row md:items-center md:justify-between">
          <SearchBar placeholder="ابحث بالاسم أو البريد" />
          <div className="flex gap-2">
            {["admin", "principal", "teacher"].map((role) => (
              <button key={role} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs font-extrabold text-slate-500">
                {roleLabel[role]}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-4">
          {users.map((user) => (
            <div key={user.email} className="rounded-2xl border border-slate-100 bg-slate-50/50 p-5">
              <div className="mb-5 flex items-start justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-[#159f91]">
                  <UserRoundCog className="h-6 w-6" />
                </div>
                <StatusBadge status={user.status} />
              </div>
              <h3 className="font-black text-[#0b2447]">{user.name}</h3>
              <p className="mt-1 text-xs font-semibold text-slate-400" dir="ltr">{user.email}</p>
              <div className="mt-5 space-y-2 text-sm font-bold text-slate-500">
                <div className="flex justify-between gap-3">
                  <span>الدور</span>
                  <span className="text-[#0b2447]">{roleLabel[user.role]}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span>المدرسة</span>
                  <span className="text-[#0b2447]">{user.school}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function QuestionsTab() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="إدارة الأسئلة الأسبوعية"
        description="إضافة الأسئلة، تحديد المادة والصف والمهارة والصعوبة والإجابة الصحيحة، ثم تفعيلها للأسبوع المناسب."
        action={
          <div className="flex gap-3">
            <SoftButton>
              <Sparkles className="h-4 w-4" />
              توليد بالذكاء الاصطناعي
            </SoftButton>
            <PrimaryButton>إضافة سؤال</PrimaryButton>
          </div>
        }
      />
      <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-[1.5rem] border border-slate-100 bg-white p-6 shadow-[0_10px_34px_rgba(15,35,55,0.035)]">
          <h2 className="text-lg font-black text-[#0b2447]">إضافة سؤال سريع</h2>
          <div className="mt-6 space-y-4">
            {["المادة", "الصف", "المهارة", "مستوى الصعوبة", "الأسبوع/التاريخ"].map((label) => (
              <label key={label} className="block">
                <span className="mb-2 block text-sm font-extrabold text-slate-500">{label}</span>
                <input className="w-full rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-[#159f91]/40 focus:bg-white" />
              </label>
            ))}
            <label className="block">
              <span className="mb-2 block text-sm font-extrabold text-slate-500">نص السؤال</span>
              <textarea rows={4} className="w-full resize-none rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-[#159f91]/40 focus:bg-white" />
            </label>
            <button className="w-full rounded-xl bg-[#159f91] py-3 text-sm font-extrabold text-white">حفظ السؤال</button>
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-slate-100 bg-white shadow-[0_10px_34px_rgba(15,35,55,0.035)]">
          <div className="border-b border-slate-100 p-5">
            <SearchBar placeholder="ابحث في الأسئلة أو المهارات" />
          </div>
          <div className="divide-y divide-slate-100">
            {questions.map((question) => (
              <div key={`${question.subject}-${question.skill}`} className="p-5 transition hover:bg-slate-50/70">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-extrabold text-[#159f91]">{question.subject}</span>
                      <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-extrabold text-slate-500">{question.grade}</span>
                      <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-extrabold text-slate-500">{question.week}</span>
                    </div>
                    <h3 className="font-black text-[#0b2447]">{question.skill}</h3>
                    <p className="mt-1 text-sm font-semibold text-slate-400">الصعوبة: {question.difficulty}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={question.status} />
                    <ChevronLeft className="h-5 w-5 text-slate-300" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ReportsTab() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="التقارير والتحليلات"
        description="متابعة أداء المدارس والمعلمين والطلاب واكتشاف أكثر المهارات ضعفًا على مستوى النظام."
        action={
          <SoftButton>
            <Download className="h-4 w-4" />
            تصدير التقرير
          </SoftButton>
        }
      />
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="متوسط المدارس" value="٨١٪" hint="أداء إجمالي مستقر" icon={TrendingUp} accent="#159f91" />
        <StatCard title="أداء المعلمين" value="٧٨٪" hint="إكمال التقييمات الأسبوعية" icon={UsersRound} accent="#0b2447" />
        <StatCard title="طلاب بحاجة دعم" value="١٢٧" hint="دون المستوى الأساسي" icon={TrendingDown} accent="#ef4444" />
        <StatCard title="تقارير جاهزة" value="٢٤" hint="قابلة للطباعة والتصدير" icon={FileText} accent="#f59e0b" />
      </div>
      <div className="rounded-[1.5rem] border border-slate-100 bg-white p-6 shadow-[0_10px_34px_rgba(15,35,55,0.035)]">
        <h2 className="text-lg font-black text-[#0b2447]">أكثر المهارات ضعفًا</h2>
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          {weakSkills.map((item) => (
            <div key={item.skill} className="rounded-2xl bg-slate-50/70 p-5">
              <div className="mb-3 flex items-center justify-between text-sm font-bold">
                <span className="text-[#0b2447]">{item.skill}</span>
                <span className="text-slate-400">{item.value}%</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-white">
                <div className="h-full rounded-full" style={{ width: `${item.value}%`, backgroundColor: item.color }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [overview, setOverview] = useState<OverviewData>(fallbackOverview);
  const [apiState, setApiState] = useState<ApiState>("idle");
  const [loggingOut, setLoggingOut] = useState(false);

  const activeTitle = useMemo(() => navItems.find((item) => item.id === activeTab)?.label ?? "لوحة عامة", [activeTab]);

  useEffect(() => {
    let mounted = true;

    async function loadOverview() {
      setApiState("loading");
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        window.location.href = "/login";
        return;
      }

      try {
        const res = await fetch("/api/admin/overview", { cache: "no-store" });
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.error || "فشل تحميل بيانات لوحة الإدارة");
        }
        if (mounted) {
          setOverview(json.data);
          setApiState("ready");
        }
      } catch {
        if (mounted) {
          setOverview(fallbackOverview);
          setApiState("error");
        }
      }
    }

    loadOverview();
    return () => {
      mounted = false;
    };
  }, []);

  async function handleLogout() {
    setLoggingOut(true);
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <div className="min-h-screen bg-[#f7fafc] text-[#0b2447]" dir="rtl">
      <aside className="fixed right-0 top-0 z-40 hidden h-screen w-72 border-l border-slate-100 bg-white xl:flex xl:flex-col">
        <div className="border-b border-slate-100 px-6 py-6">
          <BrandLogo size="sm" contextTitle="لوحة الإدارة" contextSubtitle="مدير النظام" />
        </div>

        <nav className="flex-1 space-y-2 px-4 py-6">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-extrabold transition ${
                  isActive
                    ? "bg-[#159f91] text-white shadow-[0_10px_24px_rgba(21,159,145,0.12)]"
                    : "text-slate-500 hover:bg-slate-50 hover:text-[#0b2447]"
                }`}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-slate-100 p-4">
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-extrabold text-rose-600 transition hover:bg-rose-50 disabled:opacity-60"
          >
            <LogOut className="h-5 w-5" />
            {loggingOut ? "جارٍ الخروج..." : "تسجيل الخروج"}
          </button>
        </div>
      </aside>

      <div className="xl:pr-72">
        <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/90 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-4 px-5 py-4 lg:px-8">
            <div className="flex items-center gap-3 xl:hidden">
              <BrandLogo size="sm" contextTitle="الإدارة" />
            </div>
            <div className="hidden xl:block">
              <p className="text-sm font-bold text-slate-400">المسار الحالي</p>
              <p className="mt-1 font-black text-[#0b2447]">{activeTitle}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-4 py-2 text-xs font-extrabold text-emerald-700 md:flex">
                <CheckCircle2 className="h-4 w-4" />
                صلاحية مدير نظام
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#0b2447] text-white">
                <ShieldCheck className="h-5 w-5" />
              </div>
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto border-t border-slate-100 px-5 py-3 xl:hidden">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-xs font-extrabold ${
                    isActive ? "bg-[#159f91] text-white" : "bg-slate-50 text-slate-500"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-5 py-8 lg:px-8 lg:py-10">
          {activeTab === "overview" && <OverviewTab overview={overview} state={apiState} />}
          {activeTab === "schools" && <SchoolsTab />}
          {activeTab === "users" && <UsersTab />}
          {activeTab === "questions" && <QuestionsTab />}
          {activeTab === "reports" && <ReportsTab />}
        </main>
      </div>
    </div>
  );
}
