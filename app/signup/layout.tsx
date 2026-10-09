import type { Metadata } from "next";
import { BRAND } from "@/lib/brand";
import { publicMetadata } from "@/lib/seo";

// The signup page is a client component, so its public metadata lives here.
// Without it the page inherits the site-wide noindex while being listed in the sitemap.
export const metadata: Metadata = publicMetadata({
  path: "/signup",
  title: `سجّل مجانًا — ${BRAND.nameAr}`,
  description: `سجّل مدرستك أو حسابك كمعلم في ${BRAND.nameAr}، وجرّب الاختبارات الأسبوعية المحاكية لنافس والتصحيح بالجوال مجانًا لمدة شهر.`,
});

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
