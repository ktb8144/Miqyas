import { BrandLogo } from "@/components/brand-logo";

/** Centered card layout shared by the sign-in related pages. */
export function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-white px-4 py-10 text-brand-navy" dir="rtl">
      <div className="absolute left-10 top-24 h-96 w-96 rounded-full bg-teal-50/80 blur-3xl" />
      <div className="absolute right-1/4 bottom-16 h-80 w-80 rounded-full bg-cyan-50/70 blur-3xl" />

      <div className="relative mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-md items-center justify-center">
        <div className="w-full">
          <div className="mb-8 flex justify-center">
            <BrandLogo size="lg" centered />
          </div>
          <div className="rounded-[2rem] border border-slate-100 bg-white/95 p-8 shadow-[0_22px_70px_rgba(15,35,55,0.07)]">
            <h1 className="mb-2 text-center text-2xl font-black tracking-normal text-brand-navy">{title}</h1>
            {subtitle && <p className="mb-7 text-center text-sm leading-7 text-slate-400">{subtitle}</p>}
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

export function AuthAlert({ tone, children }: { tone: "error" | "info"; children: React.ReactNode }) {
  const styles =
    tone === "error"
      ? "border-rose-100 bg-rose-50 text-rose-700"
      : "border-teal-100 bg-teal-50 text-brand";
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-xl border px-4 py-3 text-sm font-bold leading-7 ${styles}`}>
      {children}
    </div>
  );
}

export const authInputClass =
  "w-full rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-right text-sm font-semibold text-brand-navy outline-none transition focus:border-brand/40 focus:bg-white";

export const authButtonClass =
  "w-full rounded-xl bg-brand py-3.5 text-base font-extrabold text-white shadow-[0_10px_24px_rgba(21,159,145,0.14)] transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60";
