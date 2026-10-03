"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  BarChart3,
  BookOpenCheck,
  Building2,
  CheckCircle2,
  ClipboardList,
  Download,
  FileJson,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  MoreHorizontal,
  PackageCheck,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  TrendingDown,
  UserRoundCog,
  UsersRound,
} from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { supabase } from "@/lib/supabase";
import { toEnglishDigits } from "@/lib/format";
import { COLORS } from "@/lib/theme";

type Tab = "overview" | "schools" | "users" | "packages" | "trialRequests" | "reports";
type ModalType = "school" | "user";

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
  region?: string | null;
  type?: string;
  principal: string;
  teachers: number;
  students: number;
  status: string;
  score: string;
};

type SchoolFormData = {
  name: string;
  city: string;
  type?: string;
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

type AdminAssessmentPackage = {
  id: string;
  title: string;
  description: string | null;
  subject: string;
  grade: number;
  week_number: number | null;
  assessment_code: string | null;
  package_type: string | null;
  duration_minutes: number | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
  student_pdf_url: string | null;
  questions_pdf_url: string | null;
  teacher_pdf_url: string | null;
  answer_sheet_pdf_url: string | null;
  answer_key_file_url: string | null;
  question_count: number;
  assigned_school_count: number;
  incomplete_question_count: number;
  published_at: string | null;
  created_at: string;
};

type PackageFormData = {
  title: string;
  description: string;
  subject: string;
  grade: string;
  week_number: string;
  assessment_code: string;
  package_type: string;
  duration_minutes: string;
  start_date: string;
  end_date: string;
  student_pdf_url: string;
  questions_pdf_url: string;
  answer_sheet_pdf_url: string;
  answer_key_file_url: string;
  answer_key_json: string;
};

type PackageSubmitData = PackageFormData & {
  questions_pdf_file?: File | null;
};

const ANSWER_KEY_OPTION_LABELS = ["أ", "ب", "ج", "د"] as const;

type AnswerKeyValidationResult = {
  count: number;
  summary: string[];
};

function validateWeeklyAnswerKeyJson(rawValue: string): AnswerKeyValidationResult {
  const raw = rawValue.trim();
  if (!raw) {
    return { count: 0, summary: [] };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("صيغة JSON غير صحيحة.");
  }

  const questions = Array.isArray(parsed)
    ? parsed as Array<Record<string, unknown>>
    : parsed && typeof parsed === "object" && !Array.isArray(parsed) && Array.isArray((parsed as { questions?: unknown }).questions)
      ? (parsed as { questions: Array<Record<string, unknown>> }).questions
      : null;

  if (!questions) {
    throw new Error("صيغة JSON غير صحيحة. يجب أن يحتوي الملف على questions كمصفوفة.");
  }

  if (questions.length === 0) {
    throw new Error("مفتاح الإجابة لا يحتوي على أسئلة.");
  }

  const summary = questions.map((question, index) => {
    const number = Number(question.question_number || index + 1);
    const correctAnswer = typeof question.correct_answer === "string" ? question.correct_answer.trim() : "";
    const skill = typeof question.skill === "string" ? question.skill.trim() : "";
    const domain = typeof question.domain === "string" ? question.domain.trim() : "";
    const difficulty = typeof question.difficulty === "string" ? question.difficulty.trim() : "";
    const options = question.options && typeof question.options === "object" && !Array.isArray(question.options)
      ? question.options as Record<string, unknown>
      : null;

    if (!question.question_number || !Number.isFinite(number)) {
      throw new Error(`السؤال رقم ${number || index + 1} لا يحتوي على رقم سؤال صحيح.`);
    }
    if (!correctAnswer) {
      throw new Error(`السؤال رقم ${number} لا يحتوي على إجابة صحيحة.`);
    }
    if (!ANSWER_KEY_OPTION_LABELS.includes(correctAnswer as (typeof ANSWER_KEY_OPTION_LABELS)[number])) {
      throw new Error(`الإجابة الصحيحة في السؤال رقم ${number} يجب أن تكون أ أو ب أو ج أو د.`);
    }
    if (!skill) {
      throw new Error(`السؤال رقم ${number} لا يحتوي على المهارة.`);
    }
    if (!domain) {
      throw new Error(`السؤال رقم ${number} لا يحتوي على المجال.`);
    }
    if (!difficulty) {
      throw new Error(`السؤال رقم ${number} لا يحتوي على مستوى الصعوبة.`);
    }
    if (!options || ANSWER_KEY_OPTION_LABELS.some((label) => typeof options[label] !== "string" || !String(options[label]).trim())) {
      throw new Error(`السؤال رقم ${number} لا يحتوي على الخيارات الأربعة.`);
    }

    return `سؤال ${toEnglishDigits(number)}: ${correctAnswer} - ${skill}`;
  });

  return { count: questions.length, summary };
}

const ANSWER_KEY_JSON_EXAMPLE = `{
  "questions": [
    {
      "question_number": 1,
      "correct_answer": "ب",
      "skill": "المتوسط الحسابي",
      "domain": "الإحصاء والاحتمال",
      "difficulty": "easy",
      "explanation": "ملاحظة علاجية أو تفسير",
      "options": {
        "أ": "٥",
        "ب": "٦",
        "ج": "٧",
        "د": "٨"
      }
    }
  ]
}`;

const emptyOverview: OverviewData = {
  schools: { total: 0 },
  users: {
    total: 0,
    byRole: {
      admin: 0,
      principal: 0,
      teacher: 0,
    },
  },
  students: { total: 0 },
  questions: { total: 0 },
};

const navItems = [
  { id: "overview", label: "لوحة عامة", icon: LayoutDashboard },
  { id: "schools", label: "المدارس", icon: Building2 },
  { id: "users", label: "المستخدمون", icon: UsersRound },
  { id: "packages", label: "حزم الاختبارات", icon: PackageCheck },
  { id: "trialRequests", label: "طلبات التجربة", icon: ClipboardList },
  { id: "reports", label: "التقارير", icon: BarChart3 },
] satisfies { id: Tab; label: string; icon: typeof LayoutDashboard }[];

function formatNumber(value: number) {
  return toEnglishDigits(new Intl.NumberFormat("en-US").format(value));
}

function packageStatusLabel(value: string) {
  const labels: Record<string, string> = {
    draft: "مسودة",
    published: "منشورة",
    archived: "مؤرشفة",
  };
  return labels[value] ?? value;
}

function packageTypeLabel(value?: string | null) {
  const labels: Record<string, string> = {
    weekly: "أسبوعي",
    nafs_simulation: "محاكاة نافس",
    diagnostic: "تشخيصي",
  };
  return value ? labels[value] ?? value : "أسبوعي";
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
      className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-extrabold text-white shadow-[0_10px_24px_rgba(21,159,145,0.12)] transition hover:bg-brand-dark disabled:opacity-60"
    >
      <Plus className="h-4 w-4" />
      {children}
    </button>
  );
}

function SoftButton({
  children,
  onClick,
  disabled,
  title,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-extrabold text-brand-navy transition hover:border-brand/40 hover:text-brand disabled:cursor-not-allowed disabled:opacity-50"
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
          <p className="mt-3 text-3xl font-black text-brand-navy">{value}</p>
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
        <p className="mb-2 text-sm font-extrabold text-brand">مدير النظام</p>
        <h1 className="text-3xl font-black tracking-normal text-brand-navy">{title}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-500">{description}</p>
      </div>
      {action}
    </div>
  );
}

