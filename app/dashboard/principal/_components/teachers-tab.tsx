"use client";

import { useState } from "react";
import { toEnglishDigits } from "@/lib/format";
import { EmptyState, TeacherCard } from "./ui";
import type { PrincipalDashboardState } from "../_lib/use-principal-dashboard";
import { JoinCodeCard, type AccountPlan } from "@/components/plan/plan-banner";

function ResendButton({ onResend }: { onResend: () => Promise<string> }) {
  const [state, setState] = useState<{ status: "idle" | "sending" | "done" | "error"; message?: string }>({ status: "idle" });
  const send = async () => {
    setState({ status: "sending" });
    try {
      setState({ status: "done", message: await onResend() });
    } catch (err) {
      setState({ status: "error", message: err instanceof Error ? err.message : "تعذر إرسال الرابط" });
    }
  };
  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={send}
        disabled={state.status === "sending"}
        className="whitespace-nowrap rounded-xl border border-brand/30 bg-white px-3 py-2 text-xs font-extrabold text-brand transition hover:bg-teal-50 disabled:opacity-60"
      >
        {state.status === "sending" ? "جارٍ الإرسال..." : state.status === "done" ? "أُرسلت ✓" : "إعادة إرسال الدعوة"}
      </button>
      {state.status === "error" && <span role="alert" className="text-[11px] font-bold text-danger">{state.message}</span>}
    </div>
  );
}

export function TeachersTab({ d, account }: { d: PrincipalDashboardState; account?: AccountPlan | null }) {
  const { report, resendInvite, setInviteOpen, inviteNotice, setInviteNotice } = d;
  if (!report) return null;

  const pending = report.teachers.filter((teacher) => teacher.status === "invited");
  const active = report.teachers.filter((teacher) => teacher.status !== "invited");

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-black text-brand-navy">المعلمون</h3>
          <p className="text-sm font-bold text-slate-400">
            {toEnglishDigits(report.teachers.length)} معلم
            {pending.length ? ` · ${toEnglishDigits(pending.length)} لم يفعّلوا حساباتهم بعد` : ""}
          </p>
        </div>
        <button
          onClick={() => setInviteOpen(true)}
          className="flex-shrink-0 rounded-xl bg-brand px-4 py-2 text-sm font-extrabold text-white transition hover:bg-brand-dark"
        >
          + إضافة معلم
        </button>
      </div>

      {account?.joinCode && <JoinCodeCard joinCode={account.joinCode} schoolName={account.schoolName} />}

      {inviteNotice && (
        <div role="status" className="flex items-start justify-between gap-3 rounded-xl border border-teal-100 bg-teal-50 p-3 text-sm font-bold text-brand">
          <span>✓ {inviteNotice}</span>
          <button onClick={() => setInviteNotice(null)} aria-label="إغلاق" className="text-lg leading-none text-brand/60">×</button>
        </div>
      )}

      {pending.length > 0 && (
        <div className="rounded-[1.25rem] border border-amber-200 bg-amber-50/50 p-4">
          <h4 className="mb-1 font-black text-brand-navy">دعوات لم تُفعَّل</h4>
          <p className="mb-3 text-xs font-bold text-slate-500">
            أُرسلت لهم دعوة بالبريد ولم يفعّلوا حساباتهم بعد. اطلب منهم فحص البريد غير المرغوب فيه، أو أعد إرسال الدعوة.
          </p>
          <ul className="divide-y divide-amber-100">
            {pending.map((teacher) => (
              <li key={teacher.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate font-black text-brand-navy">{teacher.name}</p>
                  <p className="truncate text-xs font-bold text-slate-500" dir="ltr">{teacher.email}</p>
                  <span className="mt-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">
                    لم يتم تفعيل الحساب
                  </span>
                </div>
                <ResendButton onResend={() => resendInvite(teacher.id)} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {active.length ? (
        <div className="space-y-3">
          {active.map((teacher) => <TeacherCard key={teacher.id} teacher={teacher} />)}
        </div>
      ) : pending.length === 0 ? (
        <EmptyState>لم تتم إضافة معلمين بعد</EmptyState>
      ) : null}
    </div>
  );
}
