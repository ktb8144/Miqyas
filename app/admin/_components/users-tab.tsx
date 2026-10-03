"use client";

import { UserRoundCog } from "lucide-react";
import {
  ActionDropdown,
  EmptyState,
  ErrorState,
  PageHeader,
  PrimaryButton,
  SearchBar,
  StatusBadge,
} from "./ui";
import type { AdminUser } from "../_lib/types";

export function UsersTab({
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
