"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import { ETEC_LEVELS } from "@/lib/levels";
import { normalizeStudentCode, toEnglishDigits } from "@/lib/format";
import { COLORS } from "@/lib/theme";
import { BRAND } from "@/lib/brand";

// ─── Constants ────────────────────────────────────────────────────────────────

const Q_COUNT = 10;
const MAX_PAPERS = 40;
// Package scanning settings (the only scan mode since the weekly-questions flow was removed).
const SCAN_ENDPOINT = "/api/scan-package-omr";
const SCAN_MAX_WIDTH = 1600;
const SCAN_QUALITY = 0.88;
const SCAN_RETAKE_QUALITY = 0.9;
const SCAN_TIMEOUT_MS = 40_000;
const MISSING_ASSIGNMENT_ERROR = "لا يمكن بدء التصحيح بدون تعيين الحزمة على الفصل.";

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
  const show = () => new Notification(BRAND.nameAr, { body, icon: "/favicon.ico" });
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
        <div className="relative mx-auto bg-black" style={{ aspectRatio: "1 / 1.414", width: "min(100%, calc((100dvh - 11rem) / 1.414))" }}>
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
            style={{ background: COLORS.brand }}
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
            <button onClick={() => setShowImage(true)} className="rounded-lg border border-slate-200 bg-white px-2 py-1 font-bold text-brand">
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
                            ? { background: COLORS.brand, borderColor: COLORS.brand, color: "white" }
                            : { borderColor: "#e5e7eb", color: "#374151" }
                        }
                      >
                        {letter}
                      </button>
                    );
                  })}
                </div>
                <span className="w-5 text-center text-sm flex-shrink-0 font-bold" style={{ color: selected ? COLORS.brand : "#9ca3af" }}>
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
            style={{ background: COLORS.brand }}
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
                {/* eslint-disable-next-line @next/next/no-img-element -- local camera/base64 preview, next/image can't optimise it */}
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
  classPackageAssignmentId,
  students = [],
  onComplete,
}: {
  totalStudents: number;
  classPackageAssignmentId?: string;
  students?: ScannerStudent[];
  onComplete: (results: ScanResult[]) => Promise<void> | void;
}) {
  const [step, setStep] = useState<Step>("capture");
  const [papers, setPapers] = useState<CapturedPaper[]>([]);
  // Each paper is sent for analysis the moment it is captured; results land here.
  const [scanned, setScanned] = useState<Record<string, ScanResult>>({});
  const [results, setResults] = useState<ScanResult[]>([]);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [captureBusy, setCaptureBusy] = useState(false);
  const [captureFlash, setCaptureFlash] = useState(false);
  const [captureMessage, setCaptureMessage] = useState<string | null>(null);
  const [retakingPaperId, setRetakingPaperId] = useState<string | null>(null);
  const [reviewingPaperId, setReviewingPaperId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingScans = useRef(new Map<string, Promise<ScanResult>>());
  const messageTimer = useRef<number | null>(null);

  const target = Math.min(totalStudents || MAX_PAPERS, MAX_PAPERS);
  const analyzedCount = papers.filter((paper) => scanned[paper.id]).length;

  const flashMessage = useCallback((text: string) => {
    setCaptureMessage(text);
    if (messageTimer.current) window.clearTimeout(messageTimer.current);
    messageTimer.current = window.setTimeout(() => setCaptureMessage(null), 1800);
  }, []);

  // ── Scan a single image against the API ────────────────────────────────────

  const scanImage = useCallback(async (imageBase64: string, paperId: string, thumbBase64: string): Promise<ScanResult> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SCAN_TIMEOUT_MS);
    try {
      if (!classPackageAssignmentId) {
        throw new Error(MISSING_ASSIGNMENT_ERROR);
      }

      const res = await fetch(SCAN_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classPackageAssignmentId, imageBase64, mimeType: "image/jpeg", scanMode: "question_paper" }),
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
      const match = resolveStudentMatch({ studentName, studentCode, editedName: studentName }, students);

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
        errorMsg: isTimeout ? `انتهت المهلة (${toEnglishDigits(SCAN_TIMEOUT_MS / 1000)} ثانية) — أعد التصوير` : e instanceof Error ? e.message : "تعذّرت قراءة الورقة",
        thumbBase64, imageBase64,
      };
    }
  }, [classPackageAssignmentId, students]);

  /** Adds a paper and starts analysing it straight away, so results are ready by the time the teacher finishes. */
  const addPaper = useCallback((paper: CapturedPaper) => {
    setPapers((prev) => [...prev, paper]);
    const promise = scanImage(paper.imageBase64, paper.id, paper.reviewBase64 || paper.thumbBase64);
    pendingScans.current.set(paper.id, promise);
    void promise.then((result) => {
      if (pendingScans.current.get(paper.id) === promise) {
        setScanned((prev) => ({ ...prev, [paper.id]: result }));
      }
    });
  }, [scanImage]);

  const removePaper = useCallback((paperId: string) => {
    pendingScans.current.delete(paperId);
    setPapers((prev) => prev.filter((paper) => paper.id !== paperId));
    setScanned((prev) => {
      const next = { ...prev };
      delete next[paperId];
      return next;
    });
  }, []);

  const preparePaper = useCallback(async (raw: string, id: string): Promise<CapturedPaper> => {
    const [compressed, thumb, review] = await Promise.all([
      compressImage(raw, SCAN_MAX_WIDTH, SCAN_QUALITY),
      compressImage(raw, 360, 0.75),
      compressImage(raw, 1100, 0.9),
    ]);
    return { id, imageBase64: compressed, thumbBase64: thumb, reviewBase64: review };
  }, []);

  // ── Camera helpers ──────────────────────────────────────────────────────────

  const openCamera = useCallback(async () => {
    setCameraError(null);
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1240 }, height: { ideal: 1754 }, aspectRatio: { ideal: 0.7071 } },
      });
      streamRef.current = s;
      setCameraOpen(true);
      setTimeout(() => {
        if (videoRef.current) { videoRef.current.srcObject = s; void videoRef.current.play(); }
      }, 80);
    } catch {
      setCameraError("تعذّر فتح الكاميرا. اسمح للمتصفح باستخدام الكاميرا، أو ارفع صورة من المعرض.");
    }
  }, []);

  const closeCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOpen(false);
  }, []);

  useEffect(() => () => streamRef.current?.getTracks().forEach((t) => t.stop()), []);

  // On phones, open the camera straight away — that is what the teacher came here to do.
  const autoOpened = useRef(false);
  useEffect(() => {
    if (autoOpened.current || !classPackageAssignmentId) return;
    autoOpened.current = true;
    if (window.matchMedia?.("(pointer: coarse)").matches) void openCamera();
  }, [classPackageAssignmentId, openCamera]);

  /** One tap: capture, keep, and start analysing. A bad photo shows up in review with "أعد التصوير". */
  const captureOne = useCallback(async () => {
    if (papers.length >= MAX_PAPERS || captureBusy) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    setCaptureBusy(true);
    setCaptureFlash(true);
    if ("vibrate" in navigator) navigator.vibrate?.(35);

    try {
      drawVideoCoverToPortraitCanvas(video, canvas);
      const raw = canvas.toDataURL("image/jpeg", 0.95).split(",")[1];
      const paper = await preparePaper(raw, `p${Date.now()}`);
      addPaper(paper);
      flashMessage(`✓ تم حفظ الورقة ${formatCount(papers.length + 1)} — صوّر التالية`);
    } catch {
      flashMessage("تعذّر التقاط الصورة، حاول مرة أخرى");
    } finally {
      setCaptureBusy(false);
      window.setTimeout(() => setCaptureFlash(false), 160);
    }
  }, [addPaper, captureBusy, flashMessage, papers.length, preparePaper]);

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
        matchConfidence: "needs_review",
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
  }, [closeCamera]);

  const handleGalleryUpload = useCallback(async (files: FileList | null) => {
    if (!files?.length) return;
    for (const file of Array.from(files).slice(0, MAX_PAPERS - papers.length)) {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const raw = dataUrl.split(",")[1] ?? "";
      if (raw) addPaper(await preparePaper(raw, `p${Date.now()}-${file.name}`));
    }
    flashMessage("تم رفع الصور");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [addPaper, flashMessage, papers.length, preparePaper]);

  // ── Finish: wait only for papers still being analysed ───────────────────────

  const processAll = async () => {
    if (!papers.length) return;
    if (!classPackageAssignmentId) {
      setSaveError(MISSING_ASSIGNMENT_ERROR);
      return;
    }
    closeCamera();
    setStep("processing");
    const allResults = await Promise.all(
      papers.map((paper) => pendingScans.current.get(paper.id) ?? scanImage(paper.imageBase64, paper.id, paper.reviewBase64 || paper.thumbBase64))
    );
    // Keep anything the teacher already reviewed (student choice, corrected answers, retakes).
    setResults((prev) => {
      const existing = new Map(prev.map((r) => [r.paperId, r]));
      return [...prev.filter((r) => r.paperId.startsWith("manual-")), ...allResults.map((r) => existing.get(r.paperId) ?? r)];
    });
    const successCount = allResults.filter((r) => !r.error).length;
    sendBrowserNotification(`تمت قراءة ${successCount} ورقة ✓`);
    setStep("review");
  };

  // ── Retake specific paper (single scan from review) ─────────────────────────

  const handleRetakeCapture = async (newBase64: string) => {
    if (!retakingPaperId) return;
    const paperId = retakingPaperId;
    const thumb = await compressImage(newBase64, 1100, 0.9);
    setRetakingPaperId(null);
    setResults((prev) =>
      prev.map((r) =>
        r.paperId === paperId
          ? { ...r, error: false, errorMsg: undefined, editedName: "جارٍ التحليل...", matchConfidence: undefined, matchedStudentId: null }
          : r
      )
    );
    const newResult = await scanImage(newBase64, paperId, thumb);
    setResults((prev) => prev.map((r) => (r.paperId === paperId ? { ...newResult, editedName: newResult.studentName } : r)));
  };

  // ── Per-question review save ────────────────────────────────────────────────

  const handleReviewSave = async (paperId: string, answers: Record<string, string>) => {
    try {
      if (!classPackageAssignmentId) {
        throw new Error(MISSING_ASSIGNMENT_ERROR);
      }

      const res = await fetch(SCAN_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classPackageAssignmentId, studentAnswers: answers }),
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

  const updateMatchedStudent = (paperId: string, studentId: string) =>
    setResults((prev) => prev.map((r) => (
      r.paperId === paperId
        ? { ...r, matchedStudentId: studentId || null, matchConfidence: studentId ? "strong" : "needs_review" }
        : r
    )));

  const removeResult = (paperId: string) => {
    pendingScans.current.delete(paperId);
    setResults((prev) => prev.filter((r) => r.paperId !== paperId));
    setPapers((prev) => prev.filter((p) => p.id !== paperId));
  };

  const saveAll = async () => {
    const valid = results.filter((r) => !r.error);
    if (!valid.length) return;
    if (valid.some((r) => !r.matchedStudentId)) {
      setSaveError("اختر الطالب لكل ورقة معلّمة باللون الأصفر قبل الحفظ");
      return;
    }
    if (duplicateIds.size) {
      setSaveError("يوجد أكثر من ورقة لنفس الطالب. احذف المكررة أو غيّر اختيار الطالب.");
      return;
    }

    setSaveError(null);
    setSaving(true);
    try {
      await onComplete(valid);
      setStep("done");
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "تعذر حفظ نتائج التصحيح");
    } finally {
      setSaving(false);
    }
  };

  // ─── Derived ──────────────────────────────────────────────────────────────

  const validResults = results.filter((r) => !r.error);
  const errorResults = results.filter((r) => r.error);
  const unmatchedCount = validResults.filter((r) => !r.matchedStudentId).length;
  const duplicateIds = new Set(
    validResults
      .map((r) => r.matchedStudentId)
      .filter((id, index, all): id is string => Boolean(id) && all.indexOf(id) !== index)
  );
  const usedStudentIds = new Set(validResults.map((r) => r.matchedStudentId).filter(Boolean));
  const missingStudents = students.filter((s) => !usedStudentIds.has(s.id));
  const lastPaper = papers[papers.length - 1];

  const galleryInput = (
    <input
      ref={fileInputRef}
      type="file"
      accept="image/*"
      multiple
      className="hidden"
      onChange={(event) => void handleGalleryUpload(event.target.files)}
    />
  );

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div dir="rtl">
      {retakingPaperId && (
        <RetakeModal
          onCapture={handleRetakeCapture}
          onClose={() => setRetakingPaperId(null)}
          maxWidth={SCAN_MAX_WIDTH}
          quality={SCAN_RETAKE_QUALITY}
        />
      )}

      {reviewingPaperId && (() => {
        const r = results.find((x) => x.paperId === reviewingPaperId);
        return r ? (
          <PaperReviewModal result={r} onSave={handleReviewSave} onClose={() => setReviewingPaperId(null)} />
        ) : null;
      })()}

      {/* ── Full-screen camera ── */}
      {cameraOpen && (
        <div className="fixed inset-0 z-[55] flex flex-col bg-black text-white" style={{ height: "100dvh" }} dir="rtl">
          <div className="flex items-center justify-between gap-2 px-3 pb-2" style={{ paddingTop: "max(env(safe-area-inset-top), 0.75rem)" }}>
            <button onClick={closeCamera} aria-label="إغلاق الكاميرا" className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-2xl">
              ×
            </button>
            <div className="min-w-0 text-center">
              <p className="text-base font-black">
                {formatCount(papers.length)} / {formatCount(target)} ورقة
              </p>
              <p className="text-xs font-bold text-white/60">
                {papers.length === 0
                  ? "ضع الورقة داخل الإطار واضغط الزر"
                  : analyzedCount < papers.length
                    ? `جارٍ قراءة ${formatCount(papers.length - analyzedCount)} في الخلفية`
                    : "تمت قراءة كل الأوراق"}
              </p>
            </div>
            <button
              onClick={processAll}
              disabled={!papers.length}
              className="h-11 rounded-full bg-brand px-5 text-sm font-black text-white disabled:opacity-40"
            >
              إنهاء
            </button>
          </div>

          {/* The frame keeps the paper's A4 shape and matches exactly what gets captured. */}
          <div className="relative flex min-h-0 flex-1 items-center justify-center px-3" style={{ containerType: "size" }}>
            <div
              className={`relative overflow-hidden rounded-2xl bg-slate-900 transition-transform duration-150 ${captureFlash ? "scale-[0.985]" : ""}`}
              style={{ width: "min(100cqw, calc(100cqh / 1.414))", aspectRatio: "1 / 1.414" }}
            >
              <video ref={videoRef} className="absolute inset-0 h-full w-full object-cover" playsInline muted />
              {captureFlash && <div className="pointer-events-none absolute inset-0 bg-white/50" />}
              <div className="pointer-events-none absolute inset-3">
                <div className="absolute right-0 top-0 h-8 w-8 border-r-4 border-t-4 border-white" />
                <div className="absolute left-0 top-0 h-8 w-8 border-l-4 border-t-4 border-white" />
                <div className="absolute bottom-0 right-0 h-8 w-8 border-b-4 border-r-4 border-white" />
                <div className="absolute bottom-0 left-0 h-8 w-8 border-b-4 border-l-4 border-white" />
              </div>
              {captureMessage && (
                <div role="status" className="pointer-events-none absolute inset-x-4 bottom-4 rounded-full bg-black/65 px-3 py-2 text-center text-sm font-bold">
                  {captureMessage}
                </div>
              )}
            </div>
          </div>

          <canvas ref={canvasRef} className="hidden" />
          {galleryInput}

          <div className="grid grid-cols-3 items-center px-6 pt-3" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 1rem)" }}>
            <button onClick={() => fileInputRef.current?.click()} className="justify-self-start text-xs font-bold text-white/80">
              <span className="mb-1 block text-2xl">🖼️</span>
              المعرض
            </button>
            <button
              onClick={captureOne}
              disabled={papers.length >= MAX_PAPERS || captureBusy}
              aria-label="تصوير الورقة"
              className="flex h-20 w-20 items-center justify-center justify-self-center rounded-full border-4 border-white disabled:opacity-40"
            >
              <span className={`block h-16 w-16 rounded-full ${captureBusy ? "bg-white/50" : "bg-white"}`} />
            </button>
            {lastPaper ? (
              <button
                onClick={() => removePaper(lastPaper.id)}
                className="relative justify-self-end"
                aria-label="حذف آخر صورة"
                title="حذف آخر صورة"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- local camera/base64 preview, next/image can't optimise it */}
                <img src={`data:image/jpeg;base64,${lastPaper.thumbBase64}`} alt="" className="h-14 w-10 rounded-md border-2 border-white object-cover" />
                <span className="absolute -left-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-black">×</span>
              </button>
            ) : (
              <button onClick={addManualPaper} className="justify-self-end text-xs font-bold text-white/80">
                <span className="mb-1 block text-2xl">✍️</span>
                يدويًا
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Capture (camera closed) ── */}
      {step === "capture" && (
        <div className="space-y-4">
          {galleryInput}
          <button
            onClick={openCamera}
            disabled={papers.length >= MAX_PAPERS}
            className="w-full rounded-2xl bg-brand py-4 text-lg font-black text-white shadow-md transition hover:bg-brand-dark disabled:opacity-50"
          >
            📷 {papers.length ? "متابعة التصوير" : "ابدأ التصوير بالكاميرا"}
          </button>
          {cameraError && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-bold text-danger">{cameraError}</p>}
          <div className="grid grid-cols-2 gap-2 text-sm font-bold text-slate-500">
            <button onClick={() => fileInputRef.current?.click()} className="rounded-xl border border-slate-200 py-2.5 hover:bg-slate-50">
              رفع صور من المعرض
            </button>
            <button onClick={addManualPaper} className="rounded-xl border border-slate-200 py-2.5 hover:bg-slate-50">
              إدخال الإجابات يدويًا
            </button>
          </div>
          <p className="text-center text-xs font-bold text-slate-400">
            صوّر كل ورقة بضغطة واحدة؛ تُقرأ الأوراق تلقائيًا أثناء التصوير ويُصحَّح بمفتاح الإجابة المحمي.
          </p>

          {papers.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-bold text-slate-600">
                تم تصوير <span className="text-brand">{formatCount(papers.length)}</span> من {formatCount(target)}
              </p>
              <div className="mb-4 grid grid-cols-5 gap-2 sm:grid-cols-8">
                {papers.map((p, i) => (
                  <div key={p.id} className="relative overflow-hidden rounded-lg border border-slate-200" style={{ aspectRatio: "3/4" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- local camera/base64 preview, next/image can't optimise it */}
                    <img src={`data:image/jpeg;base64,${p.thumbBase64}`} alt={`ورقة ${formatCount(i + 1)}`} className="h-full w-full object-cover" />
                    <button
                      onClick={() => removePaper(p.id)}
                      aria-label={`حذف الورقة ${formatCount(i + 1)}`}
                      className="absolute left-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-xs text-white"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <button onClick={processAll} className="w-full rounded-2xl bg-brand-navy py-4 text-base font-black text-white">
                عرض النتائج ({formatCount(papers.length)} ورقة)
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Processing (only papers still being read) ── */}
      {step === "processing" && (
        <div className="py-10 text-center">
          <div className="mx-auto mb-5 h-14 w-14 animate-spin rounded-full border-4 border-teal-100 border-t-brand" />
          <p className="mb-1 text-lg font-black text-brand-navy">
            جارٍ قراءة الأوراق... {toEnglishDigits(`${analyzedCount}/${papers.length}`)}
          </p>
          <p className="text-sm font-bold text-slate-400">لحظات وتظهر النتائج</p>
        </div>
      )}

      {/* ── Review ── */}
      {step === "review" && (
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-2">
            {(["متقدم", "متمكن", "أساسي", "دون الأساسي"] as const).map((lvl) => {
              const cfg = ETEC_LEVELS[lvl];
              const count = validResults.filter((r) => r.level === lvl).length;
              return (
                <div key={lvl} className="rounded-xl border p-2 text-center" style={{ borderColor: cfg.color + "40", background: cfg.color + "12" }}>
                  <div className="text-xl font-black" style={{ color: cfg.color }}>{formatCount(count)}</div>
                  <div className="text-[11px] font-bold text-slate-600">{lvl}</div>
                </div>
              );
            })}
          </div>

          {(errorResults.length > 0 || unmatchedCount > 0 || duplicateIds.size > 0) && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-800">
              {errorResults.length > 0 && <p>{formatCount(errorResults.length)} ورقة لم تُقرأ — اضغط «أعد التصوير».</p>}
              {unmatchedCount > 0 && <p>{formatCount(unmatchedCount)} ورقة تحتاج اختيار الطالب.</p>}
              {duplicateIds.size > 0 && <p>توجد أوراق مكررة لنفس الطالب.</p>}
            </div>
          )}
          {missingStudents.length > 0 && students.length > 0 && (
            <p className="text-xs font-bold text-slate-400">
              لم تُصحَّح بعد أوراق: {missingStudents.slice(0, 6).map((s) => s.name).join("، ")}
              {missingStudents.length > 6 ? ` و${formatCount(missingStudents.length - 6)} آخرين` : ""}
            </p>
          )}

          <ul className="space-y-2">
            {results.map((r, i) => {
              const cfg = !r.error && r.level ? ETEC_LEVELS[r.level as keyof typeof ETEC_LEVELS] : null;
              const isDuplicate = !r.error && !!r.matchedStudentId && duplicateIds.has(r.matchedStudentId);
              const needsChoice = !r.error && (!r.matchedStudentId || isDuplicate);
              return (
                <li
                  key={r.paperId}
                  className={`rounded-xl border p-3 ${r.error ? "border-red-200 bg-red-50/50" : needsChoice ? "border-amber-200 bg-amber-50/40" : "border-slate-100 bg-white"}`}
                >
                  <div className="flex items-center gap-3">
                    {r.thumbBase64 ? (
                      // eslint-disable-next-line @next/next/no-img-element -- local camera/base64 preview, next/image can't optimise it
                      <img src={`data:image/jpeg;base64,${r.thumbBase64}`} alt="" className="h-12 w-9 flex-shrink-0 rounded border border-slate-200 object-cover" />
                    ) : (
                      <span className="flex h-12 w-9 flex-shrink-0 items-center justify-center rounded border border-slate-200 text-xs text-slate-400">{formatCount(i + 1)}</span>
                    )}
                    <div className="min-w-0 flex-1">
                      {r.error ? (
                        <p className="text-sm font-bold text-red-600">{r.errorMsg ?? "تعذّرت القراءة"}</p>
                      ) : (
                        <>
                          <select
                            value={r.matchedStudentId ?? ""}
                            onChange={(e) => updateMatchedStudent(r.paperId, e.target.value)}
                            aria-label="الطالب"
                            className={`w-full rounded-lg border px-2 py-1.5 text-sm font-bold outline-none focus:border-brand ${needsChoice ? "border-amber-300 bg-white text-amber-800" : "border-slate-200 text-brand-navy"}`}
                          >
                            <option value="">اختر الطالب</option>
                            {students.map((student) => (
                              <option key={student.id} value={student.id}>
                                {student.name}
                                {student.studentCode ? ` (${toEnglishDigits(normalizeStudentCode(student.studentCode))})` : ""}
                              </option>
                            ))}
                          </select>
                          <p className="mt-1 truncate text-[11px] font-bold text-slate-400">
                            {r.studentName || r.studentCode
                              ? `المقروء: ${r.studentName || "—"}${r.studentCode ? ` · ${toEnglishDigits(r.studentCode)}` : ""}`
                              : "لم يُقرأ الاسم أو الرقم"}
                            {isDuplicate ? " · مكررة" : r.matchConfidence && r.matchConfidence !== "strong" ? ` · ${confidenceLabel(r.matchConfidence)}` : ""}
                          </p>
                        </>
                      )}
                    </div>
                    <div className="flex-shrink-0 text-center">
                      {r.error ? (
                        <button
                          onClick={() => setRetakingPaperId(r.paperId)}
                          className="rounded-lg border border-red-300 px-2 py-1.5 text-xs font-bold text-red-700"
                        >
                          ⟳ أعد التصوير
                        </button>
                      ) : (
                        <button onClick={() => setReviewingPaperId(r.paperId)} className="block" aria-label="مراجعة الإجابات">
                          <span className="block text-base font-black text-brand-navy">{toEnglishDigits(`${r.score}/${r.total}`)}</span>
                          {cfg && (
                            <span className="block rounded-full px-2 text-[11px] font-bold" style={{ background: cfg.color + "22", color: cfg.color }}>
                              {r.level}
                            </span>
                          )}
                          <span className="block text-[10px] font-bold text-slate-400">مراجعة</span>
                        </button>
                      )}
                    </div>
                    <button
                      onClick={() => removeResult(r.paperId)}
                      aria-label="حذف الورقة"
                      className="flex-shrink-0 self-start text-lg leading-none text-slate-300 hover:text-red-500"
                    >
                      ×
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>

          {saveError && (
            <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{saveError}</p>
          )}

          <div className="sticky bottom-0 -mx-4 space-y-2 border-t border-slate-100 bg-white/95 px-4 py-3 backdrop-blur sm:-mx-5 sm:px-5">
            <button
              onClick={saveAll}
              disabled={validResults.length === 0 || saving}
              className="w-full rounded-2xl bg-brand py-4 text-base font-black text-white shadow-md transition hover:bg-brand-dark disabled:opacity-50"
            >
              {saving ? "جارٍ الحفظ..." : `حفظ نتائج ${formatCount(validResults.length)} طالب`}
            </button>
            <button
              onClick={() => { setStep("capture"); void openCamera(); }}
              className="w-full text-sm font-bold text-slate-500"
            >
              + تصوير أوراق إضافية
            </button>
          </div>
        </div>
      )}

      {/* ── Done ── */}
      {step === "done" && (
        <div className="py-10 text-center">
          <div className="mb-4 text-5xl">🎉</div>
          <p className="mb-2 text-xl font-black text-brand-navy">
            تم حفظ نتائج {formatCount(validResults.length)} طالب
          </p>
          <p className="text-sm font-bold text-slate-400">النتائج الآن في جدول الطلاب وتقارير الفصل</p>
        </div>
      )}
    </div>
  );
}
