import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: "/api/",
    },
    // Allow HTML crawling so search engines can read noindex on nonpublic pages.
    // Existing authentication remains responsible for protecting private data.
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
