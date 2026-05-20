"use client";
import { useState, useRef, useCallback } from "react";
import { ETEC_LEVELS } from "@/lib/demo-data";
import { toEnglishDigits } from "@/lib/format";

// ─── Constants ────────────────────────────────────────────────────────────────

const Q_COUNT = 10;
const MAX_PAPERS = 40;
const A4_CAPTURE_WIDTH = 1240;
const A4_CAPTURE_HEIGHT = 1754;
const ARABIC_LETTERS = ["أ", "ب", "ج", "د"] as const;

// ─── Types ────────────────────────────────────────────────────────────────────

interface CapturedPaper {
  id: string;
  imageBase64: string; // compressed for API
  reviewBase64: string; // clearer image for teacher review
  thumbBase64: string; // tiny for UI
}

interface ScanResult {
  paperId: string;
  studentName: string;    // extracted by AI
  studentCode: string;    // extracted class student code
  editedName: string;     // teacher-editable
  matchedStudentId?: string | null;
  matchConfidence?: "strong" | "code_only" | "name_only" | "conflict" | "needs_review";
  answers: Record<string, string>;
  score: number;
  total: number;
  percentage: number;
  level: string;
  weakSkills: { question: string; skill: string }[];
  error: boolean;
  errorMsg?: string;
  reviewBase64: string;
  thumbBase64: string;
}

type ScannerStudent = {
  id: string;
  name: string;
  studentCode?: string | null;
};

type Step = "capture" | "processing" | "review" | "done";

const DIACRITICS = /[\u064B-\u065F\u0670]/g;
const ARABIC_DIGITS: Record<string, string> = {
  "٠": "0",
  "١": "1",
  "٢": "2",
  "٣": "3",
  "٤": "4",
  "٥": "5",
  "٦": "6",
  "٧": "7",
  "٨": "8",
  "٩": "9",
};

function normalizeStudentCode(value?: string | null) {
  const digits = String(value ?? "")
    .replace(/[٠-٩]/g, (digit) => ARABIC_DIGITS[digit] ?? digit)
    .replace(/[^\d]/g, "");
  if (!digits) return "";
  const numeric = Number(digits);
  return Number.isFinite(numeric) ? String(numeric) : digits;
}

function normalizeArabicName(name: string) {
  return name
    .trim()
    .replace(DIACRITICS, "")
    .replace(/ـ/g, "")
    .replace(/[إأآ]/g, "ا")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function namesSimilar(a: string, b: string) {
  const first = normalizeArabicName(a);
  const second = normalizeArabicName(b);
  if (!first || !second) return false;
  if (first === second) return true;
  return first.length >= 6 && second.length >= 6 && (first.includes(second) || second.includes(first));
}

function confidenceLabel(value?: ScanResult["matchConfidence"]) {
  const labels: Record<NonNullable<ScanResult["matchConfidence"]>, string> = {
    strong: "مطابق بالرقم والاسم",
    code_only: "مطابق بالرقم فقط",
    name_only: "مطابق بالاسم فقط",
    conflict: "تعارض بين الرقم والاسم",
    needs_review: "يحتاج اختيار يدوي",
  };
  return value ? labels[value] : "يحتاج اختيار يدوي";
}

function resolveStudentMatch(result: Pick<ScanResult, "studentCode" | "studentName" | "editedName">, students: ScannerStudent[]) {
  const code = normalizeStudentCode(result.studentCode);
  const scannedName = result.editedName || result.studentName;
  const codeMatch = code
    ? students.find((student) => normalizeStudentCode(student.studentCode) === code)
    : undefined;
  const nameMatch = scannedName
    ? students.find((student) => namesSimilar(student.name, scannedName))
    : undefined;

  if (codeMatch && (!scannedName || !nameMatch || codeMatch.id === nameMatch.id)) {
    return {
      matchedStudentId: codeMatch.id,
      matchConfidence: scannedName && nameMatch ? "strong" as const : "code_only" as const,
    };
  }

  if (codeMatch && nameMatch && codeMatch.id !== nameMatch.id) {
    return { matchedStudentId: null, matchConfidence: "conflict" as const };
  }

  if (!codeMatch && nameMatch) {
    return { matchedStudentId: nameMatch.id, matchConfidence: "name_only" as const };
  }

  return { matchedStudentId: null, matchConfidence: "needs_review" as const };
}

// ─── Utilities ────────────────────────────────────────────────────────────────

async function compressImage(base64: string, maxWidth: number, quality: number): Promise<string> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", quality).split(",")[1]);
    };
    img.onerror = () => resolve(base64); // fallback
    img.src = `data:image/jpeg;base64,${base64}`;
  });
}

function drawVideoCoverToPortraitCanvas(video: HTMLVideoElement, canvas: HTMLCanvasElement) {
  const sourceWidth = video.videoWidth || A4_CAPTURE_WIDTH;
  const sourceHeight = video.videoHeight || A4_CAPTURE_HEIGHT;
  canvas.width = A4_CAPTURE_WIDTH;
  canvas.height = A4_CAPTURE_HEIGHT;

  const ctx = canvas.getContext("2d");
  if (!ctx) return { sourceWidth, sourceHeight, canvasWidth: canvas.width, canvasHeight: canvas.height };

  const sourceRatio = sourceWidth / sourceHeight;
  const targetRatio = A4_CAPTURE_WIDTH / A4_CAPTURE_HEIGHT;
  let sx = 0;
  let sy = 0;
  let sw = sourceWidth;
  let sh = sourceHeight;

  if (sourceRatio > targetRatio) {
    sw = sourceHeight * targetRatio;
    sx = (sourceWidth - sw) / 2;
  } else {
    sh = sourceWidth / targetRatio;
    sy = (sourceHeight - sh) / 2;
  }

  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, A4_CAPTURE_WIDTH, A4_CAPTURE_HEIGHT);
  return { sourceWidth, sourceHeight, canvasWidth: canvas.width, canvasHeight: canvas.height };
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      resolve(result.includes(",") ? result.split(",")[1] : result);
    };
    reader.onerror = () => reject(new Error("تعذر قراءة الصورة"));
    reader.readAsDataURL(file);
  });
}

function sendBrowserNotification(body: string) {
  if (!("Notification" in window)) return;
  const show = () => new Notification("مِقياس", { body, icon: "/favicon.ico" });
  if (Notification.permission === "granted") {
    show();
  } else if (Notification.permission !== "denied") {
    Notification.requestPermission().then((p) => { if (p === "granted") show(); });
  }
}

function formatCount(value: number) {
  return toEnglishDigits(value);
}

