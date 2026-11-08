/** School stage, stored as schools.stage and users.stage (the stage a teacher teaches). */
export type SchoolStage = "primary" | "intermediate" | "combined";

export const STAGE_VALUES = ["primary", "intermediate", "combined"] as const;

export const SCHOOL_STAGES: { value: SchoolStage; label: string }[] = [
  { value: "primary", label: "ابتدائي" },
  { value: "intermediate", label: "متوسط" },
  { value: "combined", label: "مجمع (ابتدائي ومتوسط)" },
];

/** The same choices worded for a teacher. */
export const TEACHER_STAGES: { value: SchoolStage; label: string }[] = [
  { value: "primary", label: "ابتدائي" },
  { value: "intermediate", label: "متوسط" },
  { value: "combined", label: "الاثنتان (مجمع)" },
];

export function stageLabel(value: unknown) {
  return SCHOOL_STAGES.find((stage) => stage.value === value)?.label ?? "—";
}