function SearchBar({
  placeholder,
  value,
  onChange,
}: {
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative w-full md:max-w-sm">
      <Search className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-slate-100 bg-white py-3 pl-4 pr-11 text-sm font-semibold text-brand-navy outline-none transition placeholder:text-slate-300 focus:border-brand/40"
        placeholder={placeholder}
      />
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-2xl border border-rose-100 bg-rose-50 px-5 py-4 text-sm font-bold text-rose-700">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <span>{message}</span>
        <button
          onClick={onRetry}
          className="rounded-xl bg-white px-4 py-2 text-xs font-extrabold text-rose-700 transition hover:bg-rose-100"
        >
          إعادة المحاولة
        </button>
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-5 py-10 text-center text-sm font-extrabold text-slate-400">
      {message}
    </div>
  );
}

function ActionDropdown({
  label,
  onEdit,
  onDisable,
  disabled,
  actionLabel = "إجراء",
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
        className="rounded-xl border border-slate-100 p-2 text-slate-400 transition hover:text-brand disabled:opacity-50"
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
  onSubmit?: (payload: SchoolFormData | UserFormData | Record<string, string>) => Promise<void> | void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const config = {
    school: {
      title: initialValues ? "تعديل مدرسة" : "إضافة مدرسة",
      fields: [
        { name: "name", label: "اسم المدرسة", type: "text" },
        { name: "city", label: "المدينة", type: "text" },
        { name: "type", label: "نوع المدرسة", type: "schoolType" },
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-navy/40 px-4" dir="rtl">
      <div className="w-full max-w-md rounded-[1.5rem] border border-slate-100 bg-white p-6 shadow-[0_22px_70px_rgba(15,35,55,0.14)]">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-black text-brand-navy">{config.title}</h2>
          <button onClick={onClose} className="rounded-xl px-3 py-1 text-xl font-bold text-slate-400 hover:bg-slate-50">
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {config.fields.map((field) => (
            <label key={field.name} className="block">
              <span className="mb-2 block text-sm font-extrabold text-slate-500">{field.label}</span>
              {field.type === "select" ? (
                <select name={field.name} defaultValue={initialValues?.[field.name]} className="w-full rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-bold text-brand-navy outline-none transition focus:border-brand/40 focus:bg-white">
                  <option value="admin">admin</option>
                  <option value="principal">principal</option>
                  <option value="teacher">teacher</option>
                </select>
              ) : field.type === "schoolType" ? (
                <select name={field.name} defaultValue={initialValues?.[field.name] ?? "حكومية"} className="w-full rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-bold text-brand-navy outline-none transition focus:border-brand/40 focus:bg-white">
                  <option value="حكومية">حكومية</option>
                  <option value="أهلية">أهلية</option>
                  <option value="عالمية">عالمية</option>
                </select>
              ) : field.type === "school" ? (
                <select name={field.name} defaultValue={initialValues?.[field.name] ?? ""} className="w-full rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-bold text-brand-navy outline-none transition focus:border-brand/40 focus:bg-white">
                  <option value="">بدون مدرسة</option>
                  {(schools ?? []).map((school) => (
                    <option key={school.id} value={school.id}>{school.name}</option>
                  ))}
                </select>
              ) : (
                <input name={field.name} required={(type === "school" && ["name", "city"].includes(field.name)) || (type === "user" && ["name", "email"].includes(field.name))} defaultValue={initialValues?.[field.name]} type={field.type} className="w-full rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-bold text-brand-navy outline-none transition focus:border-brand/40 focus:bg-white" />
              )}
            </label>
          ))}
          {formError && (
            <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
              {formError}
            </div>
          )}
          <button disabled={submitting} className="w-full rounded-xl bg-brand py-3 text-sm font-extrabold text-white transition hover:bg-brand-dark disabled:opacity-60">
            {submitting ? "جارٍ الحفظ..." : "حفظ"}
          </button>
        </form>
      </div>
    </div>
  );
}

function OverviewTab({
  overview,
  state,
  error,
  onAddSchool,
  onRetry,
}: {
  overview: OverviewData;
  state: ApiState;
  error: string | null;
  onAddSchool: () => void;
  onRetry: () => void;
}) {
  const stats = [
    {
      title: "المدارس",
      value: formatNumber(overview.schools.total),
      hint: "عدد المدارس المسجلة في المنصة",
      icon: Building2,
      accent: COLORS.brand,
    },
    {
      title: "المستخدمون",
      value: formatNumber(overview.users.total),
      hint: `admin ${overview.users.byRole.admin} · principal ${overview.users.byRole.principal} · teacher ${overview.users.byRole.teacher}`,
      icon: UsersRound,
      accent: COLORS.navy,
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
            <SoftButton disabled title="قريبًا">
              <Download className="h-4 w-4" />
              تصدير ملخص · قريبًا
            </SoftButton>
            <PrimaryButton onClick={onAddSchool}>إضافة مدرسة</PrimaryButton>
          </div>
        }
      />

      {state === "error" && (
        <ErrorState message={`${error ?? "تعذر تحميل الإحصاءات الحية"}. لا يتم عرض بيانات تجريبية بدل البيانات الفعلية.`} onRetry={onRetry} />
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
              <h2 className="text-lg font-black text-brand-navy">آخر النشاطات</h2>
              <p className="mt-1 text-sm text-slate-400">سيتم ربطها بسجل نشاط فعلي في مرحلة لاحقة</p>
            </div>
            <Activity className="h-5 w-5 text-brand" />
          </div>
          <EmptyState message="لا توجد نشاطات فعلية مرتبطة بعد." />
        </div>

        <div className="rounded-[1.5rem] border border-slate-100 bg-white p-6 shadow-[0_10px_34px_rgba(15,35,55,0.035)]">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black text-brand-navy">المهارات الأضعف</h2>
              <p className="mt-1 text-sm text-slate-400">ستظهر بعد ربط نتائج الحزم والتصحيح</p>
            </div>
            <TrendingDown className="h-5 w-5 text-rose-500" />
          </div>
          <EmptyState message="لا توجد نتائج فعلية كافية لحساب المهارات الأضعف." />
        </div>
      </div>
    </div>
  );
}

function SchoolsTab({
  schools,
  loading,
  error,
  search,
  onSearchChange,
  onRetry,
  onAddSchool,
  onEditSchool,
  onDisableSchool,
  busySchoolId,
}: {
  schools: AdminSchool[];
  loading: boolean;
  error: string | null;
  search: string;
  onSearchChange: (value: string) => void;
  onRetry: () => void;
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
      {error && <ErrorState message={error} onRetry={onRetry} />}
      <div className="rounded-[1.5rem] border border-slate-100 bg-white shadow-[0_10px_34px_rgba(15,35,55,0.035)]">
        <div className="flex flex-col gap-4 border-b border-slate-100 p-5 md:flex-row md:items-center md:justify-between">
          <SearchBar placeholder="ابحث باسم المدرسة أو المدينة" value={search} onChange={onSearchChange} />
          <SoftButton disabled title="قريبًا">
            <Settings className="h-4 w-4" />
            {loading ? "جارٍ تحميل المدارس..." : "إعدادات المدارس · قريبًا"}
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
                  <td className="px-5 py-4 font-extrabold text-brand-navy">{school.name}</td>
                  <td className="px-5 py-4 font-bold text-slate-500">{school.city}</td>
                  <td className="px-5 py-4 font-bold text-slate-500">{school.principal}</td>
                  <td className="px-5 py-4 font-bold text-slate-500">{school.teachers}</td>
                  <td className="px-5 py-4 font-bold text-slate-500">{formatNumber(school.students)}</td>
                  <td className="px-5 py-4 font-extrabold text-brand">{school.score}</td>
                  <td className="px-5 py-4"><StatusBadge status={school.status} /></td>
                  <td className="px-5 py-4">
                    <ActionDropdown
                      label={school.name}
                      onEdit={() => onEditSchool(school)}
                      onDisable={() => onDisableSchool(school)}
                      disabled={busySchoolId === school.id}
                      actionLabel="إيقاف المدرسة"
                    />
                  </td>
                </tr>
              ))}
              {!loading && schools.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-10">
                    <EmptyState message={search ? "لا توجد مدارس مطابقة للبحث." : "لا توجد مدارس فعلية حتى الآن."} />
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

function UsersTab({
  users,
  loading,
  error,
  search,
  onSearchChange,
  onRetry,
  busyUserId,
  onAddUser,
  onEditUser,
  onToggleUserStatus,
}: {
  users: AdminUser[];
  loading: boolean;
  error: string | null;
  search: string;
  onSearchChange: (value: string) => void;
  onRetry: () => void;
  busyUserId: string | null;
  onAddUser: () => void;
  onEditUser: (user: AdminUser) => void;
  onToggleUserStatus: (user: AdminUser) => void;
}) {
  const roleLabel: Record<string, string> = {
    admin: "مدير نظام",
    principal: "مدير مدرسة",
    supervisor: "مشرف",
    teacher: "معلم",
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="إدارة المستخدمين"
        description="إنشاء حسابات وربط المستخدمين بالمدارس مع تحديد الدور المناسب: admin أو principal أو teacher."
        action={<PrimaryButton onClick={onAddUser} disabled={Boolean(busyUserId)}>إضافة مستخدم</PrimaryButton>}
      />
      {error && <ErrorState message={error} onRetry={onRetry} />}
      <div className="rounded-[1.5rem] border border-slate-100 bg-white shadow-[0_10px_34px_rgba(15,35,55,0.035)]">
        <div className="flex flex-col gap-4 border-b border-slate-100 p-5 md:flex-row md:items-center md:justify-between">
          <SearchBar placeholder="ابحث بالاسم أو البريد" value={search} onChange={onSearchChange} />
          <div className="flex gap-2">
            {loading && (
              <span className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs font-extrabold text-slate-500">
                جارٍ تحميل المستخدمين...
              </span>
            )}
            {["admin", "principal", "teacher"].map((role) => (
              <button key={role} disabled title="قريبًا" className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs font-extrabold text-slate-500 opacity-60">
                {roleLabel[role]}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-4">
          {users.map((user) => (
            <div key={user.id} className="rounded-2xl border border-slate-100 bg-slate-50/50 p-5">
              <div className="mb-5 flex items-start justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-brand">
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
              <h3 className="font-black text-brand-navy">{user.name}</h3>
              <p className="mt-1 text-xs font-semibold text-slate-400" dir="ltr">{user.email}</p>
              <div className="mt-5 space-y-2 text-sm font-bold text-slate-500">
                <div className="flex justify-between gap-3">
                  <span>الدور</span>
                  <span className="text-brand-navy">{roleLabel[user.role] ?? user.role}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span>المدرسة</span>
                  <span className="text-brand-navy">{user.school}</span>
                </div>
              </div>
            </div>
          ))}
          {!loading && users.length === 0 && (
            <div className="md:col-span-2 xl:col-span-4">
              <EmptyState message={search ? "لا يوجد مستخدمون مطابقون للبحث." : "لا يوجد مستخدمون فعليون حتى الآن."} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TrialRequestsTab({
  requests,
  loading,
  error,
  onRetry,
  busyTrialRequestId,
  onUpdateStatus,
}: {
  requests: AdminTrialRequest[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
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
      {error && <ErrorState message={error} onRetry={onRetry} />}

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
                  <td className="px-5 py-4 font-extrabold text-brand-navy">{request.name}</td>
                  <td className="px-5 py-4 font-bold text-slate-500">{request.school_name}</td>
                  <td className="px-5 py-4 font-bold text-slate-500">{request.phone}</td>
                  <td className="px-5 py-4 font-bold text-slate-500">{request.email}</td>
                  <td className="px-5 py-4"><StatusBadge status={request.status} /></td>
                  <td className="px-5 py-4 font-bold text-slate-500">
                    {request.created_at ? toEnglishDigits(new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(request.created_at))) : "—"}
                  </td>
                  <td className="px-5 py-4">
                    <select
                      value={request.status}
                      disabled={busyTrialRequestId === request.id}
                      onChange={(event) => onUpdateStatus(request, event.target.value)}
                      className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs font-extrabold text-brand-navy outline-none transition focus:border-brand/40 focus:bg-white disabled:opacity-60"
                    >
                      <option value="new">جديد</option>
                      <option value="contacted">تم التواصل</option>
                      <option value="closed">مغلق</option>
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

function PackageModal({
  initialValues,
  onClose,
  onSubmit,
}: {
  initialValues?: AdminAssessmentPackage | null;
  onClose: () => void;
  onSubmit: (payload: PackageSubmitData) => Promise<void>;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [questionsPdfFile, setQuestionsPdfFile] = useState<File | null>(null);
  const [answerKeyJson, setAnswerKeyJson] = useState("");
  const [answerKeyValidation, setAnswerKeyValidation] = useState<AnswerKeyValidationResult | null>(null);
  const [answerKeyValidationError, setAnswerKeyValidationError] = useState<string | null>(null);

  function handleValidateAnswerKey() {
    try {
      const result = validateWeeklyAnswerKeyJson(answerKeyJson);
      setAnswerKeyValidation(result);
      setAnswerKeyValidationError(null);
    } catch (err) {
      setAnswerKeyValidation(null);
      setAnswerKeyValidationError(err instanceof Error ? err.message : "صيغة JSON غير صحيحة.");
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const payload = Object.fromEntries(formData.entries()) as PackageFormData;
    try {
      setSubmitting(true);
      setError(null);
      const trimmedAnswerKey = answerKeyJson.trim();
      if (trimmedAnswerKey) {
        validateWeeklyAnswerKeyJson(trimmedAnswerKey);
      }
      await onSubmit({ ...payload, questions_pdf_file: questionsPdfFile } as PackageSubmitData);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر حفظ الحزمة");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-navy/40 px-4" dir="rtl">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-[1.5rem] border border-slate-100 bg-white p-6 shadow-[0_22px_70px_rgba(15,35,55,0.14)]">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-black text-brand-navy">{initialValues ? "تعديل حزمة اختبار" : "إنشاء حزمة اختبار"}</h2>
          <button onClick={onClose} className="rounded-xl px-3 py-1 text-xl font-bold text-slate-400 hover:bg-slate-50">×</button>
        </div>
        {error && <div className="mb-4 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</div>}
        <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
          <label className="md:col-span-2">
            <span className="mb-2 block text-sm font-extrabold text-slate-500">عنوان الحزمة</span>
            <input name="title" required defaultValue={initialValues?.title ?? ""} className="w-full rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-bold text-brand-navy outline-none focus:border-brand/40 focus:bg-white" />
          </label>
          <label className="md:col-span-2">
            <span className="mb-2 block text-sm font-extrabold text-slate-500">الوصف</span>
            <textarea name="description" rows={3} defaultValue={initialValues?.description ?? ""} className="w-full rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-bold text-brand-navy outline-none focus:border-brand/40 focus:bg-white" />
          </label>
          <label>
            <span className="mb-2 block text-sm font-extrabold text-slate-500">المادة</span>
            <select name="subject" defaultValue={initialValues?.subject ?? "رياضيات"} className="w-full rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-bold text-brand-navy outline-none focus:border-brand/40 focus:bg-white">
              <option value="رياضيات">رياضيات</option>
              <option value="لغة عربية">لغة عربية</option>
              <option value="علوم">علوم</option>
            </select>
          </label>
          <label>
            <span className="mb-2 block text-sm font-extrabold text-slate-500">الصف</span>
            <select name="grade" defaultValue={String(initialValues?.grade ?? 6)} className="w-full rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-bold text-brand-navy outline-none focus:border-brand/40 focus:bg-white">
              {[3, 4, 5, 6].map((grade) => <option key={grade} value={grade}>{toEnglishDigits(grade)}</option>)}
            </select>
          </label>
          <label>
            <span className="mb-2 block text-sm font-extrabold text-slate-500">رقم الأسبوع</span>
            <input name="week_number" type="number" min={1} defaultValue={initialValues?.week_number ?? ""} className="w-full rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-bold text-brand-navy outline-none focus:border-brand/40 focus:bg-white" />
          </label>
          <label>
            <span className="mb-2 block text-sm font-extrabold text-slate-500">رقم النموذج</span>
            <input name="assessment_code" defaultValue={initialValues?.assessment_code ?? ""} placeholder="مثال: M4-W03-A" className="w-full rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-bold text-brand-navy outline-none focus:border-brand/40 focus:bg-white" />
          </label>
          <label>
            <span className="mb-2 block text-sm font-extrabold text-slate-500">نوع الحزمة</span>
            <select name="package_type" defaultValue={initialValues?.package_type ?? "weekly"} className="w-full rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-bold text-brand-navy outline-none focus:border-brand/40 focus:bg-white">
              <option value="weekly">أسبوعي</option>
              <option value="diagnostic">تشخيصي</option>
              <option value="nafs_simulation">محاكاة نافس</option>
            </select>
          </label>
          <label>
            <span className="mb-2 block text-sm font-extrabold text-slate-500">مدة الاختبار بالدقائق</span>
            <input name="duration_minutes" type="number" min={1} defaultValue={initialValues?.duration_minutes ?? ""} className="w-full rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-bold text-brand-navy outline-none focus:border-brand/40 focus:bg-white" />
          </label>
          <label>
            <span className="mb-2 block text-sm font-extrabold text-slate-500">تاريخ البداية</span>
            <input name="start_date" type="date" defaultValue={initialValues?.start_date ?? ""} className="w-full rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-bold text-brand-navy outline-none focus:border-brand/40 focus:bg-white" />
          </label>
          <label>
            <span className="mb-2 block text-sm font-extrabold text-slate-500">تاريخ النهاية</span>
            <input name="end_date" type="date" defaultValue={initialValues?.end_date ?? ""} className="w-full rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-bold text-brand-navy outline-none focus:border-brand/40 focus:bg-white" />
          </label>
          <label className="md:col-span-2">
            <span className="mb-2 block text-sm font-extrabold text-slate-500">ملف الأسئلة PDF</span>
            <input
              type="file"
              accept="application/pdf"
              onChange={(event) => setQuestionsPdfFile(event.target.files?.[0] ?? null)}
              className="w-full rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-bold text-brand-navy outline-none focus:border-brand/40 focus:bg-white"
            />
            {initialValues?.questions_pdf_url || initialValues?.student_pdf_url ? (
              <a
                href={initialValues.questions_pdf_url ?? initialValues.student_pdf_url ?? ""}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex text-xs font-extrabold text-brand"
              >
                عرض الملف الحالي
              </a>
            ) : null}
          </label>
          <label className="md:col-span-2">
            <span className="mb-2 block text-sm font-extrabold text-slate-500">رابط ملف الأسئلة PDF</span>
            <input name="questions_pdf_url" type="url" defaultValue={initialValues?.questions_pdf_url ?? initialValues?.student_pdf_url ?? ""} className="w-full rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-bold text-brand-navy outline-none focus:border-brand/40 focus:bg-white" />
          </label>
          <label className="md:col-span-2">
            <span className="mb-2 block text-sm font-extrabold text-slate-500">رابط ورقة الإجابة PDF اختياري</span>
            <input name="answer_sheet_pdf_url" type="url" defaultValue={initialValues?.answer_sheet_pdf_url ?? ""} className="w-full rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-bold text-brand-navy outline-none focus:border-brand/40 focus:bg-white" />
          </label>
          <section className="md:col-span-2 rounded-2xl border border-brand/15 bg-brand/[0.04] p-4">
            <div className="mb-3">
              <h3 className="text-base font-black text-brand-navy">مفتاح الإجابة والمهارات</h3>
              <p className="mt-1 text-xs font-bold leading-6 text-slate-500">
                ألصق مفتاح الإجابة بصيغة JSON. سيتم حفظه للأدمن فقط وتحويله إلى أسئلة وخيارات للتصحيح الآلي من السيرفر.
              </p>
            </div>
            <label>
              <span className="mb-2 block text-sm font-extrabold text-slate-500">مفتاح الإجابة والمهارات بصيغة JSON</span>
              <textarea
                name="answer_key_json"
                rows={10}
                value={answerKeyJson}
                onChange={(event) => {
                  setAnswerKeyJson(event.target.value);
                  setAnswerKeyValidation(null);
                  setAnswerKeyValidationError(null);
                }}
                placeholder={ANSWER_KEY_JSON_EXAMPLE}
                className="w-full rounded-xl border border-slate-100 bg-white px-4 py-3 font-mono text-xs font-bold leading-6 text-brand-navy outline-none focus:border-brand/40"
              />
            </label>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleValidateAnswerKey}
                className="rounded-xl border border-brand/25 bg-white px-4 py-2 text-xs font-extrabold text-brand"
              >
                التحقق من JSON
              </button>
              {answerKeyValidation ? (
                <span className="text-xs font-extrabold text-brand">
                  تم التحقق من {toEnglishDigits(answerKeyValidation.count)} سؤال
                </span>
              ) : null}
              {answerKeyValidationError ? (
                <span className="text-xs font-extrabold text-rose-600">{answerKeyValidationError}</span>
              ) : null}
            </div>
            {answerKeyValidation?.summary.length ? (
              <div className="mt-3 rounded-xl border border-emerald-100 bg-white px-4 py-3">
                <p className="mb-2 text-xs font-black text-brand-navy">ملخص المفتاح</p>
                <div className="space-y-1 text-xs font-bold text-slate-600">
                  {answerKeyValidation.summary.slice(0, 8).map((item) => (
                    <p key={item}>{item}</p>
                  ))}
                  {answerKeyValidation.summary.length > 8 ? (
                    <p className="text-slate-400">و{toEnglishDigits(answerKeyValidation.summary.length - 8)} أسئلة أخرى...</p>
                  ) : null}
                </div>
              </div>
            ) : null}
            <details className="mt-3 rounded-xl border border-slate-100 bg-white px-4 py-3">
              <summary className="cursor-pointer text-xs font-black text-slate-500">مثال على الصيغة المطلوبة</summary>
              <pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-left font-mono text-xs leading-6 text-slate-600" dir="ltr">
                {ANSWER_KEY_JSON_EXAMPLE}
              </pre>
            </details>
          </section>
          <label className="md:col-span-2">
            <span className="mb-2 block text-sm font-extrabold text-slate-500">خيار متقدم: رابط ملف مفتاح الإجابة والمهارات اختياري</span>
            <input name="answer_key_file_url" type="url" defaultValue={initialValues?.answer_key_file_url ?? ""} className="w-full rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-bold text-brand-navy outline-none focus:border-brand/40 focus:bg-white" />
          </label>
          <div className="flex gap-3 md:col-span-2">
            <button disabled={submitting} className="flex-1 rounded-xl bg-brand px-5 py-3 text-sm font-extrabold text-white disabled:opacity-60">
              {submitting ? "جارٍ الحفظ..." : "حفظ الحزمة"}
            </button>
            <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-extrabold text-slate-500">إلغاء</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function QuestionImportModal({
  assessmentPackage,
  onClose,
  onSubmit,
}: {
  assessmentPackage: AdminAssessmentPackage;
  onClose: () => void;
  onSubmit: (jsonText: string) => Promise<void>;
}) {
  const [text, setText] = useState("");
  const [validation, setValidation] = useState<AnswerKeyValidationResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleValidate() {
    try {
      setValidation(validateWeeklyAnswerKeyJson(text));
      setError(null);
    } catch (err) {
      setValidation(null);
      setError(err instanceof Error ? err.message : "صيغة JSON غير صحيحة.");
    }
  }

  async function handleSubmit() {
    try {
      setSubmitting(true);
      setError(null);
      validateWeeklyAnswerKeyJson(text);
      await onSubmit(text);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر استيراد الأسئلة");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-navy/40 px-4" dir="rtl">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-[1.5rem] border border-slate-100 bg-white p-6 shadow-[0_22px_70px_rgba(15,35,55,0.14)]">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-brand-navy">استيراد مفتاح الإجابة</h2>
            <p className="mt-1 text-sm font-bold text-slate-400">{assessmentPackage.title}</p>
          </div>
          <button onClick={onClose} className="rounded-xl px-3 py-1 text-xl font-bold text-slate-400 hover:bg-slate-50">×</button>
        </div>
        {error && <div className="mb-4 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</div>}
        <div className="mb-3 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-bold leading-7 text-amber-700">
          ألصق مفتاح الإجابة والمهارات بصيغة JSON العربية البسيطة. لا نحتاج UUID للمهارة أو المجال في هذه المرحلة. هذه البيانات تحتوي مفتاح الإجابة ولا تظهر للمعلم أو قائد المدرسة.
        </div>
        <textarea
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setValidation(null);
          }}
          rows={16}
          dir="ltr"
          placeholder={ANSWER_KEY_JSON_EXAMPLE}
          className="w-full rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 font-mono text-sm text-brand-navy outline-none focus:border-brand/40 focus:bg-white"
        />
        {validation ? (
          <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-bold leading-7 text-emerald-700">
            <p>تم التحقق من {toEnglishDigits(validation.count)} سؤال.</p>
            {validation.summary.slice(0, 6).map((item) => (
              <p key={item}>{item}</p>
            ))}
          </div>
        ) : null}
        <details className="mt-3 rounded-xl border border-slate-100 bg-white px-4 py-3">
          <summary className="cursor-pointer text-xs font-black text-slate-500">مثال على الصيغة المطلوبة</summary>
          <pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-left font-mono text-xs leading-6 text-slate-600" dir="ltr">
            {ANSWER_KEY_JSON_EXAMPLE}
          </pre>
        </details>
        <div className="mt-4 flex gap-3">
          <button onClick={handleValidate} type="button" className="rounded-xl border border-brand/25 bg-white px-5 py-3 text-sm font-extrabold text-brand">
            التحقق من JSON
          </button>
          <button onClick={handleSubmit} disabled={submitting} className="rounded-xl bg-brand px-5 py-3 text-sm font-extrabold text-white disabled:opacity-60">
            {submitting ? "جارٍ الاستيراد..." : "استيراد واستبدال الأسئلة"}
          </button>
          <button onClick={onClose} className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-extrabold text-slate-500">إلغاء</button>
        </div>
      </div>
    </div>
  );
}

function PublishPackageModal({
  assessmentPackage,
  schools,
  onClose,
  onSubmit,
}: {
  assessmentPackage: AdminAssessmentPackage;
  schools: AdminSchool[];
  onClose: () => void;
  onSubmit: (schoolIds: string[]) => Promise<void>;
}) {
  const activeSchools = schools.filter((school) => school.status !== "موقوفة");
  const [selected, setSelected] = useState<string[]>(activeSchools.map((school) => school.id));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string) {
    setSelected((prev) => prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]);
  }

  async function handleSubmit() {
    try {
      setSubmitting(true);
      setError(null);
      await onSubmit(selected);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر نشر الحزمة");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-navy/40 px-4" dir="rtl">
      <div className="w-full max-w-xl rounded-[1.5rem] border border-slate-100 bg-white p-6 shadow-[0_22px_70px_rgba(15,35,55,0.14)]">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-brand-navy">نشر الحزمة للمدارس</h2>
            <p className="mt-1 text-sm font-bold text-slate-400">{assessmentPackage.title}</p>
          </div>
          <button onClick={onClose} className="rounded-xl px-3 py-1 text-xl font-bold text-slate-400 hover:bg-slate-50">×</button>
        </div>
        {error && <div className="mb-4 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</div>}
        <div className="max-h-72 space-y-2 overflow-y-auto">
          {activeSchools.map((school) => (
            <label key={school.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-bold text-brand-navy">
              <input type="checkbox" checked={selected.includes(school.id)} onChange={() => toggle(school.id)} />
              <span>{school.name}</span>
              <span className="text-slate-400">{school.city}</span>
            </label>
          ))}
          {!activeSchools.length && <EmptyState message="لا توجد مدارس نشطة للنشر." />}
        </div>
        <div className="mt-5 flex gap-3">
          <button onClick={handleSubmit} disabled={submitting || selected.length === 0} className="rounded-xl bg-brand px-5 py-3 text-sm font-extrabold text-white disabled:opacity-60">
            {submitting ? "جارٍ النشر..." : "نشر الحزمة"}
          </button>
          <button onClick={onClose} className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-extrabold text-slate-500">إلغاء</button>
        </div>
      </div>
    </div>
  );
}

function PackagesTab({
  packages,
  loading,
  error,
  search,
  onSearch,
  onRetry,
  onCreate,
  onEdit,
  onImport,
  onPublish,
  onApplyClasses,
  onWithdraw,
  onArchive,
  busyPackageId,
}: {
  packages: AdminAssessmentPackage[];
  loading: boolean;
  error: string | null;
  search: string;
  onSearch: (value: string) => void;
  onRetry: () => void;
  onCreate: () => void;
  onEdit: (item: AdminAssessmentPackage) => void;
  onImport: (item: AdminAssessmentPackage) => void;
  onPublish: (item: AdminAssessmentPackage) => void;
  onApplyClasses: (item: AdminAssessmentPackage) => void;
  onWithdraw: (item: AdminAssessmentPackage) => void;
  onArchive: (item: AdminAssessmentPackage) => void;
  busyPackageId: string | null;
}) {
  return (
    <div className="space-y-8">
      <PageHeader
        title="حزم الاختبارات"
        description="إنشاء حزم مقياس الأسبوعية، ربط ملفات PDF، استيراد مفتاح الإجابة وخريطة المهارات، ثم نشرها للمدارس."
        action={<PrimaryButton onClick={onCreate}>إنشاء حزمة</PrimaryButton>}
      />
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <SearchBar placeholder="ابحث بعنوان الحزمة أو المادة أو الحالة..." value={search} onChange={onSearch} />
        <SoftButton disabled title="Excel قريبًا">
          <FileJson className="h-4 w-4" />
          استيراد Excel · قريبًا
        </SoftButton>
      </div>
      {error && <ErrorState message={error} onRetry={onRetry} />}
      <div className="grid gap-4">
        {packages.map((item) => {
          const pdfReady = Boolean(item.questions_pdf_url || item.student_pdf_url);
          const readiness = !pdfReady
            ? { label: "ناقصة ملف الأسئلة", color: COLORS.warning, bg: "#fffbeb" }
            : item.question_count <= 0
              ? { label: "ناقصة مفتاح الإجابة", color: COLORS.warning, bg: "#fffbeb" }
              : item.incomplete_question_count > 0
                ? { label: "تحتاج ربط مهارات", color: COLORS.danger, bg: "#fff5f5" }
                : item.status !== "published" || item.assigned_school_count <= 0
                  ? { label: "غير منشورة", color: "#64748b", bg: "#f8fafc" }
                  : { label: "جاهزة للتجربة", color: COLORS.brand, bg: "#f0fdf8" };
          const busy = busyPackageId === item.id;
          return (
            <div key={item.id} className="rounded-[1.5rem] border border-slate-100 bg-white p-5 shadow-[0_10px_34px_rgba(15,35,55,0.035)]">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={packageStatusLabel(item.status)} />
                    <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-bold text-slate-500">{packageTypeLabel(item.package_type)}</span>
                    <span className="rounded-full px-3 py-1 text-xs font-bold" style={{ color: readiness.color, background: readiness.bg }}>{readiness.label}</span>
                    <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-bold text-slate-500">{item.subject}</span>
                    <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-bold text-slate-500">صف {toEnglishDigits(item.grade)}</span>
                  </div>
                  <h3 className="mt-3 text-xl font-black text-brand-navy">{item.title}</h3>
                  <p className="mt-2 text-sm font-bold text-slate-400">
                    الأسبوع {toEnglishDigits(item.week_number ?? "—")} · نموذج {toEnglishDigits(item.assessment_code ?? "—")} · {toEnglishDigits(item.duration_minutes ?? "—")} دقيقة
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
                  <div className="rounded-xl bg-slate-50 px-4 py-3">
                    <div className="text-lg font-black text-brand-navy">{toEnglishDigits(item.question_count)}</div>
                    <div className="text-xs font-bold text-slate-400">سؤال</div>
                  </div>
                  <div className="rounded-xl bg-slate-50 px-4 py-3">
                    <div className="text-lg font-black text-brand-navy">{toEnglishDigits(item.assigned_school_count)}</div>
                    <div className="text-xs font-bold text-slate-400">مدرسة</div>
                  </div>
                  <div className="rounded-xl bg-slate-50 px-4 py-3">
                    <div className={`text-lg font-black ${pdfReady ? "text-brand" : "text-amber-600"}`}>{pdfReady ? "جاهز" : "ناقص"}</div>
                    <div className="text-xs font-bold text-slate-400">ملف الأسئلة</div>
                  </div>
                  <div className="rounded-xl bg-slate-50 px-4 py-3">
                    <div className="text-lg font-black text-brand-navy">{item.published_at ? "نُشر" : "—"}</div>
                    <div className="text-xs font-bold text-slate-400">النشر</div>
                  </div>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <SoftButton onClick={() => onEdit(item)} disabled={busy}>تعديل</SoftButton>
                <SoftButton onClick={() => onImport(item)} disabled={busy}>استيراد/تعديل مفتاح الإجابة</SoftButton>
                <SoftButton onClick={() => onPublish(item)} disabled={busy || item.status === "archived"}>نشر للمدارس</SoftButton>
                <SoftButton onClick={() => onApplyClasses(item)} disabled={busy || item.status !== "published"}>تطبيق على كل الفصول المطابقة</SoftButton>
                <SoftButton onClick={() => onWithdraw(item)} disabled={busy || item.status !== "published"}>سحب من المدارس</SoftButton>
                <SoftButton onClick={() => onArchive(item)} disabled={busy || item.status === "archived"} title={item.status === "archived" ? "مؤرشفة بالفعل" : undefined}>
                  أرشفة
                </SoftButton>
              </div>
            </div>
          );
        })}
        {!loading && packages.length === 0 && (
          <EmptyState message="لا توجد حزم اختبارات بعد. أنشئ أول حزمة للأسبوع التجريبي." />
        )}
        {loading && <EmptyState message="جارٍ تحميل حزم الاختبارات..." />}
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
          <SoftButton disabled title="قريبًا">
            <Download className="h-4 w-4" />
            تصدير التقرير · قريبًا
          </SoftButton>
        }
      />
      <div className="rounded-[1.5rem] border border-slate-100 bg-white p-6 shadow-[0_10px_34px_rgba(15,35,55,0.035)]">
        <h2 className="text-lg font-black text-brand-navy">تقارير النظام</h2>
        <p className="mt-2 text-sm font-bold leading-7 text-slate-500">
          لا يتم عرض مؤشرات تجريبية في لوحة الإدارة. ستظهر التقارير هنا بعد ربط نتائج الحزم وبيانات المدارس الفعلية.
        </p>
        <div className="mt-6">
          <EmptyState message="لا توجد تقارير فعلية جاهزة بعد." />
        </div>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [modalType, setModalType] = useState<ModalType | null>(null);
  const [editingSchool, setEditingSchool] = useState<AdminSchool | null>(null);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [editingPackage, setEditingPackage] = useState<AdminAssessmentPackage | null>(null);
  const [packageModalOpen, setPackageModalOpen] = useState(false);
  const [importingPackage, setImportingPackage] = useState<AdminAssessmentPackage | null>(null);
  const [publishingPackage, setPublishingPackage] = useState<AdminAssessmentPackage | null>(null);
  const [schoolRows, setSchoolRows] = useState<AdminSchool[]>([]);
  const [userRows, setUserRows] = useState<AdminUser[]>([]);
  const [packageRows, setPackageRows] = useState<AdminAssessmentPackage[]>([]);
  const [trialRequestRows, setTrialRequestRows] = useState<AdminTrialRequest[]>([]);
  const [schoolsLoading, setSchoolsLoading] = useState(false);
  const [usersLoading, setUsersLoading] = useState(false);
  const [packagesLoading, setPackagesLoading] = useState(false);
  const [trialRequestsLoading, setTrialRequestsLoading] = useState(false);
  const [schoolsError, setSchoolsError] = useState<string | null>(null);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [packagesError, setPackagesError] = useState<string | null>(null);
  const [trialRequestsError, setTrialRequestsError] = useState<string | null>(null);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [schoolSearch, setSchoolSearch] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [packageSearch, setPackageSearch] = useState("");
  const [busySchoolId, setBusySchoolId] = useState<string | null>(null);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [busyPackageId, setBusyPackageId] = useState<string | null>(null);
  const [busyTrialRequestId, setBusyTrialRequestId] = useState<string | null>(null);
  const [overview, setOverview] = useState<OverviewData>(emptyOverview);
  const [apiState, setApiState] = useState<ApiState>("idle");
  const [loggingOut, setLoggingOut] = useState(false);

  const activeTitle = useMemo(() => navItems.find((item) => item.id === activeTab)?.label ?? "لوحة عامة", [activeTab]);

  const filteredSchools = useMemo(() => {
    const query = schoolSearch.trim().toLowerCase();
    if (!query) return schoolRows;
    return schoolRows.filter((school) =>
      [school.name, school.city, school.region ?? "", school.type ?? "", school.status]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [schoolRows, schoolSearch]);

  const filteredUsers = useMemo(() => {
    const query = userSearch.trim().toLowerCase();
    if (!query) return userRows;
    return userRows.filter((user) =>
      [user.name, user.email, user.role, user.school, user.status]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [userRows, userSearch]);

  const filteredPackages = useMemo(() => {
    const query = packageSearch.trim().toLowerCase();
    if (!query) return packageRows;
    return packageRows.filter((item) =>
      [item.title, item.subject, item.status, packageTypeLabel(item.package_type), String(item.grade), String(item.week_number ?? "")]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [packageRows, packageSearch]);

  const loadOverview = useCallback(async () => {
    setApiState("loading");
    setOverviewError(null);
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.replace("/login");
      return;
    }

    try {
      const res = await fetch("/api/admin/overview", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "فشل تحميل بيانات لوحة الإدارة");
      }
      setOverview(json.data);
      setApiState("ready");
    } catch (error) {
      const message = error instanceof Error ? error.message : "فشل تحميل بيانات لوحة الإدارة";
      console.error("load admin overview failed", error);
      setOverview(emptyOverview);
      setOverviewError(message);
      setApiState("error");
    }
  }, [router]);

  const loadSchools = useCallback(async () => {
    setSchoolsLoading(true);
    setSchoolsError(null);
    try {
      const res = await fetch("/api/admin/schools", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "فشل تحميل المدارس");
      setSchoolRows(json.data);
    } catch (error) {
      console.error("load admin schools failed", error);
      setSchoolRows([]);
      setSchoolsError(error instanceof Error ? error.message : "فشل تحميل المدارس");
    } finally {
      setSchoolsLoading(false);
    }
  }, []);

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    setUsersError(null);
    try {
      const res = await fetch("/api/admin/users", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "فشل تحميل المستخدمين");
      setUserRows(json.data);
    } catch (error) {
      console.error("load admin users failed", error);
      setUserRows([]);
      setUsersError(error instanceof Error ? error.message : "فشل تحميل المستخدمين");
    } finally {
      setUsersLoading(false);
    }
  }, []);

  const loadPackages = useCallback(async () => {
    setPackagesLoading(true);
    setPackagesError(null);
    try {
      const res = await fetch("/api/admin/assessment-packages", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "فشل تحميل حزم الاختبارات");
      setPackageRows(json.data);
    } catch (error) {
      console.error("load admin assessment packages failed", error);
      setPackageRows([]);
      setPackagesError(error instanceof Error ? error.message : "فشل تحميل حزم الاختبارات");
    } finally {
      setPackagesLoading(false);
    }
  }, []);

  const loadTrialRequests = useCallback(async () => {
    setTrialRequestsLoading(true);
    setTrialRequestsError(null);
    try {
      const res = await fetch("/api/admin/trial-requests", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "فشل تحميل طلبات التجربة");
      setTrialRequestRows(json.data);
    } catch (error) {
      console.error("load admin trial requests failed", error);
      setTrialRequestRows([]);
      setTrialRequestsError(error instanceof Error ? error.message : "فشل تحميل طلبات التجربة");
    } finally {
      setTrialRequestsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    if (activeTab === "schools") {
      void loadSchools();
    }
    if (activeTab === "users") {
      void loadUsers();
      void loadSchools();
    }
    if (activeTab === "packages") {
      void loadPackages();
      void loadSchools();
    }
    if (activeTab === "trialRequests") {
      void loadTrialRequests();
    }
  }, [activeTab, loadPackages, loadSchools, loadTrialRequests, loadUsers]);

  async function handleLogout() {
    setLoggingOut(true);
    await supabase.auth.signOut();
    router.replace("/login");
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

  function openCreatePackageModal() {
    setEditingPackage(null);
    setPackageModalOpen(true);
  }

  function openEditPackageModal(item: AdminAssessmentPackage) {
    setEditingPackage(item);
    setPackageModalOpen(true);
  }

  async function handleSchoolSubmit(payload: SchoolFormData | Record<string, string>) {
    const name = payload.name?.trim();
    const city = payload.city?.trim() ?? "";
    const type = payload.type?.trim() || "حكومية";
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
        body: JSON.stringify({ name, city, region: null, type, active: true, trial: true }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        console.error("save school API failed", json);
        const details = [json.error, json.details, json.hint].filter(Boolean).join(" - ");
        throw new Error(details || "فشل حفظ المدرسة");
      }

      if (editingSchool) {
        await loadSchools();
        window.alert("تم التحديث");
      } else {
        await loadSchools();
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
    const confirmed = window.confirm("سيتم إيقاف المدرسة ولن تظهر كمدرسة نشطة. لن يتم حذف بياناتها. هل تريد المتابعة؟");
    if (!confirmed) return;

    setBusySchoolId(school.id);
    try {
      // TODO: hard delete requires dependency checks for users, classes, students,
      // package assignments, and assessment results. Keep this as soft disable.
      const res = await fetch(`/api/admin/schools/${school.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok || !json.success) {
        console.error("disable school API failed", json);
        const details = [json.error, json.details, json.hint].filter(Boolean).join(" - ");
        throw new Error(details || "فشل تعطيل المدرسة");
      }
      await loadSchools();
      window.alert("تم إيقاف المدرسة");
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
      throw new Error("الاسم والبريد الإلكتروني والدور مطلوبة");
    }

    if (role !== "admin" && !school_id) {
      throw new Error("يجب ربط المستخدم بمدرسة");
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
        setUserRows((prev) => [json.data, ...prev]);
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
      window.alert(error instanceof Error ? error.message : "فشل تحديث حالة المستخدم");
    } finally {
      setBusyUserId(null);
    }
  }


  async function uploadQuestionsPdf(packageId: string, file: File) {
    const path = `packages/${packageId}/questions.pdf`;
    const { error } = await supabase.storage
      .from("assessment-files")
      .upload(path, file, { upsert: true, contentType: "application/pdf" });

    if (error) throw new Error(error.message || "تعذر رفع ملف الأسئلة PDF");

    const { data } = supabase.storage.from("assessment-files").getPublicUrl(path);
    return data.publicUrl;
  }

  async function handlePackageSubmit(payload: PackageSubmitData) {
    const title = payload.title?.trim();
    if (!title) throw new Error("عنوان الحزمة مطلوب");

    const body = {
      title,
      description: payload.description?.trim() || null,
      subject: payload.subject?.trim() || "رياضيات",
      grade: Number(payload.grade || 6),
      week_number: payload.week_number ? Number(payload.week_number) : null,
      assessment_code: payload.assessment_code?.trim() || null,
      package_type: payload.package_type?.trim() || "weekly",
      duration_minutes: payload.duration_minutes ? Number(payload.duration_minutes) : null,
      start_date: payload.start_date || null,
      end_date: payload.end_date || null,
      student_pdf_url: payload.questions_pdf_url?.trim() || null,
      questions_pdf_url: payload.questions_pdf_url?.trim() || null,
      answer_sheet_pdf_url: payload.answer_sheet_pdf_url?.trim() || null,
      answer_key_file_url: payload.answer_key_file_url?.trim() || null,
      answer_key_json: payload.answer_key_json?.trim() || undefined,
      status: editingPackage?.status ?? "draft",
    };

    const endpoint = editingPackage ? `/api/admin/assessment-packages/${editingPackage.id}` : "/api/admin/assessment-packages";
    const method = editingPackage ? "PATCH" : "POST";
    setBusyPackageId(editingPackage?.id ?? "new");
    try {
      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) throw new Error(json.error || "فشل حفظ حزمة الاختبار");
      const packageId = json.data?.id as string | undefined;
      if (packageId && payload.questions_pdf_file) {
        const publicUrl = await uploadQuestionsPdf(packageId, payload.questions_pdf_file);
        const patchRes = await fetch(`/api/admin/assessment-packages/${packageId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ questions_pdf_url: publicUrl, student_pdf_url: publicUrl }),
        });
        const patchJson = await patchRes.json().catch(() => ({}));
        if (!patchRes.ok || !patchJson.success) throw new Error(patchJson.error || "تم حفظ الحزمة لكن تعذر ربط ملف PDF");
      }
      await loadPackages();
      setEditingPackage(null);
      setPackageModalOpen(false);
      window.alert(editingPackage ? "تم تحديث الحزمة" : "تم إنشاء الحزمة");
    } finally {
      setBusyPackageId(null);
    }
  }

  async function handleImportPackageQuestions(jsonText: string) {
    if (!importingPackage) return;
    const validation = validateWeeklyAnswerKeyJson(jsonText);

    setBusyPackageId(importingPackage.id);
    try {
      const res = await fetch(`/api/admin/assessment-packages/${importingPackage.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer_key_json: jsonText }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) throw new Error(json.error || "فشل استيراد الأسئلة");
      await loadPackages();
      window.alert(`تم استيراد ${toEnglishDigits(validation.count)} سؤال`);
    } finally {
      setBusyPackageId(null);
    }
  }

  async function handlePublishPackage(schoolIds: string[]) {
    if (!publishingPackage) return;
    setBusyPackageId(publishingPackage.id);
    try {
      const res = await fetch(`/api/admin/assessment-packages/${publishingPackage.id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ school_ids: schoolIds }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) throw new Error(json.error || "فشل نشر الحزمة");
      await loadPackages();
      window.alert(`تم نشر الحزمة وربط ${toEnglishDigits(json.assignedClassCount ?? 0)} فصل مطابق`);
    } finally {
      setBusyPackageId(null);
    }
  }

  async function handleWithdrawPackage(item: AdminAssessmentPackage) {
    if (!window.confirm("سيتم سحب الحزمة من المدارس والفصول المطابقة. لن تُحذف النتائج السابقة. هل تريد المتابعة؟")) return;
    setBusyPackageId(item.id);
    try {
      const res = await fetch(`/api/admin/assessment-packages/${item.id}/withdraw`, { method: "PATCH" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) throw new Error(json.error || "فشل سحب الحزمة");
      await loadPackages();
      window.alert("تم سحب الحزمة من المدارس والفصول");
    } catch (error) {
      console.error("withdraw package failed", error);
      window.alert(error instanceof Error ? error.message : "فشل سحب الحزمة");
    } finally {
      setBusyPackageId(null);
    }
  }

  async function handleApplyPackageClasses(item: AdminAssessmentPackage) {
    setBusyPackageId(item.id);
    try {
      const res = await fetch(`/api/admin/assessment-packages/${item.id}/apply-classes`, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) throw new Error(json.error || "فشل تطبيق الحزمة على الفصول");
      await loadPackages();
      window.alert(`تم تطبيق الحزمة على ${toEnglishDigits(json.assignedClassCount ?? 0)} فصل مطابق`);
    } catch (error) {
      console.error("apply package classes failed", error);
      window.alert(error instanceof Error ? error.message : "فشل تطبيق الحزمة على الفصول");
    } finally {
      setBusyPackageId(null);
    }
  }

  async function handleArchivePackage(item: AdminAssessmentPackage) {
    if (!window.confirm("سيتم أرشفة الحزمة ولن تظهر كاختبار منشور جديد. هل تريد المتابعة؟")) return;
    setBusyPackageId(item.id);
    try {
      const res = await fetch(`/api/admin/assessment-packages/${item.id}/archive`, { method: "PATCH" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) throw new Error(json.error || "فشل أرشفة الحزمة");
      await loadPackages();
      window.alert("تمت أرشفة الحزمة");
    } catch (error) {
      console.error("archive package failed", error);
      window.alert(error instanceof Error ? error.message : "فشل أرشفة الحزمة");
    } finally {
      setBusyPackageId(null);
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
    <div className="min-h-screen bg-[#f7fafc] text-brand-navy" dir="rtl">
      {modalType && (
        <AdminModal
          type={modalType}
          initialValues={
            modalType === "school" && editingSchool
              ? { name: editingSchool.name, city: editingSchool.city, type: editingSchool.type ?? "حكومية" }
              : modalType === "user" && editingUser
                ? { name: editingUser.name, email: editingUser.email, role: editingUser.role, school_id: editingUser.school_id ?? "" }
                : undefined
          }
          schools={schoolRows}
          onSubmit={modalType === "school" ? handleSchoolSubmit : modalType === "user" ? handleUserSubmit : undefined}
          onClose={() => { setModalType(null); setEditingSchool(null); setEditingUser(null); }}
        />
      )}

      {packageModalOpen && (
        <PackageModal
          initialValues={editingPackage}
          onSubmit={handlePackageSubmit}
          onClose={() => { setPackageModalOpen(false); setEditingPackage(null); }}
        />
      )}

      {importingPackage && (
        <QuestionImportModal
          assessmentPackage={importingPackage}
          onSubmit={handleImportPackageQuestions}
          onClose={() => setImportingPackage(null)}
        />
      )}

      {publishingPackage && (
        <PublishPackageModal
          assessmentPackage={publishingPackage}
          schools={schoolRows}
          onSubmit={handlePublishPackage}
          onClose={() => setPublishingPackage(null)}
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
                    ? "bg-brand text-white shadow-[0_10px_24px_rgba(21,159,145,0.12)]"
                    : "text-slate-500 hover:bg-slate-50 hover:text-brand-navy"
                }`}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-slate-100 p-4">
          <Link
            href="/admin/weekly-plans"
            className="mb-2 flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-extrabold text-slate-500 transition hover:bg-slate-50 hover:text-brand-navy"
          >
            <BookOpenCheck className="h-5 w-5" />
            إدارة الخطة الأسبوعية
          </Link>
          <Link
            href="/admin/parent-interests"
            className="mb-2 flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-extrabold text-slate-500 transition hover:bg-slate-50 hover:text-brand-navy"
          >
            <UserRoundCog className="h-5 w-5" />
            اهتمامات أولياء الأمور
          </Link>
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
              <p className="mt-1 font-black text-brand-navy">{activeTitle}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-4 py-2 text-xs font-extrabold text-emerald-700 md:flex">
                <CheckCircle2 className="h-4 w-4" />
                صلاحية مدير نظام
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-navy text-white">
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
                    isActive ? "bg-brand text-white" : "bg-slate-50 text-slate-500"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
            <Link
              href="/admin/parent-interests"
              className="flex shrink-0 items-center gap-2 rounded-xl bg-slate-50 px-4 py-2 text-xs font-extrabold text-slate-500"
            >
              <UserRoundCog className="h-4 w-4" />
              اهتمامات أولياء الأمور
            </Link>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-5 py-8 lg:px-8 lg:py-10">
          {activeTab === "overview" && (
            <OverviewTab
              overview={overview}
              state={apiState}
              error={overviewError}
              onAddSchool={openAddSchoolModal}
              onRetry={loadOverview}
            />
          )}
          {activeTab === "schools" && (
            <SchoolsTab
              schools={filteredSchools}
              loading={schoolsLoading}
              error={schoolsError}
              search={schoolSearch}
              onSearchChange={setSchoolSearch}
              onRetry={loadSchools}
              onAddSchool={openAddSchoolModal}
              onEditSchool={openEditSchoolModal}
              onDisableSchool={handleDisableSchool}
              busySchoolId={busySchoolId}
            />
          )}
          {activeTab === "users" && (
            <UsersTab
              users={filteredUsers}
              loading={usersLoading}
              error={usersError}
              search={userSearch}
              onSearchChange={setUserSearch}
              onRetry={loadUsers}
              busyUserId={busyUserId}
              onAddUser={openAddUserModal}
              onEditUser={openEditUserModal}
              onToggleUserStatus={handleToggleUserStatus}
            />
          )}
          {activeTab === "packages" && (
            <PackagesTab
              packages={filteredPackages}
              loading={packagesLoading}
              error={packagesError}
              search={packageSearch}
              onSearch={setPackageSearch}
              onRetry={loadPackages}
              onCreate={openCreatePackageModal}
              onEdit={openEditPackageModal}
              onImport={setImportingPackage}
              onPublish={setPublishingPackage}
              onApplyClasses={handleApplyPackageClasses}
              onWithdraw={handleWithdrawPackage}
              onArchive={handleArchivePackage}
              busyPackageId={busyPackageId}
            />
          )}
          {activeTab === "trialRequests" && (
            <TrialRequestsTab
              requests={trialRequestRows}
              loading={trialRequestsLoading}
              error={trialRequestsError}
              onRetry={loadTrialRequests}
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
