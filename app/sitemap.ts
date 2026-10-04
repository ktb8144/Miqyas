import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  // Explicit allowlist: never include account, dashboard, API, or token URLs.
  // Omit lastModified rather than report a new content date on every deployment.
  return [
    "/",
    "/about",
    "/teachers",
    "/guides/how-it-works",
    "/guides/learning-outcomes-reports",
    "/guides/grade-6-math-diagnostic",
  ].map((path) => ({
    url: new URL(path, SITE_URL).toString(),
  }));
}
