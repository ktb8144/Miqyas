// Row shapes of the main Supabase tables, written once.
// API routes pick only the columns they select:  Pick<AssessmentPackageRow, "id" | "title">.
//
// Long-term these should be generated from the database instead of hand-written:
//   npx supabase gen types typescript --project-id <id> > lib/db/database.types.ts

export type AssessmentPackageRow = {
  id: string;
  title: string;
  description: string | null;
  subject: string;
  grade: number;
  week_number: number | null;
  assessment_code: string | null;
  duration_minutes: number | null;
  package_type: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
  student_pdf_url: string | null;
  questions_pdf_url: string | null;
  teacher_pdf_url: string | null;
  answer_sheet_pdf_url: string | null;
  answer_key_file_url: string | null;
  published_at: string | null;
  created_at: string;
};

export type ClassRow = {
  id: string;
  name: string;
  grade: number | null;
  subject: string | null;
  teacher_id: string;
  school_id: string;
};

export type StudentRow = {
  id: string;
  name: string;
  class_id: string;
  student_code: string | null;
  score: number | null;
  total: number | null;
};

export type ClassPackageAssignmentRow = {
  id: string;
  package_id: string;
  school_id: string;
  class_id: string;
  teacher_id: string;
  status: string;
  printed_at: string | null;
  scanned_at: string | null;
  completed_at: string | null;
  created_at: string;
};

export type StudentPackageResultRow = {
  id: string;
  class_package_assignment_id: string;
  student_id: string;
  score: number | string;
  total: number | string;
  percentage: number | string | null;
  level: string | null;
  scanned_at: string | null;
  created_at: string | null;
};
