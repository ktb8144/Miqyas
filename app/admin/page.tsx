"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  BookOpenCheck,
  Building2,
  CheckCircle2,
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

type Tab = "overview" | "schools" | "users" | "questions" | "trialRequests" | "reports";
type ModalType = "school" | "user" | "question";

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

type AdminSchool = {
  id: string;
  name: string;
  city: string;
  school_type?: string;
  principal: string;
  teachers: number;
  students: number;
  status: string;
  score: string;
};

type SchoolFormData = {
  name: string;
  city: string;
  school_type?: string;
};

type AdminUser = {
  id: string;
  auth_id: string | null;
  name: string;
  email: string;
  role: string;
  school_id: string | null;
  school: string;
  status: string;
};

type UserFormData = {
  name: string;
  email: string;
  role: string;
  school_id?: string;
};

type QuestionOption = {
  option_label: string;
  option_text: string;
  is_correct: boolean;
};

type AdminQuestion = {
  id: string;
  subject: string;
  grade: string;
  skill: string;
  difficulty: string;
  question_text: string;
  week_number: number;
  status: string;
  options: QuestionOption[];
  correct_option: string;
};

type QuestionFormData = {
  subject: string;
  grade: string;
  skill: string;
  difficulty: string;
  week_number: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: string;
  status: string;
};

type AdminTrialRequest = {
  id: string;
  name: string;
  school_name: string;
  phone: string;
  email: string;
  message: string;
  status: string;
  created_at: string;
};

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

const fallbackSchools: AdminSchool[] = [
  { id: "demo-1", name: "مدرسة الملك فهد", city: "الرياض", principal: "محمد القحطاني", teachers: 8, students: 248, status: "نشطة", score: "86%" },
  { id: "demo-2", name: "مدرسة الأمير سلطان", city: "جدة", principal: "عبدالله العتيبي", teachers: 12, students: 340, status: "نشطة", score: "82%" },
  { id: "demo-3", name: "مدرسة ابن خلدون", city: "الدمام", principal: "سارة الغامدي", teachers: 5, students: 186, status: "تجريبية", score: "74%" },
  { id: "demo-4", name: "مدرسة الوفاء", city: "مكة", principal: "نورة الحربي", teachers: 3, students: 92, status: "موقوفة", score: "—" },
];

const fallbackUsers: AdminUser[] = [
  { id: "demo-user-1", auth_id: null, name: "فهد المطيري", email: "admin@miqyas.sa", role: "admin", school_id: null, school: "كل المدارس", status: "نشط" },
  { id: "demo-user-2", auth_id: null, name: "محمد القحطاني", email: "principal@miqyas.sa", role: "principal", school_id: "demo-1", school: "مدرسة الملك فهد", status: "نشط" },
  { id: "demo-user-3", auth_id: null, name: "عبدالله السالم", email: "teacher@miqyas.sa", role: "teacher", school_id: "demo-1", school: "مدرسة الملك فهد", status: "نشط" },
  { id: "demo-user-4", auth_id: null, name: "سارة الغامدي", email: "sarah@miqyas.sa", role: "principal", school_id: "demo-3", school: "مدرسة ابن خلدون", status: "دعوة مرسلة" },
];

const fallbackQuestions: AdminQuestion[] = [
  { id: "demo-question-1", subject: "رياضيات", grade: "الثالث", skill: "الكسور", week_number: 5, difficulty: "medium", question_text: "سؤال تجريبي عن الكسور", status: "active", correct_option: "أ", options: [] },
  { id: "demo-question-2", subject: "لغتي", grade: "الرابع", skill: "الفهم القرائي", week_number: 5, difficulty: "easy", question_text: "سؤال تجريبي عن الفهم القرائي", status: "active", correct_option: "ب", options: [] },
  { id: "demo-question-3", subject: "علوم", grade: "الخامس", skill: "الطاقة", week_number: 4, difficulty: "hard", question_text: "سؤال تجريبي عن الطاقة", status: "draft", correct_option: "ج", options: [] },
  { id: "demo-question-4", subject: "رياضيات", grade: "السادس", skill: "النسبة", week_number: 4, difficulty: "medium", question_text: "سؤال تجريبي عن النسبة", status: "active", correct_option: "د", options: [] },
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
  { id: "trialRequests", label: "طلبات التجربة", icon: ClipboardList },
  { id: "reports", label: "التقارير", icon: BarChart3 },
] satisfies { id: Tab; label: string; icon: typeof LayoutDashboard }[];

