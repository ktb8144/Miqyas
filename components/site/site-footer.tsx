import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { BRAND } from "@/lib/brand";

export function SiteFooter() {
  return (
    <footer className="border-t border-slate-100 px-5 py-14 lg:px-10">
      <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-3">
        <div>
          <BrandLogo contextTitle={BRAND.nameAr} contextSubtitle={BRAND.tagline} size="sm" />
        </div>

        <div>
          <h3 className="mb-4 font-extrabold text-brand-navy">المنتج</h3>
          <div className="space-y-3 text-sm font-semibold text-slate-500">
            <Link href="/#features" className="block hover:text-brand">المميزات</Link>
            <Link href="/#pricing" className="block hover:text-brand">الأسعار</Link>
            <Link href="/teachers" className="block hover:text-brand">باقة المعلم</Link>
            <Link href="/login" className="block hover:text-brand">تسجيل الدخول</Link>
          </div>
        </div>

        <div>
          <h3 className="mb-4 font-extrabold text-brand-navy">{BRAND.nameAr}</h3>
          <div className="space-y-3 text-sm font-semibold text-slate-500">
            <Link href="/about" className="block hover:text-brand">من نحن</Link>
            <Link href="/#trial" className="block hover:text-brand">تواصل معنا</Link>
          </div>
        </div>
      </div>

      <div className="mx-auto mt-10 max-w-6xl border-t border-slate-100 pt-6 text-center text-sm font-semibold text-slate-400">
        © {BRAND.nameAr}. جميع الحقوق محفوظة.
      </div>
    </footer>
  );
}
