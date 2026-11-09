"use client";

import { useEffect, useRef, useState } from "react";
import { uploadNafsReport, type NafsReportResult } from "@/lib/nafs/report-upload";

const DISMISS_KEY = "dala:nafs-welcome-dismissed";

function wasDismissed() {
  try {
    return window.localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

function rememberDismissed() {
  try {
    window.localStorage.setItem(DISMISS_KEY, "1");
  } catch {
    // Private mode or blocked storage: the card simply shows again next visit.
  }
}

const VALUE = [
  { icon: "📍", title: "تقرير وضع المدرسة", text: "أين تقف كل مادة وكل مجال، وهل مدرستك تتحسن أم تتراجع عن العام السابق." },
  { icon: "🎯", title: "أولويات وأهداف", text: "أضعف المجالات مرتبة حسب الأولوية، مع هدف مقترح لكل مجال في الاختبار القادم." },
  { icon: "🗓️", title: "خطة تحسين جاهزة", text: "إجراءات أسبوعية مربوطة بدورة دالة، ومتى يُعاد القياس، وما تراجعه نهاية كل دورة." },
];

const DEEP = { icon: "🧠", title: "تحليل معمّق", text: "أسباب جذرية مرجّحة، وخطة 90 يومًا، وموجز جاهز ترسله لمعلميك." };

/**
 * The first thing a principal sees until the school's previous NAFS results are in: what Dala
 * builds from them, and a one-tap upload of the report as it arrived (PDF or photos).
 * The reading is handed to the «نافس السابق» tab for review; nothing is saved from here.
 */
export function NafsOnboardingHero({
  onRead,
  onManual,
}: {
  onRead: (reading: NafsReportResult) => void;
  onManual: () => void;
}) {
  const [state, setState] = useState<"checking" | "show" | "hidden">("checking");
  const [readerEnabled, setReaderEnabled] = useState(false);
  const [deepEnabled, setDeepEnabled] = useState(false);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    if (wasDismissed()) {
      setState("hidden");
      return;
    }
    (async () => {
      try {
        const [baselineRes, analysisRes] = await Promise.all([
          fetch("/api/principal/nafs-baseline", { cache: "no-store" }),
          fetch("/api/principal/nafs-analysis", { cache: "no-store" }).catch(() => null),
        ]);
        const json = await baselineRes.json().catch(() => ({}));
        const analysis = analysisRes ? await analysisRes.json().catch(() => ({})) : {};
        if (!alive) return;
        // Results already entered, or NAFS storage not ready: nothing to invite.
        if (!baselineRes.ok || !json.success || (json.baselines?.length ?? 0) > 0) {
          setState("hidden");
          return;
        }
        setReaderEnabled(Boolean(json.reportReaderEnabled));
        setDeepEnabled(Boolean(analysis?.enabled));
        setState("show");
      } catch {
        if (alive) setState("hidden");
      }
    })();
    return () => { alive = false; };
  }, []);

  if (state !== "show") return null;

  const upload = async (list: FileList | null) => {
    const picked = Array.from(list ?? []);
    if (fileRef.current) fileRef.current.value = "";
    if (!picked.length) return;
    setError(null);
    setReading(true);
    try {
      onRead(await uploadNafsReport(picked));
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذرت قراءة التقرير");
    } finally {
      setReading(false);
    }
  };

  const dismiss = () => {
    rememberDismissed();
    setState("hidden");
  };

  const value = deepEnabled ? [...VALUE, DEEP] : VALUE;

  return (
    <section className="mb-4 overflow-hidden rounded-3xl bg-brand-navy text-white shadow-sm sm:mb-5">
      <div className="space-y-5 p-5 sm:p-7">
        <div className="space-y-2">
          <p className="text-xs font-extrabold tracking-wide text-teal-200">الخطوة الأولى · دقيقة واحدة</p>
          <h2 className="text-2xl font-black leading-snug sm:text-3xl">ابدأ من حيث تقف مدرستك في نافس</h2>
          <p className="max-w-2xl text-sm font-bold leading-7 text-white/80">
            ارفع تقرير نافس السابق كما وصلك، ملف PDF أو صور الصفحات، وتبني لك دالة منه فورًا:
          </p>
        </div>

        <div className={`grid gap-3 ${value.length === 4 ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-3"}`}>
          {value.map((v) => (
            <div key={v.title} className="rounded-2xl bg-white/10 p-4">
              <p className="text-2xl" aria-hidden>{v.icon}</p>
              <p className="mt-2 text-sm font-black">{v.title}</p>
              <p className="mt-1 text-xs font-bold leading-6 text-white/75">{v.text}</p>
            </div>
          ))}
        </div>

        {error && <p role="alert" className="rounded-xl bg-red-500/20 p-3 text-sm font-bold text-red-100">{error}</p>}

        <div className="flex flex-wrap items-center gap-2">
          {readerEnabled ? (
            <>
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf,image/*"
                multiple
                className="hidden"
                onChange={(e) => void upload(e.target.files)}
              />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={reading}
                className="rounded-xl bg-white px-5 py-3 text-sm font-black text-brand-navy transition hover:bg-teal-50 disabled:opacity-70"
              >
                {reading ? "جارٍ قراءة التقرير... (حتى دقيقة)" : "رفع تقرير نافس (PDF أو صور)"}
              </button>
              <button onClick={onManual} disabled={reading} className="rounded-xl border border-white/30 px-4 py-3 text-sm font-extrabold text-white disabled:opacity-60">
                إدخال الأرقام يدويًا
              </button>
            </>
          ) : (
            <button onClick={onManual} className="rounded-xl bg-white px-5 py-3 text-sm font-black text-brand-navy">
              أدخل نتائج نافس السابقة
            </button>
          )}
          <button onClick={dismiss} disabled={reading} className="px-3 py-3 text-xs font-bold text-white/60 hover:text-white disabled:opacity-60">
            لاحقًا
          </button>
        </div>

        <p className="text-[11px] font-bold leading-5 text-white/55">
          تراجع كل رقم بنفسك قبل الحفظ · لا نحفظ ملف التقرير · لا نحتاج أسماء طلاب أو معلمين
        </p>
      </div>
    </section>
  );
}
