"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import { ETEC_LEVELS } from "@/lib/demo-data";
import { toEnglishDigits } from "@/lib/format";

// ─── Constants ────────────────────────────────────────────────────────────────

const Q_COUNT = 10;
const MAX_PAPERS = 40;
const ARABIC_LETTERS = ["أ", "ب", "ج", "د"] as const;

// ─── Types ────────────────────────────────────────────────────────────────────

interface CapturedPaper {
  id: string;
  imageBase64: string; // compressed for API
  thumbBase64: string; // tiny for UI
  reviewBase64: string; // clearer image for review
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
  thumbBase64: string;
  imageBase64?: string;
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
  const targetWidth = 1240;
  const targetHeight = 1754;
  const sourceWidth = video.videoWidth || targetWidth;
  const sourceHeight = video.videoHeight || targetHeight;
  const sourceRatio = sourceWidth / sourceHeight;
  const targetRatio = targetWidth / targetHeight;

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

  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, targetWidth, targetHeight);
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

  useEffect(() => {
    void start();
    return () => streamRef.current?.getTracks().forEach((track) => track.stop());
  }, [start]);

  const capture = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    drawVideoCoverToPortraitCanvas(video, canvas);
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
  const [showImage, setShowImage] = useState(false);
  const total = result.total || Q_COUNT;
  const levelColor = ETEC_LEVELS[result.level as keyof typeof ETEC_LEVELS]?.color ?? "#374151";
  const studentLabel = result.editedName || result.studentName || "ورقة بدون اسم";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" dir="rtl">
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

        <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 text-xs text-gray-500 flex-shrink-0 flex items-center justify-between gap-2">
          <span>الإجابات الصحيحة لا تظهر في واجهة المعلم.</span>
          {result.imageBase64 && (
            <button onClick={() => setShowImage(true)} className="rounded-lg border border-slate-200 bg-white px-2 py-1 font-bold text-[#1D9E75]">
              عرض الورقة كاملة
            </button>
          )}
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
      {showImage && result.imageBase64 && (
        <div className="fixed inset-0 z-[60] bg-black/80 p-4" dir="rtl">
          <div className="mx-auto flex h-full max-w-4xl flex-col rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 p-4">
              <div>
                <p className="font-black text-slate-900">صورة الورقة كاملة</p>
                <p className="text-xs font-bold text-slate-400">راجع الصورة والإجابات المقروءة قبل الاعتماد.</p>
              </div>
              <button onClick={() => setShowImage(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600">إغلاق</button>
            </div>
            <div className="grid min-h-0 flex-1 gap-4 overflow-hidden p-4 lg:grid-cols-[1fr_260px]">
              <div className="overflow-auto rounded-xl bg-slate-950 p-3">
                <img src={`data:image/jpeg;base64,${result.imageBase64}`} alt="صورة الورقة كاملة" className="mx-auto max-h-none w-full max-w-3xl rounded-lg object-contain" />
              </div>
              <div className="overflow-y-auto rounded-xl bg-slate-50 p-3">
                <h4 className="mb-3 text-sm font-black text-slate-700">الإجابات المقروءة</h4>
                <div className="grid grid-cols-2 gap-2">
                  {Array.from({ length: total }, (_, i) => i + 1).map((q) => (
                    <div key={q} className="rounded-lg bg-white px-3 py-2 text-sm font-bold text-slate-600">
                      س{formatCount(q)}: {localAnswers[`q${q}`] || "—"}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
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
  const [pendingCapture, setPendingCapture] = useState<{ raw: string; preview: string } | null>(null);
  const [captureMessage, setCaptureMessage] = useState<string | null>(null);
  const [retakingPaperId, setRetakingPaperId] = useState<string | null>(null);
  const [reviewingPaperId, setReviewingPaperId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Camera helpers ──────────────────────────────────────────────────────────

  const openCamera = useCallback(async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1240 }, height: { ideal: 1754 }, aspectRatio: { ideal: 0.7071 } },
      });
      streamRef.current = s;
      setCameraOpen(true);
      setCaptureMessage("تم فتح الكاميرا، ضع الورقة داخل الإطار");
      if ("vibrate" in navigator) navigator.vibrate?.(50);
      setTimeout(() => {
        if (videoRef.current) { videoRef.current.srcObject = s; videoRef.current.play(); }
      }, 80);
    } catch {
      alert("تعذّر فتح الكاميرا — تحقق من صلاحيات الكاميرا في المتصفح");
    }
  }, []);

  const closeCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOpen(false);
    setPendingCapture(null);
    setCapturedPreview(null);
  }, []);

  const captureOne = useCallback(async () => {
    if (papers.length >= MAX_PAPERS || captureBusy) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    setCaptureBusy(true);
    setCaptureFlash(true);
    setCaptureMessage("تم التقاط الصورة");
    if ("vibrate" in navigator) navigator.vibrate?.(35);

    try {
      drawVideoCoverToPortraitCanvas(video, canvas);
      const raw = canvas.toDataURL("image/jpeg", 0.95).split(",")[1];
      const preview = await compressImage(raw, 1100, 0.9);
      setPendingCapture({ raw, preview });
      setCapturedPreview(preview);
      setCaptureMessage("راجع الصورة قبل استخدامها");
      setCaptureBusy(false);
      window.setTimeout(() => setCaptureFlash(false), 180);
    } catch {
      setCaptureMessage("تعذّر التقاط الصورة، حاول مرة أخرى");
      setCaptureFlash(false);
      setCaptureBusy(false);
    }
  }, [captureBusy, papers.length]);

  const acceptCapture = useCallback(async () => {
    if (!pendingCapture) return;
    setCaptureBusy(true);
    const maxWidth = mode === "package" ? 1600 : 800;
    const quality = mode === "package" ? 0.88 : 0.8;
    const [compressed, thumb, review] = await Promise.all([
      compressImage(pendingCapture.raw, maxWidth, quality),
      compressImage(pendingCapture.raw, 360, 0.75),
      compressImage(pendingCapture.raw, 1100, 0.9),
    ]);
    setPapers((prev) => [...prev, { id: `p${Date.now()}`, imageBase64: compressed, thumbBase64: thumb, reviewBase64: review }]);
    setPendingCapture(null);
    setCapturedPreview(null);
    setCaptureMessage("تم حفظ الصورة، صوّر الورقة التالية");
    setCaptureBusy(false);
    if ("vibrate" in navigator) navigator.vibrate?.(35);
  }, [mode, pendingCapture]);

  const retakePendingCapture = useCallback(() => {
    setPendingCapture(null);
    setCapturedPreview(null);
    setCaptureMessage("ضع ورقة الاختبار داخل الإطار.");
  }, []);

  const addManualPaper = useCallback(() => {
    const paperId = `manual-${Date.now()}`;
    const blankAnswers = Object.fromEntries(Array.from({ length: Q_COUNT }, (_, index) => [`q${index + 1}`, ""]));
    setResults((prev) => [
      ...prev,
      {
        paperId,
        studentName: "",
        studentCode: "",
        editedName: "",
        matchedStudentId: null,
        matchConfidence: mode === "package" ? "needs_review" : undefined,
        answers: blankAnswers,
        score: 0,
        total: Q_COUNT,
        percentage: 0,
        level: "دون الأساسي",
        weakSkills: [],
        error: false,
        thumbBase64: "",
      },
    ]);
    closeCamera();
    setStep("review");
    setReviewingPaperId(paperId);
  }, [closeCamera, mode]);

  const handleGalleryUpload = useCallback(async (file: File | undefined) => {
    if (!file) return;
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    const raw = dataUrl.split(",")[1] ?? "";
    if (!raw) return;
    const [compressed, thumb, review] = await Promise.all([
      compressImage(raw, mode === "package" ? 1600 : 800, mode === "package" ? 0.88 : 0.8),
      compressImage(raw, 360, 0.75),
      compressImage(raw, 1100, 0.9),
    ]);
    setPapers((prev) => [...prev, { id: `p${Date.now()}`, imageBase64: compressed, thumbBase64: thumb, reviewBase64: review }]);
    setCaptureMessage("تم رفع الصورة من المعرض");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [mode]);

  // ── Scan a single image against the API ────────────────────────────────────

  const scanImage = async (imageBase64: string, paperId: string, thumbBase64: string): Promise<ScanResult> => {
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
        error: false, thumbBase64, imageBase64,
      };
    } catch (e) {
      clearTimeout(timer);
      const isTimeout = e instanceof Error && e.name === "AbortError";
      return {
        paperId, studentName: "", studentCode: "", editedName: "", answers: {}, score: 0,
        total: Q_COUNT, percentage: 0, level: "دون الأساسي", weakSkills: [], error: true,
        errorMsg: isTimeout ? `انتهت المهلة (${toEnglishDigits(mode === "package" ? 40 : 20)} ثانية) — أعد التصوير` : e instanceof Error ? e.message : "تعذّرت قراءة الورقة",
        thumbBase64, imageBase64,
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
    let done = 0;
    const allResults = await Promise.all(
      papers.map(async (paper) => {
        const result = await scanImage(paper.imageBase64, paper.id, paper.reviewBase64 || paper.thumbBase64);
        done++;
        setProcessingCount(done);
        return result;
      })
    );

    setResults(allResults);
    const successCount = allResults.filter((r) => !r.error).length;
    sendBrowserNotification(`تمت معالجة ${successCount} ورقة بنجاح ✓`);
    setStep("review");
  };

  // ── Retake specific paper (single scan from review) ─────────────────────────

  const handleRetakeCapture = async (newBase64: string) => {
    if (!retakingPaperId) return;
    const thumb = await compressImage(newBase64, 1100, 0.9);
    setRetakingPaperId(null);
    // Show scanning indicator for this row
      setResults((prev) =>
        prev.map((r) =>
          r.paperId === retakingPaperId
          ? { ...r, error: false, errorMsg: undefined, editedName: "جارٍ التحليل...", matchConfidence: undefined, matchedStudentId: null }
          : r
      )
    );
    const newResult = await scanImage(newBase64, retakingPaperId!, thumb);
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
        ? { ...r, matchedStudentId: studentId || null, matchConfidence: studentId ? "strong" : "needs_review" }
        : r
    )));

  const saveAll = async () => {
    const valid = results.filter((r) => !r.error);
    if (!valid.length) return;
    if (mode === "package" && valid.some((r) => !r.matchedStudentId)) {
      setSaveError("راجع المطابقة واختر الطالب لكل ورقة قبل الحفظ");
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

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm" dir="rtl">
      {/* Retake modal (camera) */}
      {retakingPaperId && (
        <RetakeModal
          onCapture={handleRetakeCapture}
          onClose={() => setRetakingPaperId(null)}
          maxWidth={mode === "package" ? 1600 : 800}
          quality={mode === "package" ? 0.9 : 0.8}
        />
      )}

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

      {cameraOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-slate-950 text-white" dir="rtl">
          <div className="flex items-center justify-between border-b border-white/10 bg-slate-950/95 px-4 py-3">
            <button onClick={closeCamera} className="rounded-xl border border-white/15 px-4 py-2 text-sm font-bold text-white/90">
              إغلاق
            </button>
            <div className="text-center">
              <h3 className="text-base font-black">تصحيح ورقة الاختبار</h3>
              <p className="text-xs font-bold text-white/55">
                تم تصوير {formatCount(papers.length)} من {formatCount(Math.min(totalStudents || MAX_PAPERS, MAX_PAPERS))}
              </p>
            </div>
            <button
              onClick={papers.length ? processAll : undefined}
              disabled={!papers.length}
              className="rounded-xl bg-white/10 px-4 py-2 text-sm font-bold text-white/90 disabled:opacity-40"
            >
              إنهاء
            </button>
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-4">
            <div className="mx-auto w-full max-w-sm">
              <div
                className={`relative overflow-hidden rounded-3xl border-2 border-white/30 bg-black shadow-2xl transition-all duration-150 ${captureFlash ? "scale-[0.99] ring-4 ring-teal-300/50" : ""}`}
                style={{ aspectRatio: "1 / 1.414" }}
              >
                <video ref={videoRef} className="absolute inset-0 h-full w-full object-cover" playsInline muted />
                {captureFlash && <div className="absolute inset-0 bg-white/45 pointer-events-none" />}
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="relative h-[90%] w-[88%]">
                    <div className="absolute right-0 top-0 h-9 w-9 border-r-4 border-t-4 border-white" />
                    <div className="absolute left-0 top-0 h-9 w-9 border-l-4 border-t-4 border-white" />
                    <div className="absolute bottom-0 right-0 h-9 w-9 border-b-4 border-r-4 border-white" />
                    <div className="absolute bottom-0 left-0 h-9 w-9 border-b-4 border-l-4 border-white" />
                  </div>
                </div>
                <div className="pointer-events-none absolute left-4 right-4 top-4 rounded-full bg-black/45 px-3 py-2 text-center text-sm font-bold">
                  ضع ورقة الاختبار داخل الإطار.
                </div>

                {capturedPreview && pendingCapture && (
                  <div className="absolute inset-0 z-10 flex flex-col bg-black">
                    <div className="min-h-0 flex-1 overflow-auto p-3">
                      <img src={`data:image/jpeg;base64,${capturedPreview}`} alt="معاينة الورقة" className="mx-auto h-full max-h-full rounded-2xl object-contain" />
                    </div>
                    <div className="border-t border-white/10 bg-slate-950 p-4">
                      <p className="mb-3 text-center text-sm font-bold text-white/80">راجع وضوح رقم الطالب وجميع الاختيارات.</p>
                      <div className="grid grid-cols-2 gap-3">
                        <button onClick={acceptCapture} disabled={captureBusy} className="rounded-2xl bg-[#1D9E75] py-3 text-sm font-black text-white disabled:opacity-60">
                          استخدام الصورة
                        </button>
                        <button onClick={retakePendingCapture} disabled={captureBusy} className="rounded-2xl border border-white/20 py-3 text-sm font-black text-white disabled:opacity-60">
                          إعادة التصوير
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-4 rounded-2xl bg-white/8 p-3 text-center text-sm font-bold leading-7 text-white/75">
                <p>ضع ورقة الاختبار داخل الإطار.</p>
                <p>تأكد من وضوح رقم الطالب وجميع الاختيارات.</p>
                {captureMessage && <p className="mt-1 text-[#5eead4]">{captureMessage}</p>}
              </div>
            </div>
          </div>

          <div className="border-t border-white/10 bg-slate-950/95 p-4">
            <canvas ref={canvasRef} className="hidden" />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => void handleGalleryUpload(event.target.files?.[0])}
            />
            <div className="mx-auto max-w-md space-y-3">
              <button
                onClick={captureOne}
                disabled={papers.length >= MAX_PAPERS || captureBusy || !!pendingCapture}
                className="w-full rounded-2xl bg-[#1D9E75] py-4 text-base font-black text-white shadow-lg disabled:opacity-50"
              >
                {captureBusy ? "جارٍ تجهيز الصورة..." : "تصوير الورقة"}
              </button>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => fileInputRef.current?.click()} className="rounded-2xl border border-white/15 py-3 text-sm font-bold text-white/90">
                  رفع صورة من المعرض
                </button>
                <button onClick={addManualPaper} className="rounded-2xl border border-white/15 py-3 text-sm font-bold text-white/90">
                  إدخال الإجابات يدويًا
                </button>
              </div>
              {papers.length > 0 && (
                <button onClick={processAll} className="w-full rounded-2xl bg-white py-3 text-sm font-black text-slate-950">
                  إنهاء وبدء التصحيح
                </button>
              )}
            </div>
          </div>
        </div>
      )}

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
            <div className="flex items-start justify-between mb-5 p-3 rounded-xl gap-3" style={{ background: "#f0fdfa", border: "1px solid #99f6e4" }}>
              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className="text-teal-700 font-bold text-sm">نموذج التصحيح مُدار من مدير النظام</span>
                </div>
                <p className="text-xs text-slate-500">المعلم يصوّر أوراق الطلاب فقط، ولا تظهر الإجابات الصحيحة في هذه الواجهة.</p>
              </div>
            </div>

            {papers.length >= MAX_PAPERS ? (
              <div className="text-center py-5 mb-5 rounded-xl border border-amber-200" style={{ background: "#fffbeb" }}>
                <p className="text-amber-700 font-bold mb-1">وصلت للحد الأقصى {formatCount(MAX_PAPERS)} ورقة</p>
                <p className="text-amber-600 text-sm">اضغط بدء التصحيح لمعالجة الأوراق</p>
              </div>
            ) : (
              <div className="text-center py-6 mb-5 border-2 border-dashed border-gray-200 rounded-xl">
                <div className="text-4xl mb-2">📷</div>
                <button onClick={openCamera} className="px-8 py-3 rounded-xl text-white font-bold shadow-md hover:opacity-90 mb-2" style={{ background: "#1D9E75" }}>
                  التصحيح بالكاميرا
                </button>
                <div className="mt-2 flex justify-center gap-2 text-xs font-bold text-gray-500">
                  <button onClick={() => fileInputRef.current?.click()} className="rounded-lg border border-gray-200 px-3 py-2 hover:bg-gray-50">
                    رفع صورة من المعرض
                  </button>
                  <button onClick={addManualPaper} className="rounded-lg border border-gray-200 px-3 py-2 hover:bg-gray-50">
                    إدخال الإجابات يدويًا
                  </button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => void handleGalleryUpload(event.target.files?.[0])}
                />
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
                      <img src={`data:image/jpeg;base64,${p.thumbBase64}`} alt={`ورقة ${formatCount(i + 1)}`} className="w-full h-full object-cover" />
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
                              <img src={`data:image/jpeg;base64,${r.thumbBase64}`} alt="" className="w-7 h-9 object-cover rounded border border-gray-200" />
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
              disabled={validResults.length === 0}
              className="w-full py-4 rounded-xl text-white font-bold text-lg shadow-md hover:opacity-90"
              style={{ background: "#1D9E75" }}
            >
              💾 حفظ نتائج {formatCount(validResults.length)} طالب في الفصل
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
