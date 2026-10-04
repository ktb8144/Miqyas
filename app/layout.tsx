import type { Metadata } from "next";
import "./globals.css";
import { BRAND } from "@/lib/brand";
import { SITE_URL } from "@/lib/seo";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: `${BRAND.nameAr} — ${BRAND.tagline}`,
  description: BRAND.description,
  // Public pages explicitly opt in through publicMetadata. Account, dashboard,
  // and token-based report pages must never inherit a public canonical or index tag.
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl">
      <body className="min-h-screen bg-gray-50 text-slate-950">{children}</body>
    </html>
  );
}
