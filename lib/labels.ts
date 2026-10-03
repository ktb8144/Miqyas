// Arabic display labels shared by the admin, teacher and principal screens.

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: "سهل",
  medium: "متوسط",
  hard: "متقدم",
  nafs_simulation: "محاكاة نافس",
};

const PACKAGE_TYPE_LABELS: Record<string, string> = {
  weekly: "اختبار أسبوعي",
  diagnostic: "اختبار تشخيصي",
  nafs_simulation: "محاكاة نافس",
};

/** Status of an assessment package itself (admin side). */
const PACKAGE_STATUS_LABELS: Record<string, string> = {
  draft: "مسودة",
  published: "منشورة",
  archived: "مؤرشفة",
};

/** Status of a package assigned to a school or a class (teacher side). */
const ASSIGNMENT_STATUS_LABELS: Record<string, string> = {
  assigned: "مُعيّن",
  printed: "تمت الطباعة",
  in_progress: "قيد التنفيذ",
  scanned: "تم التصحيح",
  completed: "مكتمل",
  available: "متاح",
  active: "نشط",
  completed_school: "مكتمل",
};

export function difficultyLabel(value?: string | null) {
  return value ? DIFFICULTY_LABELS[value] ?? value : "غير محدد";
}

export function packageTypeLabel(value?: string | null) {
  return value ? PACKAGE_TYPE_LABELS[value] ?? value : PACKAGE_TYPE_LABELS.weekly;
}

export function packageStatusLabel(value?: string | null) {
  return value ? PACKAGE_STATUS_LABELS[value] ?? value : "";
}

export function assignmentStatusLabel(value?: string | null) {
  return value ? ASSIGNMENT_STATUS_LABELS[value] ?? value : "غير محدد";
}
