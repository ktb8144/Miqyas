

export type PrincipalReport = {
  school: { id: string; name: string; city?: string | null };
  kpis: {
    teachersCount: number;
    classesCount: number;
    studentsCount: number;
    performanceAverage: number | null;
    atRiskCount: number;
    implementationRate: number | null;
  };
  improvement: { value: number | null; label: string; note?: string };
  readinessIndex: { value: number | null; label: string; formula: string };
  weakSkills: { skill: string; average: number; count: number }[];
  atRiskStudents: { id: string; name: string; className: string; percentage: number }[];
  teacherEngagement: { activeTeachers: number; totalTeachers: number; rate: number | null };
  weeklyPlanSummary: {
    source: "current_week" | "upcoming" | "none";
    weekNumber: number | null;
    startDate: string | null;
    endDate: string | null;
    startHijri: string | null;
    endHijri: string | null;
    targetGrades: number[];
    targetSubjects: string[];
    activePlansCount: number;
    matchingClassesCount: number;
    classesWithoutPlans: number;
    unsupportedClassesCount: number;
    plans: {
      id: string;
      weekNumber: number;
      grade: number;
      gradeLabel: string;
      subject: string;
      skill: string;
      difficultyLevel: string;
    }[];
  };
  teachers: { id: string; name: string; email: string; phone?: string | null; subject: string; status: string; classNames?: string[]; classesCount: number; studentsCount: number; average: number | null; active: boolean }[];
  classes: { id: string; name: string; grade: number | null; subject: string; studentsCount: number; average: number | null }[];
  alerts: { type: string; title: string; detail: string }[];
  notes: string[];
};

export type PrincipalPackageSummary = {
  packageId: string;
  title: string;
  subject: string;
  grade: number | null;
  weekNumber: number | null;
  classesAssigned: number;
  classesScanned: number;
  studentsTested: number;
  averagePercentage: number | null;
  weakestDomains: Array<{ name: string; wrong: number; total: number }>;
  weakestSkills: Array<{ name: string; wrong: number; total: number }>;
};

export type PrincipalParentStats = {
  totalLinks: number;
  openedReports: number;
  openRate: number | null;
  missionClicks: number;
  completedMissions: number;
  subscriptionInterestCount: number;
  unopenedLinks: number;
  topInterestedSkill: { skillName: string; count: number } | null;
};

export type PeriodicReportPreview = {
  title: string;
  hasEnoughData: boolean;
  generalData: {
    studentsCount: number;
    classesCount: number;
    simulatedAssessmentsCount: number;
    testedStudentsCount: number;
    performanceAverage: number | null;
    masteryPercentage: number | null;
    notMasteredPercentage: number | null;
    improvementPercentage: number | null;
  };
  skillAnalysis: Array<{ name: string; masteredCount: number; notMasteredCount: number; masteryPercentage: number; needLevel: string }>;
  domainAnalysis: Array<{ name: string; masteredCount: number; notMasteredCount: number; masteryPercentage: number; needLevel: string }>;
  levelDistribution: { high: number; medium: number; low: number; veryLow: number };
  recommendations: string[];
};

export type PeriodicReportWeek = {
  weekNumber: number;
  startDate: string | null;
  endDate: string | null;
  startHijri: string | null;
  endHijri: string | null;
  label: string;
  packageCount: number;
};
