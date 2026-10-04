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
  const image = {
    url: new URL(BRAND.logoSrc, SITE_URL).toString(),
    width: 344,
    height: 317,
    alt: `شعار ${BRAND.nameAr}`,
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
      images: [image],
    },
    twitter: {
      card: "summary",
      title,
      description,
      images: [{ url: image.url, alt: image.alt }],
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
