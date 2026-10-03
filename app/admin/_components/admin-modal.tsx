"use client";

import { useState } from "react";
import type { AdminSchool, ModalType, SchoolFormData, UserFormData } from "../_lib/types";

export function AdminModal({
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
  onSubmit: (payload: SchoolFormData | UserFormData | Record<string, string>) => Promise<void> | void;
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
      await onSubmit(payload);
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