function FullPaperImageModal({
  imageBase64,
  title,
  answers,
  onClose,
}: {
  imageBase64: string;
  title: string;
  answers?: Record<string, string>;
  onClose: () => void;
}) {
  const answerEntries = answers
    ? Object.entries(answers).sort(([a], [b]) => Number(a.replace(/\D/g, "")) - Number(b.replace(/\D/g, "")))
    : [];

  return (
    <div className="fixed inset-0 z-[70] bg-black/80 p-3" dir="rtl">
      <div className="mx-auto flex h-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 p-3">
          <div>
            <p className="font-black text-gray-900">{title}</p>
            <p className="text-xs text-gray-500">يمكنك تمرير الصورة وتكبيرها بإيماءة الجوال للتأكد من الورقة.</p>
          </div>
          <button onClick={onClose} className="rounded-full border border-gray-200 px-3 py-1.5 text-sm font-bold text-gray-600">
            إغلاق
          </button>
        </div>
        <div className="grid min-h-0 flex-1 gap-0 md:grid-cols-[1fr_260px]">
          <div className="min-h-0 overflow-auto bg-slate-950 p-3">
            <img
              src={`data:image/jpeg;base64,${imageBase64}`}
              alt={title}
              className="mx-auto h-auto max-w-none rounded-lg bg-white shadow-xl"
              style={{ width: "min(100%, 980px)" }}
            />
          </div>
          {answerEntries.length > 0 && (
            <aside className="max-h-full overflow-auto border-t border-gray-100 bg-white p-4 md:border-r md:border-t-0">
              <h4 className="mb-3 font-black text-gray-900">الإجابات المقروءة</h4>
              <div className="grid grid-cols-2 gap-2">
                {answerEntries.map(([key, value]) => (
                  <div key={key} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm">
                    <span className="font-bold text-gray-500">س{toEnglishDigits(key.replace(/\D/g, ""))}</span>
                    <span className="float-left font-black text-[#1D9E75]">{toEnglishDigits(value || "—")}</span>
                  </div>
                ))}
              </div>
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Retake Modal (single paper in review mode) ───────────────────────────────

function RetakeModal({
  onCapture,
  onClose,
  maxWidth = 800,
  quality = 0.8,
}: {
  onCapture: (base64: string) => void;
  onClose: () => void;
  maxWidth?: number;
  quality?: number;
}) {
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraReady, setCameraReady] = useState(false);

  const start = useCallback(async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1240 }, height: { ideal: 1754 }, aspectRatio: { ideal: 0.7071 } },
      });
      streamRef.current = s;
      setCameraReady(true);
      setTimeout(() => {
        if (videoRef.current) { videoRef.current.srcObject = s; videoRef.current.play(); }
      }, 80);
    } catch { onClose(); }
  }, [onClose]);

  // Auto-start camera
  useState(() => { start(); });

  const capture = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth || 1654;
    canvas.height = video.videoHeight || 2339;
    canvas.getContext("2d")!.drawImage(video, 0, 0, canvas.width, canvas.height);
    const raw = canvas.toDataURL("image/jpeg", 0.92).split(",")[1];
    streamRef.current?.getTracks().forEach((t) => t.stop());
    const compressed = await compressImage(raw, maxWidth, quality);
    onCapture(compressed);
  };

  const close = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" dir="rtl">
      <div className="bg-white rounded-2xl overflow-hidden shadow-2xl w-full max-w-sm">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <span className="font-bold text-gray-900">إعادة تصوير الورقة</span>
          <button onClick={close} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>
        <div className="relative bg-black" style={{ aspectRatio: "1 / 1.414" }}>
          <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" playsInline muted />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="relative" style={{ width: "88%", height: "90%" }}>
              <div className="absolute top-0 right-0 w-7 h-7 border-t-2 border-r-2 border-white" />
              <div className="absolute top-0 left-0 w-7 h-7 border-t-2 border-l-2 border-white" />
              <div className="absolute bottom-0 right-0 w-7 h-7 border-b-2 border-r-2 border-white" />
              <div className="absolute bottom-0 left-0 w-7 h-7 border-b-2 border-l-2 border-white" />
            </div>
          </div>
          <div className="absolute top-3 left-0 right-0 text-center text-white text-sm font-bold pointer-events-none" style={{ textShadow: "0 1px 3px rgba(0,0,0,0.8)" }}>
            ضع الورقة داخل الإطار
          </div>
        </div>
        <canvas ref={canvasRef} className="hidden" />
        <div className="p-4 flex gap-3">
          <button
            onClick={capture}
            disabled={!cameraReady}
            className="flex-1 py-3 rounded-xl text-white font-bold disabled:opacity-50"
            style={{ background: "#1D9E75" }}
          >
            📸 التقاط وتحليل
          </button>
          <button onClick={close} className="px-4 py-3 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-50">
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Per-Paper Answer Review Modal ───────────────────────────────────────────

