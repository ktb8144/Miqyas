

export type Tab = "overview" | "schools" | "users" | "packages" | "trialRequests" | "reports";
export type ModalType = "school" | "user";

export type OverviewData = {
  schools: { total: number };
  users: {
    total: number;
    byRole: {
      admin: number;
      principal: number;
      teacher: number;
    };
  };
  students: { total: number };
  questions: { total: number };
};

export type ApiState = "idle" | "loading" | "ready" | "error";

export type AdminSchool = {
  id: string;
  name: string;
  city: string;
  region?: string | null;
  type?: string;
  principal: string;
  teachers: number;
  students: number;
  status: string;
  score: string;
  active?: boolean;
  trial?: boolean;
  subscriptionEnd?: string | null;
};

export type SchoolFormData = {
  name: string;
  city: string;
  type?: string;
  subscription_end?: string;
};

export type AdminUser = {
  id: string;
  auth_id: string | null;
  name: string;
  email: string;
  role: string;
  school_id: string | null;
  school: string;
  status: string;
};

export type UserFormData = {
  name: string;
  email: string;
  role: string;
  school_id?: string;
};

export type AdminTrialRequest = {
  id: string;
  name: string;
  school_name: string;
  phone: string;
  email: string;
  message: string;
  status: string;
  created_at: string;
};

export type AdminAssessmentPackage = {
  id: string;
  title: string;
  description: string | null;
  subject: string;
  grade: number;
  week_number: number | null;
  assessment_code: string | null;
  package_type: string | null;
  duration_minutes: number | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
  student_pdf_url: string | null;
  questions_pdf_url: string | null;
  teacher_pdf_url: string | null;
  answer_sheet_pdf_url: string | null;
  answer_key_file_url: string | null;
  question_count: number;
  assigned_school_count: number;
  incomplete_question_count: number;
  published_at: string | null;
  created_at: string;
};

export type PackageFormData = {
  title: string;
  description: string;
  subject: string;
  grade: string;
  week_number: string;
  assessment_code: string;
  package_type: string;
  duration_minutes: string;
  start_date: string;
  end_date: string;
  student_pdf_url: string;
  questions_pdf_url: string;
  answer_sheet_pdf_url: string;
  answer_key_file_url: string;
  answer_key_json: string;
};

export type PackageSubmitData = PackageFormData & {
  questions_pdf_file?: File | null;
};

export type AnswerKeyValidationResult = {
  count: number;
  summary: string[];
};
