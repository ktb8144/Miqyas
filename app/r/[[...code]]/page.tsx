import type { Metadata } from "next";
import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { BRAND } from "@/lib/brand";

// Target of the QR code printed on student sheets (dalaedu.com/R/<code>).
// Uppercase /R/ is rewritten here in next.config.mjs, since uppercase keeps the QR code small.
// For now this is a placeholder until parent result pages are ready.

export const metadata: Metadata = {
  title: `نتيجة الاختبار — ${BRAND.nameAr}`,
  robots: { index: false, follow: false },
};

function displayCode(parts: string[] | undefined) {
  const code = (parts ?? []).join("/").toUpperCase();
  return /^[A-Z0-9/_-]{1,64}$/.test(code) ? code : "";
}

export default function ResultCodePage({ params }: { params: { code?: string[] } }) {
  const code = displayCode(params.code);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7fafc] px-5 py-12 text-brand-navy" dir="rtl">
      <section className="w-full max-w-md rounded-[1.5rem] border border-slate-100 bg-white p-8 text-center shadow-[0_10px_34px_rgba(15,35,55,0.05)]">
        <div className="flex justify-center">
          <BrandLogo size="md" centered contextTitle={BRAND.nameAr} contextSubtitle={BRAND.tagline} />
        </div>

        <h1 className="mt-8 text-2xl font-black leading-10">نتائج هذا الاختبار ستكون متاحة قريبًا</h1>
        <p className="mt-3 text-sm font-bold leading-7 text-slate-500">
          احتفظ بورقة الاختبار، وامسح الرمز مرة أخرى لاحقًا للاطلاع على النتيجة.
        </p>

        {code && (
          <p className="mt-6 inline-block rounded-xl bg-slate-50 px-4 py-2 text-xs font-bold text-slate-400" dir="ltr">
            {code}
          </p>
        )}

        <div className="mt-8">
          <Link href="/" className="text-sm font-extrabold text-brand hover:underline">
            تعرّف على {BRAND.nameAr}
          </Link>
        </div>
      </section>
    </main>
  );
}