function PaperReviewModal({
  result,
  onSave,
  onClose,
}: {
  result: ScanResult;
  onSave: (paperId: string, answers: Record<string, string>) => Promise<void>;
  onClose: () => void;
}) {
  const [localAnswers, setLocalAnswers] = useState<Record<string, string>>(result.answers);
  const [saving, setSaving] = useState(false);
  const [showFullPaper, setShowFullPaper] = useState(false);
  const total = result.total || Q_COUNT;
  const levelColor = ETEC_LEVELS[result.level as keyof typeof ETEC_LEVELS]?.color ?? "#374151";
  const studentLabel = result.editedName || result.studentName || "ورقة بدون اسم";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" dir="rtl">
      {showFullPaper && (
        <FullPaperImageModal
          imageBase64={result.reviewBase64 || result.thumbBase64}
          title={`ورقة ${studentLabel}`}
          answers={localAnswers}
          onClose={() => setShowFullPaper(false)}
        />
      )}
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm flex flex-col" style={{ maxHeight: "90vh" }}>
        {/* Header */}
        <div className="p-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <div>
            <p className="font-bold text-gray-900">{studentLabel}</p>
            <p className="text-xs text-gray-400 mt-0.5">راجع قراءة الطالب فقط، نموذج التصحيح مركزي</p>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold leading-none" style={{ color: levelColor }}>{toEnglishDigits(`${result.score}/${total}`)}</div>
            <div className="text-xs font-medium mt-1" style={{ color: levelColor }}>{result.level}</div>
          </div>
        </div>

        <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 text-xs text-gray-500 flex-shrink-0">
          <div className="flex items-center justify-between gap-2">
            <span>الإجابات الصحيحة لا تظهر في واجهة المعلم.</span>
            <button
              onClick={() => setShowFullPaper(true)}
              className="shrink-0 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-bold text-[#1D9E75]"
            >
              عرض الورقة كاملة
            </button>
          </div>
        </div>

        {/* Question rows */}
        <div className="overflow-y-auto flex-1 px-4 py-3 space-y-2.5">
          {Array.from({ length: total }, (_, i) => i + 1).map((q) => {
            const qKey = `q${q}`;
            const selected = localAnswers[qKey] ?? "";

            return (
              <div key={q} className="flex items-center gap-2">
                <span className="w-7 text-xs text-gray-500 text-center flex-shrink-0 font-medium">س{formatCount(q)}</span>
                <div className="flex gap-1 flex-1">
                  {ARABIC_LETTERS.map((letter) => {
                    const isSelected = selected === letter;
                    return (
                      <button
                        key={letter}
                        onClick={() => setLocalAnswers((prev) => ({ ...prev, [qKey]: letter }))}
                        className="flex-1 h-9 rounded-lg font-bold text-sm border-2 transition-all hover:opacity-80"
                        style={
                          isSelected
                            ? { background: "#1D9E75", borderColor: "#1D9E75", color: "white" }
                            : { borderColor: "#e5e7eb", color: "#374151" }
                        }
                      >
                        {letter}
                      </button>
                    );
                  })}
                </div>
                <span className="w-5 text-center text-sm flex-shrink-0 font-bold" style={{ color: selected ? "#1D9E75" : "#9ca3af" }}>
                  {selected ? "✓" : "—"}
                </span>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 flex gap-3 flex-shrink-0">
          <button
            onClick={async () => {
              setSaving(true);
              await onSave(result.paperId, localAnswers);
              setSaving(false);
            }}
            disabled={saving}
            className="flex-1 py-3 rounded-xl text-white font-bold text-sm hover:opacity-90 transition-all disabled:opacity-60"
            style={{ background: "#1D9E75" }}
          >
            {saving ? "جارٍ إعادة التصحيح..." : "تأكيد القراءة وإعادة التصحيح"}
          </button>
          <button onClick={onClose} className="px-4 py-3 rounded-xl border border-gray-300 text-gray-700 text-sm hover:bg-gray-50">
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main BatchOMRScanner Component ──────────────────────────────────────────

export function BatchOMRScanner({
  totalStudents,
  subject,
  grade,
  weekNumber,
  mode = "weekly",
  classPackageAssignmentId,
  students = [],
  onComplete,
}: {
  totalStudents: number;
  subject: string;
  grade: string | number;
  weekNumber: number;
  mode?: "weekly" | "package";
  classPackageAssignmentId?: string;
  students?: ScannerStudent[];
  onComplete: (results: ScanResult[]) => Promise<void> | void;
}) {
  const [step, setStep] = useState<Step>("capture");
  const [papers, setPapers] = useState<CapturedPaper[]>([]);
  const [results, setResults] = useState<ScanResult[]>([]);
  const [processingCount, setProcessingCount] = useState(0);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [captureBusy, setCaptureBusy] = useState(false);
  const [captureFlash, setCaptureFlash] = useState(false);
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null);
  const [captureMessage, setCaptureMessage] = useState<string | null>(null);
  const [retakingPaperId, setRetakingPaperId] = useState<string | null>(null);
  const [reviewingPaperId, setReviewingPaperId] = useState<string | null>(null);
  const [viewingPaper, setViewingPaper] = useState<ScanResult | CapturedPaper | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const scannerRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // ── Camera helpers ──────────────────────────────────────────────────────────

  const openCamera = useCallback(async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: A4_CAPTURE_WIDTH }, height: { ideal: A4_CAPTURE_HEIGHT }, aspectRatio: { ideal: 0.7071 } },
      });
      streamRef.current = s;
      setCameraOpen(true);
      setCaptureMessage("تم فتح الكاميرا، ضع الورقة داخل الإطار");
      if ("vibrate" in navigator) navigator.vibrate?.(50);
      window.setTimeout(() => scannerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
      setTimeout(() => {
        if (videoRef.current) { videoRef.current.srcObject = s; videoRef.current.play(); }
      }, 80);
      window.setTimeout(() => setCaptureMessage((message) => message === "تم فتح الكاميرا، ضع الورقة داخل الإطار" ? null : message), 2600);
    } catch {
      alert("تعذّر فتح الكاميرا — تحقق من صلاحيات الكاميرا في المتصفح");
    }
  }, []);

  const closeCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOpen(false);
  }, []);

  const addPaperFromRaw = useCallback(async (raw: string, qualityHint?: string) => {
    setCaptureBusy(true);
    setCaptureFlash(true);
    setCaptureMessage("تم التقاط الصورة");
    if ("vibrate" in navigator) navigator.vibrate?.(35);

    try {
      const apiMaxWidth = mode === "package" ? 1500 : 900;
      const apiQuality = mode === "package" ? 0.8 : 0.8;
      const reviewMaxWidth = mode === "package" ? 1800 : 1400;
      const [compressed, review, thumb] = await Promise.all([
        compressImage(raw, apiMaxWidth, apiQuality),
        compressImage(raw, reviewMaxWidth, 0.9),
        compressImage(raw, 360, 0.75),
      ]);
      setCapturedPreview(review);
      setPapers((prev) => [...prev, { id: `p${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, imageBase64: compressed, reviewBase64: review, thumbBase64: thumb }]);
      if (qualityHint) {
        setCaptureMessage(qualityHint);
      }
      window.setTimeout(() => {
        setCapturedPreview(null);
        setCaptureMessage(null);
        setCaptureBusy(false);
      }, 1000);
      window.setTimeout(() => setCaptureFlash(false), 180);
    } catch {
      setCaptureMessage("تعذّر التقاط الصورة، حاول مرة أخرى");
      setCaptureFlash(false);
      setCaptureBusy(false);
    }
  }, [mode]);

  const captureOne = useCallback(async () => {
    if (papers.length >= MAX_PAPERS || captureBusy) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const captureInfo = drawVideoCoverToPortraitCanvas(video, canvas);
    console.debug("miqyas capture dimensions", {
      videoWidth: captureInfo.sourceWidth,
      videoHeight: captureInfo.sourceHeight,
      canvasWidth: captureInfo.canvasWidth,
      canvasHeight: captureInfo.canvasHeight,
    });
    const raw = canvas.toDataURL("image/jpeg", 0.95).split(",")[1];
    const qualityHint = captureInfo.sourceWidth < 1000 || captureInfo.sourceHeight < 1400
      ? "تم الالتقاط، لكن جودة الكاميرا منخفضة. قرّب الورقة قليلًا وحافظ على الإضاءة."
      : undefined;
    await addPaperFromRaw(raw, qualityHint);
  }, [addPaperFromRaw, captureBusy, papers.length]);

  const handleGalleryUpload = async (files: FileList | null) => {
    if (!files?.length) return;
    const remaining = MAX_PAPERS - papers.length;
    const selected = Array.from(files).slice(0, remaining);
    for (const file of selected) {
      const raw = await fileToBase64(file);
      await addPaperFromRaw(raw);
    }
    if (galleryInputRef.current) galleryInputRef.current.value = "";
  };

  // ── Scan a single image against the API ────────────────────────────────────

  const scanImage = async (imageBase64: string, paperId: string, thumbBase64: string, reviewBase64 = imageBase64): Promise<ScanResult> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), mode === "package" ? 40000 : 20000);
    try {
      if (mode === "package" && !classPackageAssignmentId) {
        throw new Error("لا يمكن بدء تصحيح حزمة مقياس بدون تعيين الحزمة على الفصل.");
      }

      const endpoint = mode === "package" ? "/api/scan-package-omr" : "/api/scan-omr";
      const scanMode = mode === "package" ? "question_paper" : undefined;
      console.debug("miqyas scan request", {
        packageMode: mode === "package",
        endpoint,
        classPackageAssignmentId: classPackageAssignmentId ?? null,
        scanMode,
      });

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "package"
            ? { classPackageAssignmentId, imageBase64, mimeType: "image/jpeg", scanMode: "question_paper" }
            : { imageBase64, mimeType: "image/jpeg", subject, grade, weekNumber }
        ),
        signal: controller.signal,
      });
      clearTimeout(timer);
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || "تعذّر تحليل الورقة");

      const result = json.result as {
        studentName?: string;
        studentCode?: string;
        answers?: Record<string, string>;
        score?: number;
        total?: number;
        percentage?: number;
        level?: string;
        weakSkills?: { question: string; skill: string }[];
      };
      const studentName = (result.studentName ?? "").trim();
      const studentCode = normalizeStudentCode(result.studentCode ?? "");
      const match: Pick<ScanResult, "matchedStudentId" | "matchConfidence"> = mode === "package"
        ? resolveStudentMatch({ studentName, studentCode, editedName: studentName }, students)
        : { matchedStudentId: null, matchConfidence: undefined };
      console.debug("miqyas scan match", {
        paperId,
        studentName,
        studentCode,
        matchedStudentId: match.matchedStudentId ?? null,
        matchConfidence: match.matchConfidence ?? null,
      });

      return {
        paperId, studentName, studentCode, editedName: studentName,
        matchedStudentId: match.matchedStudentId,
        matchConfidence: match.matchConfidence,
        answers: result.answers ?? {},
        score: result.score ?? 0,
        total: result.total ?? Q_COUNT,
        percentage: result.percentage ?? 0,
        level: result.level ?? "دون الأساسي",
        weakSkills: result.weakSkills ?? [],
        error: false, reviewBase64, thumbBase64,
      };
    } catch (e) {
      clearTimeout(timer);
      const isTimeout = e instanceof Error && e.name === "AbortError";
      return {
        paperId, studentName: "", studentCode: "", editedName: "", answers: {}, score: 0,
        total: Q_COUNT, percentage: 0, level: "دون الأساسي", weakSkills: [], error: true,
        errorMsg: isTimeout ? `انتهت المهلة (${toEnglishDigits(mode === "package" ? 40 : 20)} ثانية) — أعد التصوير` : e instanceof Error ? e.message : "تعذّرت قراءة الورقة",
        reviewBase64,
        thumbBase64,
      };
    }
  };

  // ── Batch processing ────────────────────────────────────────────────────────

  const processAll = async () => {
    if (!papers.length) return;
    if (mode === "package" && !classPackageAssignmentId) {
      setSaveError("لا يمكن بدء تصحيح حزمة مقياس بدون تعيين الحزمة على الفصل.");
      return;
    }
    closeCamera();
    setStep("processing");
    setProcessingCount(0);
    const allResults: ScanResult[] = [];

    for (const paper of papers) {
      const startedAt = new Date().toISOString();
      console.debug("miqyas paper scan start", {
        paperId: paper.id,
        imageBase64Length: paper.imageBase64.length,
        startedAt,
      });
      try {
        const result = await scanImage(paper.imageBase64, paper.id, paper.thumbBase64, paper.reviewBase64);
        const finishedAt = new Date().toISOString();
        console.debug("miqyas paper scan finish", {
          paperId: paper.id,
          imageBase64Length: paper.imageBase64.length,
          startedAt,
          finishedAt,
          success: !result.error,
          failure: result.error,
          errorMessage: result.errorMsg ?? null,
        });
        allResults.push(result);
      } catch (err) {
        const finishedAt = new Date().toISOString();
        const errorMessage = err instanceof Error ? err.message : "تعذرت قراءة الورقة";
        console.debug("miqyas paper scan finish", {
          paperId: paper.id,
          imageBase64Length: paper.imageBase64.length,
          startedAt,
          finishedAt,
          success: false,
          failure: true,
          errorMessage,
        });
        allResults.push({
          paperId: paper.id,
          studentName: "",
          studentCode: "",
          editedName: "",
          answers: {},
          score: 0,
          total: Q_COUNT,
          percentage: 0,
          level: "دون الأساسي",
          weakSkills: [],
          error: true,
          errorMsg: errorMessage,
          reviewBase64: paper.reviewBase64,
          thumbBase64: paper.thumbBase64,
        });
      } finally {
        setProcessingCount(allResults.length);
      }
    }

    setResults(allResults);
    const successCount = allResults.filter((r) => !r.error).length;
    sendBrowserNotification(`تمت معالجة ${successCount} ورقة بنجاح ✓`);
    setStep("review");
  };

  // ── Retake specific paper (single scan from review) ─────────────────────────

  const handleRetakeCapture = async (newBase64: string) => {
    if (!retakingPaperId) return;
    const [review, thumb] = await Promise.all([
      compressImage(newBase64, mode === "package" ? 2200 : 1400, 0.9),
      compressImage(newBase64, 120, 0.6),
    ]);
    setRetakingPaperId(null);
    // Show scanning indicator for this row
      setResults((prev) =>
        prev.map((r) =>
          r.paperId === retakingPaperId
          ? { ...r, error: false, errorMsg: undefined, editedName: "جارٍ التحليل...", matchConfidence: undefined, matchedStudentId: null }
          : r
      )
    );
    const newResult = await scanImage(newBase64, retakingPaperId!, thumb, review);
    setResults((prev) => prev.map((r) => (r.paperId === retakingPaperId ? { ...newResult, editedName: newResult.studentName } : r)));
  };

  // ── Per-question review save ────────────────────────────────────────────────

  const handleReviewSave = async (paperId: string, answers: Record<string, string>) => {
    try {
      if (mode === "package" && !classPackageAssignmentId) {
        throw new Error("لا يمكن بدء تصحيح حزمة مقياس بدون تعيين الحزمة على الفصل.");
      }

      const endpoint = mode === "package" ? "/api/scan-package-omr" : "/api/scan-omr";
      console.debug("miqyas scan request", {
        packageMode: mode === "package",
        endpoint,
        classPackageAssignmentId: classPackageAssignmentId ?? null,
        scanMode: mode === "package" ? "question_paper" : undefined,
      });

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "package"
            ? { classPackageAssignmentId, studentAnswers: answers }
            : { studentAnswers: answers, subject, grade, weekNumber }
        ),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || "تعذّرت إعادة التصحيح");
      const graded = json.result as { answers: Record<string, string>; score: number; total: number; percentage: number; level: string; weakSkills: { question: string; skill: string }[] };
      setResults((prev) =>
        prev.map((r) =>
          r.paperId === paperId
            ? { ...r, answers: graded.answers, score: graded.score, total: graded.total, percentage: graded.percentage, level: graded.level, weakSkills: graded.weakSkills }
            : r
        )
      );
      setReviewingPaperId(null);
    } catch {
      alert("تعذّرت إعادة التصحيح — حاول مرة أخرى");
    }
  };

  // ── Review actions ──────────────────────────────────────────────────────────

  const updateName = (paperId: string, name: string) =>
    setResults((prev) => prev.map((r) => {
      if (r.paperId !== paperId) return r;
      const match: Pick<ScanResult, "matchedStudentId" | "matchConfidence"> = mode === "package"
        ? resolveStudentMatch({ studentName: r.studentName, studentCode: r.studentCode, editedName: name }, students)
        : { matchedStudentId: null, matchConfidence: undefined };
      return { ...r, editedName: name, matchedStudentId: match.matchedStudentId, matchConfidence: match.matchConfidence };
    }));

  const updateMatchedStudent = (paperId: string, studentId: string) =>
    setResults((prev) => prev.map((r) => (
      r.paperId === paperId
        ? (() => {
            const next = { ...r, matchedStudentId: studentId || null, matchConfidence: studentId ? "strong" as const : "needs_review" as const };
            console.debug("miqyas manual match", {
              paperId: next.paperId,
              studentName: next.studentName || next.editedName,
              studentCode: next.studentCode,
              matchedStudentId: next.matchedStudentId,
              matchConfidence: next.matchConfidence,
            });
            return next;
          })()
        : r
    )));

  const saveAll = async () => {
    const valid = results.filter((r) => !r.error);
    if (!valid.length) return;
    const unmatchedValid = valid.filter((r) => !r.matchedStudentId);
    if (mode === "package" && unmatchedValid.length) {
      console.debug("miqyas unmatched papers before save", unmatchedValid.map((r) => ({
        paperId: r.paperId,
        studentName: r.studentName || r.editedName,
        studentCode: r.studentCode,
        matchedStudentId: r.matchedStudentId ?? null,
        matchConfidence: r.matchConfidence ?? null,
      })));
      setSaveError(`توجد ${formatCount(unmatchedValid.length)} ورقة تحتاج مطابقة يدوية قبل الحفظ`);
      return;
    }

    setSaveError(null);
    try {
      await onComplete(valid);
      setStep("done");
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "تعذر حفظ نتائج التصحيح");
    }
  };

  // ─── Derived ──────────────────────────────────────────────────────────────

  const validResults = results.filter((r) => !r.error);
  const errorResults = results.filter((r) => r.error);
  const unmatchedResults = mode === "package" ? validResults.filter((r) => !r.matchedStudentId) : [];

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div ref={scannerRef} className="bg-white rounded-xl border border-gray-200 shadow-sm" dir="rtl">
      {/* Retake modal (camera) */}
      {retakingPaperId && (
        <RetakeModal
          onCapture={handleRetakeCapture}
          onClose={() => setRetakingPaperId(null)}
          maxWidth={mode === "package" ? 1900 : 900}
          quality={mode === "package" ? 0.85 : 0.8}
        />
      )}

      {viewingPaper && (() => {
        const imageBase64 = viewingPaper.reviewBase64 || ("imageBase64" in viewingPaper ? viewingPaper.imageBase64 : viewingPaper.thumbBase64);
        return (
          <FullPaperImageModal
            imageBase64={imageBase64}
            title={"عرض الورقة كاملة"}
            answers={"answers" in viewingPaper ? viewingPaper.answers : undefined}
            onClose={() => setViewingPaper(null)}
          />
        );
      })()}

      {/* Per-question review modal */}
      {reviewingPaperId && (() => {
        const r = results.find((x) => x.paperId === reviewingPaperId);
        return r ? (
          <PaperReviewModal
            result={r}
            onSave={handleReviewSave}
            onClose={() => setReviewingPaperId(null)}
          />
        ) : null;
      })()}

      {/* Header */}
      <div className="p-5 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="font-bold text-gray-900 text-lg">📷 مسح أوراق الفصل كاملاً</h3>
          <p className="text-gray-500 text-sm mt-0.5">
            {step === "capture" && "صوّر أوراق الطلاب، وسيتم التصحيح بنموذج مركزي من مدير النظام"}
            {step === "processing" && "جارٍ معالجة الأوراق بالتوازي..."}
            {step === "review" && "مراجعة النتائج وحفظها"}
            {step === "done" && "✅ تم حفظ نتائج الفصل"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs px-2.5 py-1 rounded-full font-bold" style={{ background: mode === "package" ? "#e6f7f1" : "#fff7ed", color: mode === "package" ? "#1D9E75" : "#c2410c" }}>
            {mode === "package" ? "وضع التصحيح: حزمة مقياس" : "وضع التصحيح: قديم"}
          </span>
          <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: "#e6f7f1", color: "#1D9E75" }}>
            الذكاء الاصطناعي
          </span>
        </div>
      </div>

      <div className="p-5">
        <div className={`mb-4 rounded-xl border p-3 text-sm font-bold ${mode === "package" ? "border-teal-100 bg-teal-50/70 text-teal-800" : "border-amber-100 bg-amber-50 text-amber-800"}`}>
          {mode === "package"
            ? "يتم قراءة اختيارات الطالب من ورقة الأسئلة وتصحيحها بمفتاح الإجابة المحمي."
            : "هذا المسار لا يستخدم حزم مقياس. للتصحيح بالحزم افتح تبويب اختبارات مقياس واختر الحزمة المطبقة على الفصل."}
        </div>

        {/* ── Capture ── */}
        {step === "capture" && (
          <div>
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(event) => void handleGalleryUpload(event.target.files)}
            />
            <div className="flex items-start justify-between mb-5 p-3 rounded-xl gap-3" style={{ background: "#f0fdfa", border: "1px solid #99f6e4" }}>
              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className="text-teal-700 font-bold text-sm">نموذج التصحيح مُدار من مدير النظام</span>
                </div>
                <p className="text-xs text-slate-500">المعلم يصوّر أوراق الطلاب فقط، ولا تظهر الإجابات الصحيحة في هذه الواجهة.</p>
              </div>
            </div>

            {/* Camera view */}
            {cameraOpen ? (
              <div className="fixed inset-0 z-50 flex flex-col bg-black text-white">
                <div className="fixed left-3 right-3 top-3 z-20 flex items-center justify-between rounded-2xl bg-black/55 px-3 py-2 backdrop-blur">
                  <button onClick={closeCamera} className="rounded-full bg-white/95 px-3 py-2 text-sm font-black text-gray-800 shadow">
                    إغلاق
                  </button>
                  <div className="text-center">
                    <p className="text-sm font-black text-white">ضع الورقة داخل الإطار</p>
                    <p className="text-xs text-white/75">تم تصوير {formatCount(papers.length)} / {formatCount(MAX_PAPERS)} ورقة</p>
                  </div>
                  <button
                    onClick={() => galleryInputRef.current?.click()}
                    className="rounded-full bg-white/95 px-3 py-2 text-sm font-black text-gray-800 shadow"
                  >
                    المعرض
                  </button>
                </div>
                {captureMessage && (
                  <div className="fixed left-6 right-6 top-20 z-20 rounded-full bg-white px-4 py-2 text-center text-sm font-black text-[#1D9E75] shadow-lg">
                    {captureMessage}
                  </div>
                )}
                <div
                  className={`relative mx-auto my-20 w-[min(92vw,430px)] max-h-[calc(100vh-170px)] overflow-hidden rounded-2xl border-4 bg-black transition-all duration-150 ${captureFlash ? "scale-[0.99] ring-4 ring-teal-200" : ""}`}
                  style={{ borderColor: "#1D9E75" }}
                >
                  <div className="relative h-full w-full" style={{ aspectRatio: "1 / 1.414" }}>
                    <video ref={videoRef} className="absolute inset-0 h-full w-full object-cover" playsInline muted />
                  </div>
                  {captureFlash && <div className="absolute inset-0 bg-white/45 pointer-events-none" />}
                  {capturedPreview && (
                    <div className="absolute inset-0 z-10 bg-black/70 flex items-center justify-center p-4">
                      <div className="relative h-full max-h-full rounded-xl overflow-hidden border-2 border-white/70 bg-black shadow-xl" style={{ aspectRatio: "1 / 1.414" }}>
                        <img src={`data:image/jpeg;base64,${capturedPreview}`} alt="معاينة الصورة الملتقطة" className="h-full w-full object-contain" />
                        <div className="absolute top-3 left-3 right-3 rounded-full bg-white/95 px-3 py-2 text-center text-sm font-bold text-teal-700 shadow-sm">
                          ✓ تم التقاط الصورة
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="relative" style={{ width: "82%", height: "82%", maxWidth: "420px", maxHeight: "84vh" }}>
                      <div className="absolute top-0 right-0 w-7 h-7 border-t-2 border-r-2 border-white" />
                      <div className="absolute top-0 left-0 w-7 h-7 border-t-2 border-l-2 border-white" />
                      <div className="absolute bottom-0 right-0 w-7 h-7 border-b-2 border-r-2 border-white" />
                      <div className="absolute bottom-0 left-0 w-7 h-7 border-b-2 border-l-2 border-white" />
                    </div>
                  </div>
                  <div className="absolute top-20 left-0 right-0 text-center text-white text-sm font-bold pointer-events-none" style={{ textShadow: "0 1px 3px rgba(0,0,0,0.8)" }}>
                    ضع الورقة داخل الإطار
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 py-1.5 text-white text-xs text-center" style={{ background: "rgba(0,0,0,0.55)" }}>
                    {captureMessage ?? `تم تصوير ${formatCount(papers.length)} / ${formatCount(MAX_PAPERS)} ورقة`}
                  </div>
                </div>
                <canvas ref={canvasRef} className="hidden" />
                <div className="fixed bottom-0 left-0 right-0 z-20 flex gap-3 bg-black/75 p-3 pb-[calc(env(safe-area-inset-bottom)+12px)] backdrop-blur">
                  <button
                    onClick={captureOne}
                    disabled={papers.length >= MAX_PAPERS || captureBusy}
                    className={`flex-1 py-3 rounded-xl text-white font-bold text-sm shadow-md hover:opacity-90 disabled:opacity-50 transition-all ${captureBusy ? "animate-pulse" : ""}`}
                    style={{ background: "#1D9E75" }}
                  >
                    {captureBusy ? "جارٍ تثبيت الصورة..." : "📸 التقاط ورقة"}
                  </button>
                  <button onClick={() => galleryInputRef.current?.click()} className="px-4 py-3 rounded-xl border border-white/25 bg-white/10 text-white text-sm font-bold hover:bg-white/15">
                    المعرض
                  </button>
                </div>
              </div>
            ) : papers.length >= MAX_PAPERS ? (
              <div className="text-center py-5 mb-5 rounded-xl border border-amber-200" style={{ background: "#fffbeb" }}>
                <p className="text-amber-700 font-bold mb-1">وصلت للحد الأقصى {formatCount(MAX_PAPERS)} ورقة</p>
                <p className="text-amber-600 text-sm">اضغط بدء التصحيح لمعالجة الأوراق</p>
              </div>
            ) : (
              <div className="text-center py-6 mb-5 border-2 border-dashed border-gray-200 rounded-xl">
                <div className="text-4xl mb-2">📷</div>
                <button onClick={openCamera} className="px-8 py-3 rounded-xl text-white font-bold shadow-md hover:opacity-90 mb-2" style={{ background: "#1D9E75" }}>
                  تصوير ورقة
                </button>
                <p className="text-gray-400 text-sm">
                  {papers.length === 0 ? `صوّر أوراق الـ ${formatCount(totalStudents)} طالب` : `تم تصوير ${formatCount(papers.length)} / ${formatCount(MAX_PAPERS)} ورقة — يمكنك إضافة المزيد`}
                </p>
              </div>
            )}

            {/* Thumbnails */}
            {papers.length > 0 && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">
                    تم تصوير <span className="font-bold" style={{ color: "#1D9E75" }}>{formatCount(papers.length)}</span> / <span className="font-bold">{formatCount(MAX_PAPERS)}</span> ورقة
                  </span>
                  {totalStudents > 0 && papers.length < totalStudents && papers.length < MAX_PAPERS && (
                    <span className="text-xs text-amber-600 font-medium">
                      ⚠️ {formatCount(totalStudents - papers.length)} ورقة متبقية
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-5 gap-2 mb-4">
                  {papers.map((p, i) => (
                    <div key={p.id} className="relative group rounded-lg overflow-hidden border-2 border-gray-200" style={{ aspectRatio: "3/4" }}>
                      <button
                        type="button"
                        onClick={() => setViewingPaper(p)}
                        className="h-full w-full"
                        title="عرض الورقة كاملة"
                      >
                        <img src={`data:image/jpeg;base64,${p.thumbBase64}`} alt={`ورقة ${formatCount(i + 1)}`} className="w-full h-full object-cover" />
                      </button>
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button onClick={() => setPapers((prev) => prev.filter((pp) => pp.id !== p.id))} className="w-7 h-7 rounded-full bg-red-500 text-white text-lg leading-none flex items-center justify-center">
                          ×
                        </button>
                      </div>
                      <div className="absolute bottom-0.5 right-0.5 bg-black/60 text-white text-xs rounded px-1 leading-4">
                        {formatCount(i + 1)}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mb-3 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      setPapers((prev) => prev.slice(0, -1));
                      void openCamera();
                    }}
                    className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50"
                  >
                    إعادة تصوير آخر ورقة
                  </button>
                  <button
                    onClick={() => galleryInputRef.current?.click()}
                    className="rounded-xl border border-teal-100 bg-teal-50 px-3 py-2.5 text-sm font-bold text-[#1D9E75]"
                  >
                    استخدام صورة من المعرض
                  </button>
                </div>
                {/* Start grading button — always visible once papers exist and camera is closed */}
                {!cameraOpen && (
                  <button onClick={processAll} className="w-full py-4 rounded-xl text-white font-bold text-lg shadow-lg hover:opacity-90" style={{ background: "#1D9E75" }}>
                    بدء تصحيح {formatCount(papers.length)} ورقة
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Processing ── */}
        {step === "processing" && (
          <div className="py-10 text-center">
            <div className="relative w-20 h-20 mx-auto mb-5">
              <div className="w-20 h-20 rounded-full border-4 border-gray-200" />
              <div className="absolute top-0 left-0 w-20 h-20 rounded-full border-4 border-t-transparent animate-spin" style={{ borderColor: "#7F77DD", borderTopColor: "transparent" }} />
            </div>
            <p className="font-bold text-gray-900 text-lg mb-1">
              جارٍ تحليل الأوراق... {toEnglishDigits(`${processingCount}/${papers.length}`)}
            </p>
            <p className="text-gray-500 text-sm mb-5">
              {processingCount < papers.length
                ? "جارٍ تحليل الصورة... (قد يستغرق 10-15 ثانية لكل ورقة)"
                : "اكتملت المعالجة — جارٍ تجميع النتائج..."}
            </p>
            <div className="w-full max-w-xs mx-auto bg-gray-100 rounded-full h-3 mb-2">
              <div
                className="h-3 rounded-full transition-all duration-500"
                style={{ width: `${papers.length ? (processingCount / papers.length) * 100 : 0}%`, background: "#7F77DD" }}
              />
            </div>
            <p className="text-xs text-gray-400">يعالج جميع الأوراق في نفس الوقت بالتوازي</p>
          </div>
        )}

        {/* ── Review ── */}
        {step === "review" && (
          <div>
            {/* Level summary cards */}
            <div className="grid grid-cols-4 gap-2 mb-5">
              {(["متقدم", "متمكن", "أساسي", "دون الأساسي"] as const).map((lvl) => {
                const cfg = ETEC_LEVELS[lvl];
                const count = validResults.filter((r) => r.level === lvl).length;
                return (
                  <div key={lvl} className="rounded-xl p-3 text-center border" style={{ borderColor: cfg.color + "40", background: cfg.color + "12" }}>
                    <div className="text-2xl font-bold" style={{ color: cfg.color }}>{formatCount(count)}</div>
                    <div className="text-xs font-medium text-gray-600 mt-0.5">{lvl}</div>
                  </div>
                );
              })}
            </div>

            {/* Error banner */}
            {errorResults.length > 0 && (
              <div className="mb-4 p-3 rounded-xl text-sm flex items-start gap-2" style={{ background: "#fff5f5", border: "1px solid #fecaca", color: "#b91c1c" }}>
                <span>⚠️</span>
                <span>{formatCount(errorResults.length)} ورقة لم تتم قراءتها — اضغط أعد التصوير لكل ورقة فاشلة</span>
              </div>
            )}

            {saveError && (
              <div className="mb-4 p-3 rounded-xl text-sm font-bold" style={{ background: "#fff5f5", border: "1px solid #fecaca", color: "#b91c1c" }}>
                {saveError}
              </div>
            )}

            {unmatchedResults.length > 0 && (
              <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50/80 p-4">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <h4 className="font-black text-amber-900">أوراق تحتاج مطابقة يدوية</h4>
                    <p className="mt-1 text-sm text-amber-800">
                      اختر الطالب الصحيح لكل ورقة حتى لا يتم تجاهلها عند حفظ الدفعة.
                    </p>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-amber-700 ring-1 ring-amber-200">
                    {formatCount(unmatchedResults.length)} ورقة
                  </span>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {unmatchedResults.map((r) => (
                    <div key={r.paperId} className="flex gap-3 rounded-xl border border-amber-100 bg-white p-3 shadow-sm">
                      {r.thumbBase64 && (
                        <button type="button" onClick={() => setViewingPaper(r)} className="shrink-0" title="عرض الورقة كاملة">
                          <img
                            src={`data:image/jpeg;base64,${r.thumbBase64}`}
                            alt="صورة الورقة غير المطابقة"
                            className="h-24 w-16 rounded-lg border border-gray-200 object-cover"
                          />
                        </button>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
                          <div>
                            <span className="block font-bold text-gray-400">الاسم المقروء</span>
                            <span className="font-black text-gray-800">{r.studentName || r.editedName || "غير مقروء"}</span>
                          </div>
                          <div>
                            <span className="block font-bold text-gray-400">رقم الطالب المقروء</span>
                            <span className="font-black text-gray-800">{r.studentCode ? toEnglishDigits(r.studentCode) : "غير مقروء"}</span>
                          </div>
                        </div>
                        <label className="mt-3 block text-xs font-bold text-gray-500">اختر الطالب من الفصل</label>
                        <select
                          value={r.matchedStudentId ?? ""}
                          onChange={(e) => updateMatchedStudent(r.paperId, e.target.value)}
                          className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-2 text-sm text-gray-700 outline-none focus:border-[#1D9E75]"
                        >
                          <option value="">اختر الطالب يدويًا</option>
                          {students.map((student) => (
                            <option key={student.id} value={student.id}>
                              {toEnglishDigits(normalizeStudentCode(student.studentCode) || "—")} - {student.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Results table */}
            <div className="rounded-xl border border-gray-200 overflow-hidden mb-5">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-right px-3 py-3 text-xs font-medium text-gray-500">#</th>
                    {mode === "package" && <th className="text-right px-3 py-3 text-xs font-medium text-gray-500">رقم الطالب المقروء</th>}
                    <th className="text-right px-3 py-3 text-xs font-medium text-gray-500">{mode === "package" ? "الاسم المقروء" : "اسم الطالب"}</th>
                    {mode === "package" && <th className="text-right px-3 py-3 text-xs font-medium text-gray-500">الطالب المطابق</th>}
                    {mode === "package" && <th className="text-right px-3 py-3 text-xs font-medium text-gray-500">حالة المطابقة</th>}
                    <th className="text-right px-3 py-3 text-xs font-medium text-gray-500">الدرجة</th>
                    <th className="text-right px-3 py-3 text-xs font-medium text-gray-500">المستوى</th>
                    <th className="text-right px-3 py-3 text-xs font-medium text-gray-500">إجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {results.map((r, i) => {
                    const cfg = !r.error && r.level ? ETEC_LEVELS[r.level as keyof typeof ETEC_LEVELS] : null;
                    return (
                      <tr key={r.paperId} className={r.error ? "bg-red-50/40" : "hover:bg-gray-50"}>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1.5">
                            {r.thumbBase64 && (
                              <button type="button" onClick={() => setViewingPaper(r)} title="عرض الورقة كاملة">
                                <img src={`data:image/jpeg;base64,${r.thumbBase64}`} alt="" className="w-7 h-9 object-cover rounded border border-gray-200" />
                              </button>
                            )}
                            <span className="text-gray-400 text-sm">{formatCount(i + 1)}</span>
                          </div>
                        </td>
                        {mode === "package" && (
                          <td className="px-3 py-3 text-sm font-bold text-gray-700">
                            {r.error ? "—" : r.studentCode ? toEnglishDigits(r.studentCode) : <span className="text-gray-300">غير مقروء</span>}
                          </td>
                        )}
                        <td className="px-3 py-3">
                          {r.error ? (
                            <span className="text-red-400 text-sm italic">{r.errorMsg ?? "تعذّرت القراءة"}</span>
                          ) : (
                            <div>
                              <input
                                className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-right w-full focus:outline-none focus:ring-1 max-w-[180px]"
                                style={{ "--tw-ring-color": "#1D9E75" } as React.CSSProperties}
                                value={r.editedName}
                                onChange={(e) => updateName(r.paperId, e.target.value)}
                                placeholder="أدخل اسم الطالب"
                              />
                              {r.studentName && r.studentName !== r.editedName && (
                                <p className="text-xs text-gray-400 mt-0.5">
                                  الذكاء الاصطناعي: {r.studentName}
                                </p>
                              )}
                            </div>
                          )}
                        </td>
                        {mode === "package" && (
                          <td className="px-3 py-3">
                            {r.error ? "—" : (
                              <select
                                value={r.matchedStudentId ?? ""}
                                onChange={(e) => updateMatchedStudent(r.paperId, e.target.value)}
                                className="w-full min-w-40 rounded-lg border border-gray-200 px-2 py-1.5 text-sm text-gray-700 outline-none focus:border-[#1D9E75]"
                              >
                                <option value="">اختر الطالب يدويًا</option>
                                {students.map((student) => (
                                  <option key={student.id} value={student.id}>
                                    {toEnglishDigits(normalizeStudentCode(student.studentCode) || "—")} - {student.name}
                                  </option>
                                ))}
                              </select>
                            )}
                          </td>
                        )}
                        {mode === "package" && (
                          <td className="px-3 py-3">
                            {r.error ? "—" : (
                              <span className={`rounded-full px-2 py-1 text-xs font-bold ${
                                r.matchConfidence === "conflict"
                                  ? "bg-rose-50 text-rose-700"
                                  : r.matchConfidence === "needs_review"
                                    ? "bg-amber-50 text-amber-700"
                                    : "bg-teal-50 text-teal-700"
                              }`}>
                                {confidenceLabel(r.matchConfidence)}
                              </span>
                            )}
                          </td>
                        )}
                        <td className="px-3 py-3 text-sm font-bold text-gray-900">
                          {r.error ? "—" : toEnglishDigits(`${r.score}/${r.total}`)}
                        </td>
                        <td className="px-3 py-3">
                          {cfg && !r.error ? (
                            <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: cfg.color + "22", color: cfg.color }}>
                              {r.level}
                            </span>
                          ) : "—"}
                        </td>
                        <td className="px-3 py-3">
                          {r.error ? (
                            <button
                              onClick={() => setRetakingPaperId(r.paperId)}
                              className="text-xs border rounded-lg px-2 py-1.5 hover:bg-red-50 transition-all"
                              style={{ borderColor: "#fca5a5", color: "#b91c1c" }}
                            >
                              ⟳ أعد التصوير
                            </button>
                          ) : (
                            <div className="flex gap-1.5">
                              <button
                                onClick={() => setReviewingPaperId(r.paperId)}
                                className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 hover:bg-gray-50 transition-all"
                                style={{ color: "#7F77DD" }}
                              >
                                ✏️ مراجعة
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <button
              onClick={saveAll}
              disabled={validResults.length === 0 || unmatchedResults.length > 0}
              className="w-full py-4 rounded-xl text-white font-bold text-lg shadow-md hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              style={{ background: "#1D9E75" }}
            >
              {unmatchedResults.length > 0
                ? `أكمل مطابقة ${formatCount(unmatchedResults.length)} ورقة قبل الحفظ`
                : `💾 حفظ نتائج ${formatCount(validResults.length)} طالب في الفصل`}
            </button>
          </div>
        )}

        {/* ── Done ── */}
        {step === "done" && (
          <div className="text-center py-10">
            <div className="text-6xl mb-4">🎉</div>
            <p className="text-2xl font-bold text-gray-900 mb-2">
              تم حفظ نتائج {formatCount(validResults.length)} طالب بنجاح
            </p>
            <p className="text-gray-500 text-sm">يمكنك الآن مراجعة النتائج في جدول الطلاب</p>
          </div>
        )}
      </div>
    </div>
  );
}
