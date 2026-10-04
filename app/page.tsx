import LandingPage from "@/components/site/landing-page";
import { BRAND } from "@/lib/brand";
import { HOME_TITLE, publicMetadata, siteStructuredData } from "@/lib/seo";

export const metadata = publicMetadata({
  path: "/",
  title: HOME_TITLE,
  description: BRAND.description,
});

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(siteStructuredData).replace(/</g, "\\u003c"),
        }}
      />
      <LandingPage />
    </>
  );
}
