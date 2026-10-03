"use client";

import { useState } from "react";
import { LayoutDashboard, MoreHorizontal, Plus, Search } from "lucide-react";

export function StatusBadge({ status }: { status: string }) {
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

export function PrimaryButton({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) {
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

export function SoftButton({
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

export function StatCard({
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

export function PageHeader({
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

export function SearchBar({
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

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
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

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-5 py-10 text-center text-sm font-extrabold text-slate-400">
      {message}
    </div>
  );
}

export function ActionDropdown({
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
