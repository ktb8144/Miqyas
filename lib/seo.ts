import type { Metadata } from "next";
import { BRAND } from "@/lib/brand";

export const SITE_URL = "https://www.dalaedu.com";
export const HOME_TITLE = "دالة | اختبارات محاكية لنافس وتقارير نواتج التعلم";

type PublicMetadataOptions = {
  path: string;
  title: string;
  description: string;
};

/** Only public marketing pages should opt in to indexing and a canonical URL. */
export function publicMetadata({ path, title, description }: PublicMetadataOptions): Metadata {
  const url = new URL(path, SITE_URL).toString();
  // Share image files live in app/ (1200×630). Listed explicitly because a page's own
  // openGraph object replaces the one Next.js would otherwise inherit from those files.
  const shareImage = {
    url: new URL("/opengraph-image.png", SITE_URL).toString(),
    width: 1200,
    height: 630,
    alt: `${BRAND.nameAr} — ${BRAND.tagline}`,
  };

  return {
    title,
    description,
    alternates: { canonical: url },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true },
    },
    openGraph: {
      type: "website",
      locale: "ar_SA",
      siteName: BRAND.nameAr,
      url,
      title,
      description,
      images: [shareImage],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [{ url: shareImage.url, alt: shareImage.alt }],
    },
  };
}

// Keep structured data limited to the identity and description visible on the site.
export const siteStructuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: BRAND.nameAr,
      alternateName: BRAND.nameEn,
      url: `${SITE_URL}/`,
      logo: new URL(BRAND.logoSrc, SITE_URL).toString(),
      description: BRAND.description,
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      name: BRAND.nameAr,
      alternateName: [BRAND.nameEn, "منصة دالة"],
      url: `${SITE_URL}/`,
      inLanguage: "ar",
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
  ],
};
