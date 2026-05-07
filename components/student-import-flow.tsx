"use client";
import { useState, useRef } from "react";

type Step =
  | "choice"
  | "camera"
  | "extracting"
  | "review"
  | "saving"
  | "done"
  | "manual";

interface Props {
  onSave: (names: string[]) => Promise<{ savedCount?: number } | void> | { savedCount?: number } | void;
  initialNames?: string[];
}

type MergeInfo = {
  added: number;
  duplicates: number;
};

function normalizeName(name: string) {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

function cleanName(name: string) {
  return name.trim().replace(/\s+/g, " ");
}

function mergeNames(current: string[], incoming: string[]) {
  const merged = current.map(cleanName).filter(Boolean);
  const seen = new Set(merged.map(normalizeName));
  let added = 0;
  let duplicates = 0;

  incoming.map(cleanName).filter(Boolean).forEach((name) => {
    const key = normalizeName(name);
    if (seen.has(key)) {
      duplicates++;
      return;
    }
    seen.add(key);
    merged.push(name);
    added++;
  });

  return { merged, added, duplicates };
}

function uniqueCleanNames(names: string[]) {
  return mergeNames([], names).merged;
}

export function StudentImportFlow({ onSave, initialNames = [] }: Props) {
  const [step, setStep] = useState<Step>("choice");
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [editableNames, setEditableNames] = useState<string[]>(() => uniqueCleanNames(initialNames));
  const [extractError, setExtractError] = useState<string | null>(null);
  const [mergeInfo, setMergeInfo] = useState<MergeInfo | null>(null);
  const [manualText, setManualText] = useState("");
  const [savedCount, setSavedCount] = useState(0);
  const [saveError, setSaveError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // ── Camera ──────────────────────────────────────────────────────────────────

  const openCamera = async () => {
    setExtractError(null);
    setMergeInfo(null);
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 960 } },
      });
      streamRef.current = s;
      setStep("camera");
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          videoRef.current.play();
        }
      }, 100);
    } catch {
      setExtractError("تعذّر فتح الكاميرا — استخدم الإدخال اليدوي");
      setStep("manual");
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 960;
    canvas.getContext("2d")?.drawImage(video, 0, 0);

    const base64 = canvas.toDataURL("image/jpeg", 0.92).split(",")[1];
    setCapturedImage(base64);
    stopCamera();
    runExtraction(base64);
  };

  // ── Gemini extraction ────────────────────────────────────────────────────────

  const runExtraction = async (base64: string) => {
    setStep("extracting");
    setExtractError(null);

    try {
      const res = await fetch("/api/extract-names", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, mimeType: "image/jpeg" }),
      });

      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || "فشل الاستخراج");

      const names: string[] = json.names ?? [];

      if (names.length === 0) {
        setExtractError(
          "لم يتم التعرف على أسماء — تأكد من وضوح الصورة والإضاءة الجيدة"
        );
        setStep(editableNames.length > 0 ? "review" : "choice");
        return;
      }

      setEditableNames((prev) => {
        const result = mergeNames(prev, names);
        setMergeInfo({ added: result.added, duplicates: result.duplicates });
        return result.merged;
      });
      setStep("review");
    } catch {
      setExtractError(
        "الصورة غير واضحة — حاول مرة أخرى أو استخدم الإدخال اليدوي"
      );
      setCapturedImage(null);
      setStep("choice");
    }
  };

  // ── Review edits ─────────────────────────────────────────────────────────────

  const updateName = (i: number, val: string) =>
    setEditableNames((prev) => prev.map((n, idx) => (idx === i ? val : n)));

  const deleteName = (i: number) =>
    setEditableNames((prev) => prev.filter((_, idx) => idx !== i));

  const addEmptyName = () => setEditableNames((prev) => [...prev, ""]);

  // ── Save ─────────────────────────────────────────────────────────────────────

  const confirmSave = async () => {
    const cleaned = uniqueCleanNames(editableNames);
    if (!cleaned.length) return;
    setStep("saving");
    setSaveError(null);

    try {
      const result = await onSave(cleaned);
      await new Promise((r) => setTimeout(r, 700));
      setSavedCount(result?.savedCount ?? cleaned.length);
      setStep("done");
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "تعذر حفظ الطلاب");
      setStep("review");
    }
  };

  const handleManualSave = () => {
    const names = manualText
      .split("\n")
      .map(cleanName)
      .filter(Boolean);
    if (!names.length) return;
    setEditableNames((prev) => {
      const result = mergeNames(prev, names);
      setMergeInfo({ added: result.added, duplicates: result.duplicates });
      return result.merged;
    });
    setManualText("");
    setStep("review");
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="bg-white rounded-xl border-2 border-dashed border-gray-300 p-6" dir="rtl">
      <div className="flex items-center gap-2 mb-5">
        <span className="text-2xl">👥</span>
        <div>
          <h3 className="font-bold text-gray-900 text-lg">إضافة طلاب الفصل</h3>
          <p className="text-gray-500 text-sm">
            {editableNames.length > 0
              ? `القائمة الحالية تحتوي ${editableNames.length} اسم — يمكنك إضافة صفحات أخرى`
              : "لم يتم إضافة طلاب بعد — ابدأ الآن"}
          </p>
        </div>
      </div>

      {/* ── STEP: choice ── */}
      {step === "choice" && (
        <div>
          {extractError && (
            <div
              className="mb-4 p-4 rounded-xl text-sm"
              style={{ background: "#fff5f5", border: "1px solid #fecaca", color: "#b91c1c" }}
            >
              ⚠️ {extractError}
            </div>
          )}
          <div className="grid md:grid-cols-2 gap-4">
            <button
              onClick={openCamera}
              className="flex flex-col items-center gap-3 p-8 rounded-xl border-2 hover:shadow-md transition-all text-center"
              style={{ borderColor: "#1D9E75", background: "#f0fdf8" }}
            >
              <span className="text-5xl">📷</span>
              <div>
                <div className="font-bold text-gray-900 text-lg">تصوير كشف الأسماء</div>
                <div className="text-gray-500 text-sm mt-1">
                  صوّر صفحة من الكشف وسيتم دمج الأسماء مع القائمة الحالية
                </div>
              </div>
              <span
                className="px-3 py-1 rounded-full text-xs font-bold text-white"
                style={{ background: "#1D9E75" }}
              >
                مدعوم بـ Gemini Vision
              </span>
            </button>

            <button
              onClick={() => { setExtractError(null); setStep("manual"); }}
              className="flex flex-col items-center gap-3 p-8 rounded-xl border-2 hover:shadow-md transition-all text-center border-gray-300"
            >
              <span className="text-5xl">✏️</span>
              <div>
                <div className="font-bold text-gray-900 text-lg">إدخال يدوي</div>
                <div className="text-gray-500 text-sm mt-1">
                  اكتب أو الصق الأسماء مباشرة — سطر واحد لكل اسم
                </div>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-600">
                الطريقة الاحتياطية
              </span>
            </button>
          </div>
        </div>
      )}

      {/* ── STEP: camera ── */}
      {step === "camera" && (
        <div className="text-center">
          <div
            className="relative inline-block rounded-xl overflow-hidden mb-4 border-4 w-full max-w-md"
            style={{ borderColor: "#1D9E75" }}
          >
            <video
              ref={videoRef}
              className="w-full object-cover"
              style={{ maxHeight: "420px" }}
              playsInline
              muted
            />
            {/* alignment guide */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="border-2 border-white rounded-lg opacity-60" style={{ width: "80%", height: "85%" }} />
            </div>
            <div
              className="absolute bottom-0 left-0 right-0 py-2 text-center text-white text-sm font-medium"
              style={{ background: "rgba(0,0,0,0.55)" }}
            >
              وجّه الكاميرا نحو كشف الأسماء بالكامل
            </div>
          </div>
          <canvas ref={canvasRef} className="hidden" />
          <p className="text-gray-500 text-sm mb-4">تأكد من وضوح الإضاءة وظهور الأسماء كاملة</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={capturePhoto}
              className="px-8 py-3 rounded-xl text-white font-bold shadow-md hover:opacity-90"
              style={{ background: "#1D9E75" }}
            >
              📸 التقاط الصورة
            </button>
            <button
              onClick={() => { stopCamera(); setStep("choice"); }}
              className="px-6 py-3 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50"
            >
              إلغاء
            </button>
          </div>
        </div>
      )}

      {/* ── STEP: extracting ── */}
      {step === "extracting" && (
        <div className="text-center py-10">
          {capturedImage && (
            <div className="mb-5 inline-block">
              <img
                src={`data:image/jpeg;base64,${capturedImage}`}
                alt="الصورة الملتقطة"
                className="rounded-xl border border-gray-200 object-contain"
                style={{ maxHeight: "180px", maxWidth: "280px" }}
              />
            </div>
          )}
          <div className="relative w-16 h-16 mx-auto mb-4">
            <div className="w-16 h-16 rounded-full border-4 border-gray-200" />
            <div
              className="absolute top-0 left-0 w-16 h-16 rounded-full border-4 border-t-transparent animate-spin"
              style={{ borderColor: "#1D9E75", borderTopColor: "transparent" }}
            />
          </div>
          <p className="text-gray-700 font-bold text-lg">جارٍ قراءة الأسماء...</p>
          <p className="text-gray-400 text-sm mt-1">Gemini Vision يحلل كشف الحضور</p>
        </div>
      )}

      {/* ── STEP: review ── */}
      {step === "review" && (
        <div>
          {/* header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <span className="font-bold text-gray-900">مراجعة الأسماء المستخرجة</span>
              <span
                className="mr-2 px-2.5 py-0.5 rounded-full text-sm font-bold text-white"
                style={{ background: "#1D9E75" }}
              >
                {editableNames.filter(n => n.trim()).length} اسم
              </span>
            </div>
            <button
              onClick={openCamera}
              className="text-sm font-bold text-[#1D9E75] hover:opacity-80"
            >
              + إضافة صفحة أخرى بالكاميرا
            </button>
          </div>

          {mergeInfo && (
            <div
              className="mb-4 rounded-xl border px-4 py-3 text-sm"
              style={{ background: "#f0fdfa", borderColor: "#99f6e4", color: "#0f766e" }}
            >
              تمت إضافة <b>{mergeInfo.added}</b> اسم جديد
              {mergeInfo.duplicates > 0 && <>، وتم تجاهل <b>{mergeInfo.duplicates}</b> اسم مكرر</>}
            </div>
          )}

          {saveError && (
            <div
              className="mb-4 rounded-xl border px-4 py-3 text-sm font-bold"
              style={{ background: "#fff5f5", borderColor: "#fecaca", color: "#b91c1c" }}
            >
              {saveError}
            </div>
          )}

          {editableNames.filter(n => n.trim()).length < 5 && (
            <div
              className="mb-4 p-3 rounded-lg text-sm flex items-start gap-2"
              style={{ background: "#fffbeb", border: "1px solid #fde68a", color: "#92400e" }}
            >
              <span>⚠️</span>
              <span>
                تم استخراج {editableNames.filter(n => n.trim()).length} اسم فقط — تحقق من الصورة أو أضف الأسماء يدوياً
              </span>
            </div>
          )}

          {/* editable list */}
          <div className="space-y-2 mb-4 max-h-72 overflow-y-auto pl-1">
            {editableNames.map((name, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-gray-400 text-sm w-6 text-center flex-shrink-0">{i + 1}</span>
                <input
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-right text-sm focus:outline-none focus:ring-2"
                  style={{ focusRingColor: "#1D9E75" } as React.CSSProperties}
                  value={name}
                  onChange={(e) => updateName(i, e.target.value)}
                  placeholder="اسم الطالب"
                />
                <button
                  onClick={() => deleteName(i)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 flex-shrink-0"
                  title="حذف"
                >
                  🗑️
                </button>
              </div>
            ))}
          </div>

          {/* add name */}
          <button
            onClick={addEmptyName}
            className="w-full py-2.5 rounded-lg border-2 border-dashed text-sm font-medium mb-5 hover:bg-gray-50 transition-all"
            style={{ borderColor: "#1D9E75", color: "#1D9E75" }}
          >
            + إضافة اسم
          </button>

          {/* confirm */}
          <button
            onClick={confirmSave}
            disabled={editableNames.filter(n => n.trim()).length === 0}
            className="w-full py-4 rounded-xl text-white font-bold text-lg shadow-md hover:opacity-90 disabled:opacity-50"
            style={{ background: "#1D9E75" }}
          >
            💾 حفظ {editableNames.filter(n => n.trim()).length} طالب في الفصل
          </button>
        </div>
      )}

      {/* ── STEP: saving ── */}
      {step === "saving" && (
        <div className="text-center py-10">
          <div className="relative w-16 h-16 mx-auto mb-4">
            <div className="w-16 h-16 rounded-full border-4 border-gray-200" />
            <div
              className="absolute top-0 left-0 w-16 h-16 rounded-full border-4 border-t-transparent animate-spin"
              style={{ borderColor: "#1D9E75", borderTopColor: "transparent" }}
            />
          </div>
          <p className="text-gray-700 font-bold">جارٍ الحفظ...</p>
        </div>
      )}

      {/* ── STEP: done ── */}
      {step === "done" && (
        <div className="text-center py-8">
          <div className="text-6xl mb-4">✅</div>
          <p className="text-2xl font-bold text-gray-900 mb-2">
            تم إضافة {savedCount} طالب بنجاح
          </p>
          <p className="text-gray-500">يمكنك الآن بدء التقييم الأسبوعي</p>
        </div>
      )}

      {/* ── STEP: manual ── */}
      {step === "manual" && (
        <div>
          {extractError && (
            <div
              className="mb-4 p-3 rounded-lg text-sm"
              style={{ background: "#fff5f5", border: "1px solid #fecaca", color: "#b91c1c" }}
            >
              ⚠️ {extractError}
            </div>
          )}
          <div className="mb-3">
            <div className="flex items-center justify-between mb-2">
              <label className="font-medium text-gray-700 text-sm">أسماء الطلاب</label>
              <span className="text-xs text-gray-400">سطر واحد لكل اسم</span>
            </div>
            <textarea
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-right text-sm focus:outline-none focus:ring-2 resize-none"
              rows={10}
              placeholder={"أحمد محمد السلمي\nعبدالرحمن خالد\nسلطان فهد العنزي\n..."}
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
            />
            <p className="text-xs text-gray-400 mt-1">
              {manualText.split("\n").filter(n => n.trim()).length} اسم مُدخل
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleManualSave}
              disabled={!manualText.split("\n").filter(n => n.trim()).length}
              className="flex-1 py-3 rounded-xl text-white font-bold shadow-md hover:opacity-90 disabled:opacity-50"
              style={{ background: "#1D9E75" }}
            >
              مراجعة القائمة ←
            </button>
            <button
              onClick={() => { setExtractError(null); setStep("choice"); }}
              className="px-5 py-3 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50"
            >
              رجوع
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
