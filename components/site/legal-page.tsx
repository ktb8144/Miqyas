import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";

export type LegalSection = { title: string; body: (React.ReactNode | string[])[] };

/** Plain, readable layout for the privacy policy and terms of use. */
export function LegalPage({ title, updated, intro, sections }: { title: string; updated: string; intro: string; sections: LegalSection[] }) {
  return (
    <div className="min-h-screen bg-white text-brand-navy" dir="rtl">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-5 py-14 lg:py-20">
        <h1 className="text-3xl/[1.45] font-black md:text-4xl/[1.45]">{title}</h1>
        <p className="mt-2 text-sm font-bold text-slate-400">آخر تحديث: {updated}</p>
        <p className="mt-6 leading-9 text-slate-600">{intro}</p>
        <div className="mt-10 space-y-9">
          {sections.map((section, index) => (
            <section key={section.title}>
              <h2 className="text-xl font-black">{index + 1}. {section.title}</h2>
              <div className="mt-3 space-y-3 leading-9 text-slate-600">
                {section.body.map((block, i) =>
                  Array.isArray(block) ? (
                    <ul key={i} className="list-disc space-y-1 pr-6">
                      {block.map((item) => <li key={item}>{item}</li>)}
                    </ul>
                  ) : (
                    <p key={i}>{block}</p>
                  )
                )}
              </div>
            </section>
          ))}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
