import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { BRAND } from "@/lib/brand";

export const siteNavLinks = [
  { label: "الرئيسية", href: "/" },
  { label: "المميزات", href: "/#features" },
  { label: "الأسعار", href: "/#pricing" },
  { label: "للمعلم", href: "/teachers" },
  { label: "من نحن", href: "/about" },
  { label: "تواصل معنا", href: "/#trial" },
];

export function SiteHeader() {
  return (
    <nav className="sticky top-0 z-50 border-b border-slate-100 bg-white/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 lg:px-10">
        <BrandLogo contextTitle={BRAND.nameAr} size="sm" />

        <div className="hidden items-center gap-5 md:flex lg:gap-8">
          {siteNavLinks.map((link) => (
            <Link key={link.href} href={link.href} className="text-xs font-bold text-slate-500 transition hover:text-brand-navy lg:text-sm">
              {link.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="inline-flex rounded-xl border border-slate-200 px-4 py-3 text-sm font-extrabold text-brand-navy transition hover:border-brand hover:text-brand sm:px-5"
          >
            تسجيل دخول
          </Link>
          <Link
            href="/signup"
            className="rounded-xl bg-brand px-5 py-3 text-sm font-extrabold text-white shadow-[0_8px_20px_rgba(21,159,145,0.12)] transition hover:bg-brand-dark"
          >
            ابدأ مجانًا
          </Link>
        </div>
      </div>
    </nav>
  );
}
