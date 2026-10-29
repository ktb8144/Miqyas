/**
 * Shared types for Dala's answer-sheet reader (no AI).
 *
 * Every position in a template is in millimetres, measured from the centre of the
 * top-left corner marker. The four marker centres are (0,0), (width,0),
 * (width,height) and (0,height). The reader finds the markers in the photo, maps
 * the template onto the photo, and measures how dark each bubble is.
 */

export type Point = { x: number; y: number };

/** A group of bubbles where the student should shade exactly one (a question, or one digit). */
export type OmrChoiceGroup = {
  key: string;
  /** Value of each bubble, in the same order as `bubbles` (e.g. ["أ","ب","ج","د"] or ["0",…,"9"]). */
  options: string[];
  bubbles: Point[];
};

export type OmrTemplate = {
  id: string;
  /** Distance between marker centres, left to right (mm). */
  width: number;
  /** Distance between marker centres, top to bottom (mm). */
  height: number;
  markerSize: number;
  bubbleRadius: number;
  questions: OmrChoiceGroup[];
  /** Student number as two bubble rows; absent when the sheet has no number grid. */
  studentCode?: { ones: OmrChoiceGroup; tens: OmrChoiceGroup };
  /** Solid bar printed only on one side, so an upside-down photo can be detected. */
  orientationMark?: { x: number; y: number; w: number; h: number };
  /** Ten small squares whose filled/empty pattern identifies the test, so a sheet from another test is caught. */
  idStrip?: { cells: Point[]; cellSize: number; bits: number[] };
};

/** Gray image: one byte per pixel, row by row. */
export type GrayImage = { width: number; height: number; data: Uint8Array };

/** RGBA image as returned by canvas getImageData. */
export type RgbaImage = { width: number; height: number; data: Uint8ClampedArray | Uint8Array };

export type BubbleDecision = "ok" | "blank" | "multiple" | "uncertain";

export type GroupReading = {
  key: string;
  /** The chosen option, "blank", or "unclear" when a person must decide. */
  value: string;
  decision: BubbleDecision;
  /** Share of each bubble's inside that is dark (0–1), in option order. */
  fill: number[];
};

export type OmrFailureReason =
  | "markers_not_found"
  | "orientation_unknown"
  | "alignment_failed"
  | "wrong_sheet";

export type OmrReading =
  | {
      ok: true;
      templateId: string;
      /** q1…qN → "أ" | "ب" | "ج" | "د" | "blank" | "unclear" */
      answers: Record<string, string>;
      questions: GroupReading[];
      /** "" when the number grid was left empty or could not be read with confidence. */
      studentCode: string;
      studentCodeDecision: BubbleDecision | "invalid" | "absent";
      /** Maps template millimetres to photo pixels (3×3, row-major). */
      homography: number[];
      /** Corners of the template frame in photo pixels: top-left, top-right, bottom-right, bottom-left. */
      corners: Point[];
      warnings: string[];
    }
  | { ok: false; reason: OmrFailureReason; message: string };