function formatNumber(value: number) {
  return new Intl.NumberFormat("ar-SA").format(value);
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "نشطة" || status === "نشط" || status === "مفعل"
    || status === "active" || status === "contacted"
      ? "border-emerald-100 bg-emerald-50 text-emerald-700"
      : status === "تجريبية" || status === "دعوة مرسلة" || status === "مسودة" || status === "draft" || status === "new"
        ? "border-amber-100 bg-amber-50 text-amber-700"
        : "border-rose-100 bg-rose-50 text-rose-700";

  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${tone}`}>
      {status === "active" ? "مفعل" : status === "draft" ? "مسودة" : status === "archived" ? "مؤرشف" : status === "new" ? "جديد" : status === "contacted" ? "تم التواصل" : status === "closed" ? "مغلق" : status}
    </span>
  );
}

function PrimaryButton({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-2 rounded-xl bg-[#159f91] px-4 py-2.5 text-sm font-extrabold text-white shadow-[0_10px_24px_rgba(21,159,145,0.12)] transition hover:bg-[#10877b] disabled:opacity-60"
    >
      <Plus className="h-4 w-4" />
      {children}
    </button>
  );
}

function SoftButton({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-extrabold text-[#0b2447] transition hover:border-[#159f91]/40 hover:text-[#159f91]"
    >
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

function ActionDropdown({
  label,
  onEdit,
  onDisable,
  disabled,
  actionLabel = "حذف",
}: {
  label: string;
  onEdit?: () => void;
  onDisable?: () => void;
  disabled?: boolean;
  actionLabel?: string;
}) {
  const [open, setOpen] = useState(false);

  function handleAction(action: "edit" | "delete") {
    if (action === "edit") {
      onEdit?.();
    } else {
      onDisable?.();
    }
    setOpen(false);
  }

  return (
    <div className="relative inline-flex">
      <button
        onClick={() => setOpen((value) => !value)}
        aria-label={`إجراءات ${label}`}
        title={`إجراءات ${label}`}
        disabled={disabled}
        className="rounded-xl border border-slate-100 p-2 text-slate-400 transition hover:text-[#159f91] disabled:opacity-50"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute left-0 top-11 z-20 w-32 overflow-hidden rounded-xl border border-slate-100 bg-white p-1 text-sm font-bold shadow-[0_14px_34px_rgba(15,35,55,0.08)]">
          <button disabled={disabled} onClick={() => handleAction("edit")} className="block w-full rounded-lg px-3 py-2 text-right text-slate-600 hover:bg-slate-50 disabled:opacity-50">
            تعديل
          </button>
          <button disabled={disabled} onClick={() => handleAction("delete")} className="block w-full rounded-lg px-3 py-2 text-right text-rose-600 hover:bg-rose-50 disabled:opacity-50">
            {actionLabel}
          </button>
        </div>
      )}
    </div>
  );
}

function AdminModal({
  type,
  initialValues,
  schools,
  onClose,
  onSubmit,
}: {
  type: ModalType;
  initialValues?: Record<string, string>;
  schools?: AdminSchool[];
  onClose: () => void;
  onSubmit?: (payload: SchoolFormData | UserFormData | QuestionFormData | Record<string, string>) => Promise<void> | void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const config = {
    school: {
      title: initialValues ? "تعديل مدرسة" : "إضافة مدرسة",
      fields: [
        { name: "name", label: "اسم المدرسة", type: "text" },
        { name: "city", label: "المدينة", type: "text" },
        { name: "school_type", label: "نوع المدرسة", type: "schoolType" },
      ],
    },
    user: {
      title: initialValues ? "تعديل مستخدم" : "إضافة مستخدم",
      fields: [
        { name: "name", label: "الاسم", type: "text" },
        { name: "email", label: "الإيميل", type: "email" },
        { name: "role", label: "الدور", type: "select" },
        { name: "school_id", label: "المدرسة", type: "school" },
      ],
    },
    question: {
      title: initialValues ? "تعديل سؤال أسبوعي" : "إضافة سؤال أسبوعي",
      fields: [
        { name: "subject", label: "المادة", type: "text" },
        { name: "grade", label: "الصف", type: "text" },
        { name: "skill", label: "المهارة", type: "text" },
        { name: "difficulty", label: "الصعوبة", type: "difficulty" },
        { name: "week_number", label: "رقم الأسبوع", type: "number" },
        { name: "question_text", label: "نص السؤال", type: "textarea" },
        { name: "option_a", label: "الخيار أ", type: "text" },
        { name: "option_b", label: "الخيار ب", type: "text" },
        { name: "option_c", label: "الخيار ج", type: "text" },
        { name: "option_d", label: "الخيار د", type: "text" },
        { name: "correct_option", label: "الإجابة الصحيحة", type: "correct" },
        { name: "status", label: "الحالة", type: "questionStatus" },
      ],
    },
  }[type];

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const payload = Object.fromEntries(formData.entries()) as Record<string, string>;

    try {
      setFormError(null);
      setSubmitting(true);
      if (onSubmit) {
        await onSubmit(payload);
      } else {
        console.log(config.title, payload);
      }
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : "حدث خطأ غير معروف";
      console.error("admin modal submit failed", { type, message, error });
      setFormError(message);
      if (!(error instanceof Error && error.message === "اسم المدرسة مطلوب")) {
        window.alert(message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b2447]/40 px-4" dir="rtl">
      <div className="w-full max-w-md rounded-[1.5rem] border border-slate-100 bg-white p-6 shadow-[0_22px_70px_rgba(15,35,55,0.14)]">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-black text-[#0b2447]">{config.title}</h2>
          <button onClick={onClose} className="rounded-xl px-3 py-1 text-xl font-bold text-slate-400 hover:bg-slate-50">
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {config.fields.map((field) => (
            <label key={field.name} className="block">
              <span className="mb-2 block text-sm font-extrabold text-slate-500">{field.label}</span>
              {field.type === "select" ? (
                <select name={field.name} defaultValue={initialValues?.[field.name]} className="w-full rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-bold text-[#0b2447] outline-none transition focus:border-[#159f91]/40 focus:bg-white">
                  <option value="admin">admin</option>
                  <option value="principal">principal</option>
                  <option value="teacher">teacher</option>
                </select>
              ) : field.type === "schoolType" ? (
                <select name={field.name} defaultValue={initialValues?.[field.name] ?? "حكومية"} className="w-full rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-bold text-[#0b2447] outline-none transition focus:border-[#159f91]/40 focus:bg-white">
                  <option value="حكومية">حكومية</option>
                  <option value="أهلية">أهلية</option>
                  <option value="عالمية">عالمية</option>
                </select>
              ) : field.type === "school" ? (
                <select name={field.name} defaultValue={initialValues?.[field.name] ?? ""} className="w-full rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-bold text-[#0b2447] outline-none transition focus:border-[#159f91]/40 focus:bg-white">
                  <option value="">بدون مدرسة</option>
                  {(schools ?? []).map((school) => (
                    <option key={school.id} value={school.id}>{school.name}</option>
                  ))}
                </select>
              ) : field.type === "difficulty" ? (
                <select name={field.name} defaultValue={initialValues?.[field.name] ?? "medium"} className="w-full rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-bold text-[#0b2447] outline-none transition focus:border-[#159f91]/40 focus:bg-white">
                  <option value="easy">سهل</option>
                  <option value="medium">متوسط</option>
                  <option value="hard">متقدم</option>
                </select>
              ) : field.type === "correct" ? (
                <select name={field.name} defaultValue={initialValues?.[field.name] ?? "أ"} className="w-full rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-bold text-[#0b2447] outline-none transition focus:border-[#159f91]/40 focus:bg-white">
                  <option value="أ">أ</option>
                  <option value="ب">ب</option>
                  <option value="ج">ج</option>
                  <option value="د">د</option>
                </select>
              ) : field.type === "questionStatus" ? (
                <select name={field.name} defaultValue={initialValues?.[field.name] ?? "draft"} className="w-full rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-bold text-[#0b2447] outline-none transition focus:border-[#159f91]/40 focus:bg-white">
                  <option value="draft">draft</option>
                  <option value="active">active</option>
                  <option value="archived">archived</option>
                </select>
              ) : field.type === "textarea" ? (
                <textarea name={field.name} required={type === "question" && field.name === "question_text"} defaultValue={initialValues?.[field.name]} rows={4} className="w-full resize-none rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-bold text-[#0b2447] outline-none transition focus:border-[#159f91]/40 focus:bg-white" />
              ) : (
                <input name={field.name} required={(type === "school" && ["name", "city"].includes(field.name)) || (type === "user" && ["name", "email"].includes(field.name)) || (type === "question" && ["subject", "grade"].includes(field.name))} defaultValue={initialValues?.[field.name]} type={field.type} className="w-full rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-bold text-[#0b2447] outline-none transition focus:border-[#159f91]/40 focus:bg-white" />
              )}
            </label>
          ))}
          {formError && (
            <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
              {formError}
            </div>
          )}
          <button disabled={submitting} className="w-full rounded-xl bg-[#159f91] py-3 text-sm font-extrabold text-white transition hover:bg-[#10877b] disabled:opacity-60">
            {submitting ? "جارٍ الحفظ..." : "حفظ"}
          </button>
        </form>
      </div>
    </div>
  );
}

function OverviewTab({ overview, state, onAddSchool }: { overview: OverviewData; state: ApiState; onAddSchool: () => void }) {
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
            <PrimaryButton onClick={onAddSchool}>إضافة مدرسة</PrimaryButton>
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

function SchoolsTab({
  schools,
  loading,
  onAddSchool,
  onEditSchool,
  onDisableSchool,
  busySchoolId,
}: {
  schools: AdminSchool[];
  loading: boolean;
  onAddSchool: () => void;
  onEditSchool: (school: AdminSchool) => void;
  onDisableSchool: (school: AdminSchool) => void;
  busySchoolId: string | null;
}) {
  return (
    <div className="space-y-8">
      <PageHeader
        title="إدارة المدارس"
        description="عرض المدارس، إضافة مدرسة جديدة، وتفعيل أو تعطيل الوصول حسب حالة الاشتراك والتجربة."
        action={<PrimaryButton onClick={onAddSchool} disabled={Boolean(busySchoolId)}>إضافة مدرسة</PrimaryButton>}
      />
      <div className="rounded-[1.5rem] border border-slate-100 bg-white shadow-[0_10px_34px_rgba(15,35,55,0.035)]">
        <div className="flex flex-col gap-4 border-b border-slate-100 p-5 md:flex-row md:items-center md:justify-between">
          <SearchBar placeholder="ابحث باسم المدرسة أو المدينة" />
          <SoftButton>
            <Settings className="h-4 w-4" />
            {loading ? "جارٍ تحميل المدارس..." : "إعدادات المدارس"}
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
                <tr key={school.id} className="transition hover:bg-slate-50/70">
                  <td className="px-5 py-4 font-extrabold text-[#0b2447]">{school.name}</td>
                  <td className="px-5 py-4 font-bold text-slate-500">{school.city}</td>
                  <td className="px-5 py-4 font-bold text-slate-500">{school.principal}</td>
                  <td className="px-5 py-4 font-bold text-slate-500">{school.teachers}</td>
                  <td className="px-5 py-4 font-bold text-slate-500">{formatNumber(school.students)}</td>
                  <td className="px-5 py-4 font-extrabold text-[#159f91]">{school.score}</td>
                  <td className="px-5 py-4"><StatusBadge status={school.status} /></td>
                  <td className="px-5 py-4">
                    <ActionDropdown
                      label={school.name}
                      onEdit={() => onEditSchool(school)}
                      onDisable={() => onDisableSchool(school)}
                      disabled={busySchoolId === school.id}
                    />
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

function UsersTab({
  users,
  loading,
  busyUserId,
  onAddUser,
  onEditUser,
  onToggleUserStatus,
}: {
  users: AdminUser[];
  loading: boolean;
  busyUserId: string | null;
  onAddUser: () => void;
  onEditUser: (user: AdminUser) => void;
  onToggleUserStatus: (user: AdminUser) => void;
}) {
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
        action={<PrimaryButton onClick={onAddUser} disabled={Boolean(busyUserId)}>إضافة مستخدم</PrimaryButton>}
      />
      <div className="rounded-[1.5rem] border border-slate-100 bg-white shadow-[0_10px_34px_rgba(15,35,55,0.035)]">
        <div className="flex flex-col gap-4 border-b border-slate-100 p-5 md:flex-row md:items-center md:justify-between">
          <SearchBar placeholder="ابحث بالاسم أو البريد" />
          <div className="flex gap-2">
            {loading && (
              <span className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs font-extrabold text-slate-500">
                جارٍ تحميل المستخدمين...
              </span>
            )}
            {["admin", "principal", "teacher"].map((role) => (
              <button key={role} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs font-extrabold text-slate-500">
                {roleLabel[role]}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-4">
          {users.map((user) => (
            <div key={user.id} className="rounded-2xl border border-slate-100 bg-slate-50/50 p-5">
              <div className="mb-5 flex items-start justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-[#159f91]">
                  <UserRoundCog className="h-6 w-6" />
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={user.status} />
                  <ActionDropdown
                    label={user.name}
                    onEdit={() => onEditUser(user)}
                    onDisable={() => onToggleUserStatus(user)}
                    disabled={busyUserId === user.id}
                    actionLabel={user.status === "موقوف" ? "تفعيل" : "تعطيل"}
                  />
                </div>
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

function QuestionsTab({
  questions,
  loading,
  busyQuestionId,
  onAddQuestion,
  onEditQuestion,
  onToggleQuestionStatus,
}: {
  questions: AdminQuestion[];
  loading: boolean;
  busyQuestionId: string | null;
  onAddQuestion: () => void;
  onEditQuestion: (question: AdminQuestion) => void;
  onToggleQuestionStatus: (question: AdminQuestion) => void;
}) {
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
            <PrimaryButton onClick={onAddQuestion} disabled={Boolean(busyQuestionId)}>إضافة سؤال</PrimaryButton>
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
            {loading && (
              <p className="mt-3 text-xs font-extrabold text-slate-400">جارٍ تحميل الأسئلة...</p>
            )}
          </div>
          <div className="divide-y divide-slate-100">
            {questions.map((question) => (
              <div key={`${question.subject}-${question.skill}`} className="p-5 transition hover:bg-slate-50/70">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-extrabold text-[#159f91]">{question.subject}</span>
                      <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-extrabold text-slate-500">{question.grade}</span>
                      <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-extrabold text-slate-500">الأسبوع {question.week_number}</span>
                    </div>
                    <h3 className="font-black text-[#0b2447]">{question.skill}</h3>
                    <p className="mt-1 text-sm font-semibold text-slate-400">الصعوبة: {question.difficulty}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-400">{question.question_text}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={question.status} />
                    <ActionDropdown
                      label={question.skill || question.question_text}
                      onEdit={() => onEditQuestion(question)}
                      onDisable={() => onToggleQuestionStatus(question)}
                      disabled={busyQuestionId === question.id}
                      actionLabel={question.status === "active" ? "أرشفة" : "تفعيل"}
                    />
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

function TrialRequestsTab({
  requests,
  loading,
  busyTrialRequestId,
  onUpdateStatus,
}: {
  requests: AdminTrialRequest[];
  loading: boolean;
  busyTrialRequestId: string | null;
  onUpdateStatus: (request: AdminTrialRequest, status: string) => void;
}) {
  return (
    <div className="space-y-8">
      <PageHeader
        title="طلبات التجربة"
        description="متابعة طلبات المدارس القادمة من الصفحة الرئيسية وتحديث حالة التواصل معها."
        action={
          <SoftButton>
            <ClipboardList className="h-4 w-4" />
            {loading ? "جارٍ تحميل الطلبات..." : `${formatNumber(requests.length)} طلب`}
          </SoftButton>
        }
      />

      <div className="rounded-[1.5rem] border border-slate-100 bg-white shadow-[0_10px_34px_rgba(15,35,55,0.035)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-400">
                <th className="px-5 py-4 text-right font-extrabold">الاسم</th>
                <th className="px-5 py-4 text-right font-extrabold">المدرسة</th>
                <th className="px-5 py-4 text-right font-extrabold">الجوال</th>
                <th className="px-5 py-4 text-right font-extrabold">الإيميل</th>
                <th className="px-5 py-4 text-right font-extrabold">الحالة</th>
                <th className="px-5 py-4 text-right font-extrabold">التاريخ</th>
                <th className="px-5 py-4 text-right font-extrabold">تحديث الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {requests.map((request) => (
                <tr key={request.id} className="transition hover:bg-slate-50/70">
                  <td className="px-5 py-4 font-extrabold text-[#0b2447]">{request.name}</td>
                  <td className="px-5 py-4 font-bold text-slate-500">{request.school_name}</td>
                  <td className="px-5 py-4 font-bold text-slate-500">{request.phone}</td>
                  <td className="px-5 py-4 font-bold text-slate-500">{request.email}</td>
                  <td className="px-5 py-4"><StatusBadge status={request.status} /></td>
                  <td className="px-5 py-4 font-bold text-slate-500">
                    {request.created_at ? new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(request.created_at)) : "—"}
                  </td>
                  <td className="px-5 py-4">
                    <select
                      value={request.status}
                      disabled={busyTrialRequestId === request.id}
                      onChange={(event) => onUpdateStatus(request, event.target.value)}
                      className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs font-extrabold text-[#0b2447] outline-none transition focus:border-[#159f91]/40 focus:bg-white disabled:opacity-60"
                    >
                      <option value="new">new</option>
                      <option value="contacted">contacted</option>
                      <option value="closed">closed</option>
                    </select>
                  </td>
                </tr>
              ))}
              {!loading && requests.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-sm font-extrabold text-slate-400">
                    لا توجد طلبات تجربة حتى الآن
                  </td>
                </tr>
              )}
            </tbody>
          </table>
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
  const [modalType, setModalType] = useState<ModalType | null>(null);
  const [editingSchool, setEditingSchool] = useState<AdminSchool | null>(null);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [editingQuestion, setEditingQuestion] = useState<AdminQuestion | null>(null);
  const [schoolRows, setSchoolRows] = useState<AdminSchool[]>(fallbackSchools);
  const [userRows, setUserRows] = useState<AdminUser[]>(fallbackUsers);
  const [questionRows, setQuestionRows] = useState<AdminQuestion[]>(fallbackQuestions);
  const [trialRequestRows, setTrialRequestRows] = useState<AdminTrialRequest[]>([]);
  const [schoolsLoading, setSchoolsLoading] = useState(false);
  const [usersLoading, setUsersLoading] = useState(false);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [trialRequestsLoading, setTrialRequestsLoading] = useState(false);
  const [busySchoolId, setBusySchoolId] = useState<string | null>(null);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [busyQuestionId, setBusyQuestionId] = useState<string | null>(null);
  const [busyTrialRequestId, setBusyTrialRequestId] = useState<string | null>(null);
  const [overview, setOverview] = useState<OverviewData>(fallbackOverview);
  const [apiState, setApiState] = useState<ApiState>("idle");
  const [loggingOut, setLoggingOut] = useState(false);

  const activeTitle = useMemo(() => navItems.find((item) => item.id === activeTab)?.label ?? "لوحة عامة", [activeTab]);

  const loadSchools = useCallback(async () => {
    setSchoolsLoading(true);
    try {
      const res = await fetch("/api/admin/schools", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "فشل تحميل المدارس");
      setSchoolRows(json.data);
    } catch (error) {
      console.error("load admin schools failed", error);
    } finally {
      setSchoolsLoading(false);
    }
  }, []);

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const res = await fetch("/api/admin/users", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "فشل تحميل المستخدمين");
      setUserRows(json.data);
    } catch (error) {
      console.error("load admin users failed", error);
    } finally {
      setUsersLoading(false);
    }
  }, []);

  const loadQuestions = useCallback(async () => {
    setQuestionsLoading(true);
    try {
      const res = await fetch("/api/admin/questions", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "فشل تحميل الأسئلة");
      setQuestionRows(json.data);
    } catch (error) {
      console.error("load admin questions failed", error);
    } finally {
      setQuestionsLoading(false);
    }
  }, []);

  const loadTrialRequests = useCallback(async () => {
    setTrialRequestsLoading(true);
    try {
      const res = await fetch("/api/admin/trial-requests", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "فشل تحميل طلبات التجربة");
      setTrialRequestRows(json.data);
    } catch (error) {
      console.error("load admin trial requests failed", error);
    } finally {
      setTrialRequestsLoading(false);
    }
  }, []);

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

  useEffect(() => {
    if (activeTab === "schools") {
      void loadSchools();
    }
    if (activeTab === "users") {
      void loadUsers();
      void loadSchools();
    }
    if (activeTab === "questions") {
      void loadQuestions();
    }
    if (activeTab === "trialRequests") {
      void loadTrialRequests();
    }
  }, [activeTab, loadSchools, loadQuestions, loadTrialRequests, loadUsers]);

  async function handleLogout() {
    setLoggingOut(true);
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  function openAddSchoolModal() {
    setEditingSchool(null);
    setModalType("school");
  }

  function openEditSchoolModal(school: AdminSchool) {
    setEditingSchool(school);
    setModalType("school");
  }

  function openAddUserModal() {
    setEditingUser(null);
    setModalType("user");
  }

  function openEditUserModal(user: AdminUser) {
    setEditingUser(user);
    setModalType("user");
  }

  function openAddQuestionModal() {
    setEditingQuestion(null);
    setModalType("question");
  }

  function openEditQuestionModal(question: AdminQuestion) {
    setEditingQuestion(question);
    setModalType("question");
  }

  async function handleSchoolSubmit(payload: SchoolFormData | Record<string, string>) {
    const name = payload.name?.trim();
    const city = payload.city?.trim() ?? "";
    const school_type = payload.school_type?.trim() || "حكومية";
    if (!name) {
      throw new Error("اسم المدرسة مطلوب");
    }
    if (!city) {
      throw new Error("المدينة مطلوبة");
    }

    const endpoint = editingSchool ? `/api/admin/schools/${editingSchool.id}` : "/api/admin/schools";
    const method = editingSchool ? "PATCH" : "POST";
    setBusySchoolId(editingSchool?.id ?? "new");
    try {
      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, city, school_type }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        console.error("save school API failed", json);
        const details = [json.error, json.code, json.details, json.hint].filter(Boolean).join(" - ");
        throw new Error(details || "فشل حفظ المدرسة");
      }

      if (editingSchool) {
        setSchoolRows((prev) => prev.map((school) => (school.id === editingSchool.id ? json.data : school)));
        window.alert("تم التحديث");
      } else {
        setSchoolRows((prev) => [json.data, ...prev.filter((school) => !school.id.startsWith("demo-"))]);
        window.alert("تمت الإضافة");
      }
      setEditingSchool(null);
    } catch (error) {
      console.error("save school failed", error);
      throw error;
    } finally {
      setBusySchoolId(null);
    }
  }

  async function handleDisableSchool(school: AdminSchool) {
    setBusySchoolId(school.id);
    try {
      const res = await fetch(`/api/admin/schools/${school.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "موقوفة" }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        console.error("disable school API failed", json);
        const details = [json.error, json.code, json.details, json.hint].filter(Boolean).join(" - ");
        throw new Error(details || "فشل تعطيل المدرسة");
      }
      setSchoolRows((prev) => prev.map((item) => (item.id === school.id ? json.data : item)));
      window.alert("تم التعطيل");
    } catch (error) {
      console.error("disable school failed", error);
      window.alert(error instanceof Error ? error.message : "حدث خطأ");
    } finally {
      setBusySchoolId(null);
    }
  }

  async function handleUserSubmit(payload: UserFormData | Record<string, string>) {
    const name = payload.name?.trim();
    const email = payload.email?.trim().toLowerCase();
    const role = payload.role?.trim();
    const school_id = payload.school_id?.trim() || null;

    if (!name || !email || !role) {
      window.alert("حدث خطأ");
      throw new Error("User name, email and role are required");
    }

    if (role !== "admin" && !school_id) {
      window.alert("حدث خطأ");
      throw new Error("School is required for non-admin users");
    }

    const endpoint = editingUser ? `/api/admin/users/${editingUser.id}` : "/api/admin/users";
    const method = editingUser ? "PATCH" : "POST";
    setBusyUserId(editingUser?.id ?? "new");
    try {
      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, role, school_id }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "فشل حفظ المستخدم");

      if (editingUser) {
        setUserRows((prev) => prev.map((user) => (user.id === editingUser.id ? json.data : user)));
        window.alert("تم التحديث");
      } else {
        setUserRows((prev) => [json.data, ...prev.filter((user) => !user.id.startsWith("demo-user-"))]);
        window.alert("تمت الإضافة");
      }
      setEditingUser(null);
    } catch (error) {
      console.error("save user failed", error);
      throw error;
    } finally {
      setBusyUserId(null);
    }
  }

  async function handleToggleUserStatus(user: AdminUser) {
    const nextStatus = user.status === "موقوف" ? "نشط" : "موقوف";
    setBusyUserId(user.id);
    setUserRows((prev) => prev.map((item) => (item.id === user.id ? { ...item, status: nextStatus } : item)));
    try {
      const res = await fetch(`/api/admin/users/${user.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "فشل تحديث حالة المستخدم");
      setUserRows((prev) => prev.map((item) => (item.id === user.id ? json.data : item)));
      window.alert(nextStatus === "موقوف" ? "تم التعطيل" : "تم التحديث");
    } catch (error) {
      console.error("toggle user status failed", error);
      setUserRows((prev) => prev.map((item) => (item.id === user.id ? user : item)));
      window.alert("حدث خطأ");
    } finally {
      setBusyUserId(null);
    }
  }

  async function handleQuestionSubmit(payload: QuestionFormData | Record<string, string>) {
    const subject = payload.subject?.trim();
    const grade = payload.grade?.trim();
    const question_text = payload.question_text?.trim();
    const correct_option = payload.correct_option?.trim() || "أ";

    if (!subject || !grade || !question_text) {
      window.alert("حدث خطأ");
      throw new Error("Question subject, grade and text are required");
    }

    const body = {
      subject,
      grade,
      skill: payload.skill?.trim() ?? "",
      difficulty: payload.difficulty?.trim() || "medium",
      week_number: Number(payload.week_number || 0),
      question_text,
      status: payload.status?.trim() || "draft",
      correct_option,
      options: [
        { option_label: "أ", option_text: payload.option_a?.trim() ?? "" },
        { option_label: "ب", option_text: payload.option_b?.trim() ?? "" },
        { option_label: "ج", option_text: payload.option_c?.trim() ?? "" },
        { option_label: "د", option_text: payload.option_d?.trim() ?? "" },
      ],
    };

    const endpoint = editingQuestion ? `/api/admin/questions/${editingQuestion.id}` : "/api/admin/questions";
    const method = editingQuestion ? "PATCH" : "POST";
    setBusyQuestionId(editingQuestion?.id ?? "new");
    try {
      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "فشل حفظ السؤال");

      if (editingQuestion) {
        setQuestionRows((prev) => prev.map((question) => (question.id === editingQuestion.id ? json.data : question)));
        window.alert("تم التحديث");
      } else {
        setQuestionRows((prev) => [json.data, ...prev.filter((question) => !question.id.startsWith("demo-question-"))]);
        window.alert("تمت الإضافة");
      }
      setEditingQuestion(null);
    } catch (error) {
      console.error("save question failed", error);
      throw error;
    } finally {
      setBusyQuestionId(null);
    }
  }

  async function handleToggleQuestionStatus(question: AdminQuestion) {
    const nextStatus = question.status === "active" ? "archived" : "active";
    setBusyQuestionId(question.id);
    setQuestionRows((prev) => prev.map((item) => (item.id === question.id ? { ...item, status: nextStatus } : item)));
    try {
      const res = await fetch(`/api/admin/questions/${question.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "فشل تحديث حالة السؤال");
      setQuestionRows((prev) => prev.map((item) => (item.id === question.id ? json.data : item)));
      window.alert(nextStatus === "active" ? "تم التحديث" : "تم التعطيل");
    } catch (error) {
      console.error("toggle question status failed", error);
      setQuestionRows((prev) => prev.map((item) => (item.id === question.id ? question : item)));
      window.alert("حدث خطأ");
    } finally {
      setBusyQuestionId(null);
    }
  }

  async function handleTrialRequestStatus(request: AdminTrialRequest, status: string) {
    setBusyTrialRequestId(request.id);
    setTrialRequestRows((prev) => prev.map((item) => (item.id === request.id ? { ...item, status } : item)));

    try {
      const res = await fetch(`/api/admin/trial-requests/${request.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "فشل تحديث حالة طلب التجربة");
      setTrialRequestRows((prev) => prev.map((item) => (item.id === request.id ? json.data : item)));
    } catch (error) {
      console.error("update trial request status failed", error);
      setTrialRequestRows((prev) => prev.map((item) => (item.id === request.id ? request : item)));
      window.alert(error instanceof Error ? error.message : "حدث خطأ");
    } finally {
      setBusyTrialRequestId(null);
    }
  }

  return (
    <div className="min-h-screen bg-[#f7fafc] text-[#0b2447]" dir="rtl">
      {modalType && (
        <AdminModal
          type={modalType}
          initialValues={
            modalType === "school" && editingSchool
              ? { name: editingSchool.name, city: editingSchool.city, school_type: editingSchool.school_type ?? "حكومية" }
              : modalType === "user" && editingUser
                ? { name: editingUser.name, email: editingUser.email, role: editingUser.role, school_id: editingUser.school_id ?? "" }
                : modalType === "question" && editingQuestion
                  ? {
                    subject: editingQuestion.subject,
                    grade: editingQuestion.grade,
                    skill: editingQuestion.skill,
                    difficulty: editingQuestion.difficulty,
                    week_number: String(editingQuestion.week_number || ""),
                    question_text: editingQuestion.question_text,
                    option_a: editingQuestion.options.find((option) => option.option_label === "أ")?.option_text ?? "",
                    option_b: editingQuestion.options.find((option) => option.option_label === "ب")?.option_text ?? "",
                    option_c: editingQuestion.options.find((option) => option.option_label === "ج")?.option_text ?? "",
                    option_d: editingQuestion.options.find((option) => option.option_label === "د")?.option_text ?? "",
                    correct_option: editingQuestion.correct_option,
                    status: editingQuestion.status,
                  }
                : undefined
          }
          schools={schoolRows}
          onSubmit={modalType === "school" ? handleSchoolSubmit : modalType === "user" ? handleUserSubmit : modalType === "question" ? handleQuestionSubmit : undefined}
          onClose={() => { setModalType(null); setEditingSchool(null); setEditingUser(null); setEditingQuestion(null); }}
        />
      )}

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
          {activeTab === "overview" && <OverviewTab overview={overview} state={apiState} onAddSchool={openAddSchoolModal} />}
          {activeTab === "schools" && (
            <SchoolsTab
              schools={schoolRows}
              loading={schoolsLoading}
              onAddSchool={openAddSchoolModal}
              onEditSchool={openEditSchoolModal}
              onDisableSchool={handleDisableSchool}
              busySchoolId={busySchoolId}
            />
          )}
          {activeTab === "users" && (
            <UsersTab
              users={userRows}
              loading={usersLoading}
              busyUserId={busyUserId}
              onAddUser={openAddUserModal}
              onEditUser={openEditUserModal}
              onToggleUserStatus={handleToggleUserStatus}
            />
          )}
          {activeTab === "questions" && (
            <QuestionsTab
              questions={questionRows}
              loading={questionsLoading}
              busyQuestionId={busyQuestionId}
              onAddQuestion={openAddQuestionModal}
              onEditQuestion={openEditQuestionModal}
              onToggleQuestionStatus={handleToggleQuestionStatus}
            />
          )}
          {activeTab === "trialRequests" && (
            <TrialRequestsTab
              requests={trialRequestRows}
              loading={trialRequestsLoading}
              busyTrialRequestId={busyTrialRequestId}
              onUpdateStatus={handleTrialRequestStatus}
            />
          )}
          {activeTab === "reports" && <ReportsTab />}
        </main>
      </div>
    </div>
  );
}
