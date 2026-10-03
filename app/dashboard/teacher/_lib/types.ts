

export type View = "classes" | "students" | "weeklyPlans" | "packages";

export interface Student {
  id: string;
  name: string;
  studentCode: string | null;
  score: number;
  total: number;
}

export interface ClassItem {
  id: string;
  name: string;
  grade: number;
  subject: string;
  teacherId: string;
  schoolId: string;
}

interface WeeklyPlan {
  id: string;
  week_number: number;
  start_date: string;
  end_date: string;
  start_hijri: string;
  end_hijri: string;
  grade: number;
  grade_label: string;
  subject: string;
  domain: string | null;
  skill: string;
  learning_goal: string | null;
  assessment_title: string;
  question_count: number;
  difficulty_level: string;
}

export type WeeklyPlanItem = {
  plan: WeeklyPlan;
  class: {
    id: string;
    name: string;
    grade: number | null;
    subject: string | null;
  };
};

export interface ClassReport {
  summary: string;
  strengths: string;
  weaknesses: string;
  interventionPlan: string;
  recommendations: string;
}

export type ClassStudentsMap = Record<string, Student[]>;
export type AssignmentStudentScores = Record<string, Record<string, { score: number; total: number; percentage: number; level: string; scannedAt: string | null }>>;

export interface TeacherProfile {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  school_id: string | null;
  subject: string | null;
  schoolName: string | null;
}

export interface TeacherPackage {
  id: string;
  title: string;
  description: string | null;
  subject: string;
  grade: number;
  week_number: number | null;
  duration_minutes: number | null;
  package_type: string;
  start_date: string | null;
  end_date: string | null;
  student_pdf_url: string | null;
  questions_pdf_url?: string | null;
  answer_sheet_pdf_url: string | null;
  question_count: number;
  schoolAssignmentStatus: string;
  matchingClasses: Array<{ id: string; name: string }>;
}

export interface TeacherPackageAssignment {
  id: string;
  packageId: string;
  packageTitle: string;
  subject: string;
  grade: number | null;
  weekNumber: number | null;
  startDate: string | null;
  endDate: string | null;
  classId: string;
  className: string;
  status: string;
  printedAt: string | null;
  scannedAt: string | null;
  completedAt: string | null;
  studentPdfUrl: string | null;
  answerSheetPdfUrl: string | null;
  questionCount: number;
}

export type PackageResultDetails = {
  assignment: {
    id: string;
    packageTitle: string;
    className: string;
    subject: string;
    grade: number | null;
    weekNumber: number | null;
  };
  summary: {
    studentsTestedCount: number;
    averagePercentage: number | null;
  };
  students: Array<{
    id: string;
    studentId: string;
    studentCode: string | null;
    studentName: string;
    score: number;
    total: number;
    percentage: number;
    level: string;
  }>;
  weakestSkills: Array<{ name: string; wrong: number; total: number }>;
  weakestDomains: Array<{ name: string; wrong: number; total: number }>;
};

export type SkillDiagnosisDetails = {
  weakestSkills: Array<{
    skillText: string;
    domainText: string;
    masteryRate: number;
    affectedStudentsCount: number;
    linkedQuestionCount: number;
    confidenceLabel: string;
    warning: string | null;
    likelyCause: string;
    recommendation: {
      whatHappened: string;
      nextLessonAction: string;
      duration: string;
      targetStudents: string;
      impactMeasure: string;
    };
  }>;
  strongestSkills: Array<{ skillText: string; masteryRate: number }>;
  confidence: { level: string; label: string; reason: string };
};

// ─── Report Modal ─────────────────────────────────────────────────────────────
