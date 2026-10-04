import type { Metadata } from "next";
import Link from "next/link";
import {
  BarChart3,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  FolderCheck,
  Gift,
  LineChart,
  Printer,
  School,
  Target,
} from "lucide-react";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { BRAND } from "@/lib/brand";
import { publi…3648 tokens truncated…enter justify-between gap-4 rounded-[1.5rem] border border-slate-100 bg-slate-50/60 p-6 text-center md:flex-row md:text-right">
            <div className="flex items-center gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-brand">
                <School className="h-5 w-5" />
              </div>
              <p className="text-sm font-bold leading-7 text-slate-500">
                تحتاج لوحة لقائد المدرسة وتقارير نواتج التعلم للمدرسة كاملة؟ اقترح على مدرستك <span className="font-black text-brand-navy">باقة المدرسة</span>، ويُحتسب المتبقي من اشتراكك.
              </p>
            </div>
            <Link href="/#pricing" className="shrink-0 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-extrabold text-brand-navy transition hover:border-brand/40 hover:text-brand">
              باقات المدارس
            </Link>
          </div>
        </div>
      </section>

      {/* Interest form */}
      <section id="interest" className="px-5 pb-24 lg:px-10">
        <div className="mx-auto grid max-w-6xl gap-10 rounded-[2rem] border border-slate-100 bg-slate-50/80 p-6 shadow-[0_14px_44px_rgba(15,35,55,0.035)] md:p-10 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="flex flex-col justify-center text-center lg:text-right">
            <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-brand lg:mx-0">
              <FolderCheck className="h-6 w-6" />
            </div>
            <h2 className="text-3xl/[1.45] font-black tracking-normal text-brand-navy">سجّل اهتمامك</h2>
            <p className="mt-4 leading-8 text-slate-500">
              جرّب الباقة شهرًا مجانًا بدون بطاقة ائتمانية. نفعّل الحسابات بالترتيب، فاترك بياناتك ومادتك وصفك وسنتواصل معك.
            </p>
          </div>
          <TeacherInterestForm />
        </div>
      </section>

      {/* FAQ */}
      <section className="px-5 pb-24 lg:px-10">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-3xl/[1.45] font-black tracking-normal text-brand-navy">أسئلة شائعة</h2>
          <div className="mt-10 space-y-4">
            {faqs.map((item) => (
              <details key={item.q} className="group rounded-[1.25rem] border border-slate-100 bg-white p-6">
                <summary className="cursor-pointer list-none text-base font-extrabold text-brand-navy">
                  {item.q}
                </summary>
                <p className="mt-3 text-sm leading-7 text-slate-500">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
