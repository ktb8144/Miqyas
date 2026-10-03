import "server-only";
import { getAdminClient } from "@/lib/supabase-admin";
import { toEnglishDigits } from "@/lib/format";
import { COLORS } from "@/lib/theme";
import { LEVEL_THRESHOLDS, MASTERY_THRESHOLD, getLevelFromPercentage } from "@/lib/levels";

export type PeriodicReportType =
  | "learning_outcomes_followup"
  | "nafs_readiness"
  | "learning_outcomes_improvement"
  | "subject_results_analysis";

export type PeriodicReportOptions = {
  from?: string | null;
  to?: string | null;
  weekNumber?: number | null;
  subject?: string | null;
  grade?: number | null;
  educationRegion?: string | null;
  principalName?: string | null;
  showStudentNames: boolean;
  includeImprovementPlan: boolean;
  includeRecommendations: boolean;
  reportType: PeriodicReportType;
};

type UserProfile = {
  id: string;
  name: string | null;
  role: string;
  school_id: string | null;
};

type ClassRow = {
  id: string;
  name: string;
  grade: number | null;
  subject: string | null;
};

type StudentRow = {
  id: string;
  name: string;
  class_id: string;
};

type AssignmentRow = {
  id: string;
  package_id: string;
  class_id: string;
  status: string;
  scanned_at: string | null;
  created_at: string | null;
};

type PackageRow = {
  id: string;
  title: string;
  subject: string;
  grade: number | null;
  week_number: number | null;
  start_date: string | null;
  end_date: string | null;
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

type ResultRow = {
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

type QuestionResultRow = {
  student_package_result_id: string;
  is_correct: boolean;
  nafs_domains?: { domain_name?: string | null } | null;
  learning_skills?: { skill_name?: string | null } | null;
};

function pct(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.round(numeric) : 0;
}

function avg(values: number[]) {
  return values.length ? Math.round(values.reduce((sum, item) => sum + item, 0) / values.length) : null;
}

function inRange(dateValue: string | null | undefined, from: string, to: string) {
  if (!dateValue) return false;
  const day = dateValue.slice(0, 10);
  return day >= from && day <= to;
}

function toArabicDigits(value: unknown) {
  const map: Record<string, string> = {
    "0": "٠",
    "1": "١",
    "2": "٢",
    "3": "٣",
    "4": "٤",
    "5": "٥",
    "6": "٦",
    "7": "٧",
    "8": "٨",
    "9": "٩",
  };
  return String(value ?? "").replace(/\d/g, (digit) => map[digit] ?? digit);
}

function hijriDate(dateValue?: string | null) {
  if (!dateValue) return null;
  const date = new Date(`${dateValue.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;

  const parts = new Intl.DateTimeFormat("en-US-u-ca-islamic-umalqura", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Riyadh",
  }).formatToParts(date);

  const day = parts.find((part) => part.type === "day")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const year = parts.find((part) => part.type === "year")?.value;
  if (!day || !month || !year) return null;
  return `${toArabicDigits(year)}/${toArabicDigits(month)}/${toArabicDigits(day)}هـ`;
}

function formatHijriPeriod(from?: string | null, to?: string | null) {
  const start = hijriDate(from);
  const end = hijriDate(to);
  if (start && end) return `من ${start} إلى ${end}`;
  if (start) return `يبدأ ${start}`;
  return "فترة غير محددة";
}

function weekLabel(weekNumber: number | null | undefined, startDate?: string | null) {
  const startHijri = hijriDate(startDate);
  if (!weekNumber) return startHijri ? `يبدأ ${startHijri}` : "أسبوع غير محدد";
  return `الأسبوع ${toArabicDigits(weekNumber)}${startHijri ? ` - يبدأ ${startHijri}` : ""}`;
}

function normalizeSubject(value?: string | null) {
  const text = (value ?? "").trim();
  if (!text) return "";
  if (["رياضيات", "الرياضيات"].includes(text)) return "رياضيات";
  if (["لغة عربية", "اللغة العربية", "قراءة", "لغتي", "عربية"].includes(text)) return "لغة عربية";
  if (["علوم", "العلوم"].includes(text)) return "علوم";
  return text;
}

function reportTitle(type: PeriodicReportType) {
  const titles: Record<PeriodicReportType, string> = {
    learning_outcomes_followup: "بطاقة متابعة نواتج التعلم",
    nafs_readiness: "تقرير الاستعداد لاختبارات نافس",
    learning_outcomes_improvement: "خطة تحسين نواتج التعلم",
    subject_results_analysis: "بطاقة تحليل نتائج المادة",
  };
  return titles[type];
}

function needLevel(masteryPercentage: number) {
  if (masteryPercentage >= LEVEL_THRESHOLDS.proficient) return "احتياج منخفض";
  if (masteryPercentage >= LEVEL_THRESHOLDS.basic) return "احتياج متوسط";
  return "احتياج عالٍ";
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function getSchoolPackageIds(schoolId: string) {
  const db = getAdminClient();
  const [schoolAssignmentsRes, classAssignmentsRes] = await Promise.all([
    db.from("school_package_assignments").select("package_id").eq("school_id", schoolId),
    db.from("class_package_assignments").select("package_id").eq("school_id", schoolId),
  ]);
  if (schoolAssignmentsRes.error) throw schoolAssignmentsRes.error;
  if (classAssignmentsRes.error) throw classAssignmentsRes.error;

  return Array.from(new Set([
    ...((schoolAssignmentsRes.data ?? []) as { package_id: string }[]).map((item) => item.package_id),
    ...((classAssignmentsRes.data ?? []) as { package_id: string }[]).map((item) => item.package_id),
  ].filter(Boolean)));
}

export async function getPeriodicReportWeeks(profile: UserProfile): Promise<PeriodicReportWeek[]> {
  const schoolId = profile.school_id;
  if (!schoolId) throw new Error("حساب قائد المدرسة غير مرتبط بمدرسة");

  const db = getAdminClient();
  const packageIds = await getSchoolPackageIds(schoolId);
  if (!packageIds.length) return [];

  const packagesRes = await db
    .from("assessment_packages")
    .select("id, week_number, start_date, end_date")
    .in("id", packageIds)
    .not("week_number", "is", null)
    .order("week_number", { ascending: true });
  if (packagesRes.error) throw packagesRes.error;

  const groups = new Map<number, { starts: string[]; ends: string[]; count: number }>();
  ((packagesRes.data ?? []) as Pick<PackageRow, "week_number" | "start_date" | "end_date">[]).forEach((item) => {
    if (!item.week_number) return;
    const current = groups.get(item.week_number) ?? { starts: [], ends: [], count: 0 };
    if (item.start_date) current.starts.push(item.start_date);
    if (item.end_date) current.ends.push(item.end_date);
    current.count += 1;
    groups.set(item.week_number, current);
  });

  return Array.from(groups.entries()).map(([weekNumber, value]) => {
    const startDate = value.starts.sort()[0] ?? null;
    const endDate = value.ends.sort().at(-1) ?? null;
    return {
      weekNumber,
      startDate,
      endDate,
      startHijri: hijriDate(startDate),
      endHijri: hijriDate(endDate),
      label: weekLabel(weekNumber, startDate),
      packageCount: value.count,
    };
  });
}

export async function buildPeriodicReport(profile: UserProfile, options: PeriodicReportOptions) {
  const db = getAdminClient();
  const schoolId = profile.school_id;
  if (!schoolId) throw new Error("حساب قائد المدرسة غير مرتبط بمدرسة");

  const normalizedSubject = normalizeSubject(options.subject);

  const [schoolRes, classesRes, studentsRes, assignmentsRes] = await Promise.all([
    db.from("schools").select("id, name, region").eq("id", schoolId).single(),
    db.from("classes").select("id, name, grade, subject").eq("school_id", schoolId),
    db.from("students").select("id, name, class_id, school_id").eq("school_id", schoolId),
    db.from("class_package_assignments").select("id, package_id, class_id, status, scanned_at, created_at").eq("school_id", schoolId),
  ]);

  if (schoolRes.error) throw schoolRes.error;
  if (classesRes.error) throw classesRes.error;
  if (studentsRes.error) throw studentsRes.error;
  if (assignmentsRes.error) throw assignmentsRes.error;

  const allClasses = (classesRes.data ?? []) as ClassRow[];
  const classes = allClasses.filter((item) => {
    if (options.grade && item.grade !== options.grade) return false;
    if (normalizedSubject && normalizeSubject(item.subject) !== normalizedSubject) return false;
    return true;
  });
  const classIds = new Set(classes.map((item) => item.id));
  const students = ((studentsRes.data ?? []) as StudentRow[]).filter((item) => classIds.has(item.class_id));
  const assignmentsForClasses = ((assignmentsRes.data ?? []) as AssignmentRow[]).filter((item) => classIds.has(item.class_id));

  const packageIds = Array.from(new Set(assignmentsForClasses.map((item) => item.package_id)));

  const packagesRes = packageIds.length
    ? await db.from("assessment_packages").select("id, title, subject, grade, week_number, start_date, end_date").in("id", packageIds)
    : { data: [], error: null };

  if (packagesRes.error) throw packagesRes.error;

  const packages = ((packagesRes.data ?? []) as PackageRow[]).filter((item) => {
    if (options.grade && item.grade !== options.grade) return false;
    if (normalizedSubject && normalizeSubject(item.subject) !== normalizedSubject) return false;
    if (options.weekNumber && item.week_number !== options.weekNumber) return false;
    return true;
  });

  const resolvedFrom = options.from ?? packages.map((item) => item.start_date).filter(Boolean).sort()[0] ?? null;
  const resolvedTo = options.to ?? packages.map((item) => item.end_date).filter(Boolean).sort().at(-1) ?? resolvedFrom;
  const packageIdSet = new Set(packages.map((item) => item.id));
  const filteredAssignments = assignmentsForClasses.filter((item) => {
    if (!packageIdSet.has(item.package_id)) return false;
    if (options.weekNumber) return true;
    if (!resolvedFrom || !resolvedTo) return true;
    return inRange(item.scanned_at, resolvedFrom, resolvedTo) || inRange(item.created_at, resolvedFrom, resolvedTo);
  });
  const filteredAssignmentIds = new Set(filteredAssignments.map((item) => item.id));
  const resultsRes = filteredAssignmentIds.size
    ? await db
        .from("student_package_results")
        .select("id, class_package_assignment_id, student_id, score, total, percentage, level, scanned_at, created_at")
        .in("class_package_assignment_id", Array.from(filteredAssignmentIds))
    : { data: [], error: null };
  if (resultsRes.error) throw resultsRes.error;

  const results = ((resultsRes.data ?? []) as ResultRow[]).filter((item) => filteredAssignmentIds.has(item.class_package_assignment_id));
  const resultIds = results.map((item) => item.id);

  const questionResultsRes = resultIds.length
    ? await db
        .from("student_question_results")
        .select("student_package_result_id, is_correct, nafs_domains(domain_name), learning_skills(skill_name)")
        .in("student_package_result_id", resultIds)
    : { data: [], error: null };
  if (questionResultsRes.error) throw questionResultsRes.error;

  const percentages = results.map((item) => pct(item.percentage));
  const performanceAverage = avg(percentages);
  const mastered = percentages.filter((item) => item >= MASTERY_THRESHOLD).length;
  const notMastered = percentages.length - mastered;
  const masteryPercentage = percentages.length ? Math.round((mastered / percentages.length) * 100) : null;
  const notMasteredPercentage = percentages.length ? 100 - (masteryPercentage ?? 0) : null;

  const uniqueTestedStudents = new Set(results.map((item) => item.student_id));
  const uniquePackages = new Set(filteredAssignments.map((item) => item.package_id));
  const improvement = (() => {
    if (results.length < 2) return null;
    const sorted = [...results].sort((a, b) => String(a.scanned_at ?? a.created_at).localeCompare(String(b.scanned_at ?? b.created_at)));
    const first = avg(sorted.slice(0, Math.ceil(sorted.length / 2)).map((item) => pct(item.percentage)));
    const last = avg(sorted.slice(Math.floor(sorted.length / 2)).map((item) => pct(item.percentage)));
    return first !== null && last !== null ? last - first : null;
  })();

  const levelDistribution = {
    high: percentages.filter((item) => getLevelFromPercentage(item) === "متقدم").length,
    medium: percentages.filter((item) => getLevelFromPercentage(item) === "متمكن").length,
    low: percentages.filter((item) => getLevelFromPercentage(item) === "أساسي").length,
    veryLow: percentages.filter((item) => getLevelFromPercentage(item) === "دون الأساسي").length,
  };

  const skillGroups = new Map<string, { name: string; correct: number; total: number }>();
  const domainGroups = new Map<string, { name: string; correct: number; total: number }>();
  ((questionResultsRes.data ?? []) as QuestionResultRow[]).forEach((item) => {
    const skill = item.learning_skills?.skill_name || "مهارة غير محددة";
    const domain = item.nafs_domains?.domain_name || "مجال غير محدد";
    const skillCurrent = skillGroups.get(skill) ?? { name: skill, correct: 0, total: 0 };
    const domainCurrent = domainGroups.get(domain) ?? { name: domain, correct: 0, total: 0 };
    skillCurrent.total += 1;
    domainCurrent.total += 1;
    if (item.is_correct) {
      skillCurrent.correct += 1;
      domainCurrent.correct += 1;
    }
    skillGroups.set(skill, skillCurrent);
    domainGroups.set(domain, domainCurrent);
  });

  const skillAnalysis = Array.from(skillGroups.values())
    .map((item) => {
      const skillMastery = item.total ? Math.round((item.correct / item.total) * 100) : 0;
      return {
        name: item.name,
        masteredCount: item.correct,
        notMasteredCount: item.total - item.correct,
        masteryPercentage: skillMastery,
        needLevel: needLevel(skillMastery),
      };
    })
    .sort((a, b) => a.masteryPercentage - b.masteryPercentage);

  const domainAnalysis = Array.from(domainGroups.values())
    .map((item) => {
      const domainMastery = item.total ? Math.round((item.correct / item.total) * 100) : 0;
      return {
        name: item.name,
        masteredCount: item.correct,
        notMasteredCount: item.total - item.correct,
        masteryPercentage: domainMastery,
        needLevel: needLevel(domainMastery),
      };
    })
    .sort((a, b) => a.masteryPercentage - b.masteryPercentage);

  const indicators = [
    {
      indicator: "توفر نتائج اختبارات محاكية للفترة",
      status: results.length ? "متحقق" : "غير متحقق",
      description: results.length ? `تم رصد ${results.length} نتيجة طالب.` : "لا توجد نتائج محفوظة في الفترة المحددة.",
    },
    {
      indicator: `تحقق نسبة إتقان لا تقل عن ${MASTERY_THRESHOLD}%`,
      status: masteryPercentage === null ? "غير متحقق" : masteryPercentage >= MASTERY_THRESHOLD ? "متحقق" : masteryPercentage >= LEVEL_THRESHOLDS.basic ? "متحقق إلى حد ما" : "غير متحقق",
      description: masteryPercentage === null ? "لا توجد بيانات كافية." : `نسبة الإتقان الحالية ${masteryPercentage}%.`,
    },
    {
      indicator: "تحديد المهارات ذات الأولوية",
      status: skillAnalysis.length ? "متحقق" : "غير متحقق",
      description: skillAnalysis.length ? `تم تحديد ${skillAnalysis.length} مهارة/مجال للتحليل.` : "لا توجد نتائج سؤال/مهارة كافية.",
    },
  ];

  const weakest = skillAnalysis[0] ?? domainAnalysis[0] ?? null;
  const recommendations = [
    performanceAverage === null ? "البدء بتنفيذ اختبار محاكي واحد على الأقل لبناء خط أساس." : `متوسط الأداء العام ${performanceAverage}%، ويوصى بمتابعة الفصول الأقل من ${MASTERY_THRESHOLD}%.`,
    weakest ? `تركيز خطة التحسين القادمة على: ${weakest.name}.` : "استكمال ربط الأسئلة بالمهارات لإظهار توصيات أدق.",
    notMastered > 0 ? `إعداد تدخل قصير للطلاب غير المتقنين وعددهم ${notMastered}.` : "تعزيز الممارسات الحالية للطلاب المتقنين.",
  ];

  const improvementPlan = (skillAnalysis.length ? skillAnalysis : domainAnalysis).slice(0, 5).map((item) => ({
    field: item.name,
    processToImprove: "رفع مستوى الإتقان في نواتج التعلم",
    needDescription: `نسبة الإتقان ${item.masteryPercentage}%، ومستوى الاحتياج: ${item.needLevel}.`,
    actions: "تحليل أخطاء الطلاب، تنفيذ معالجة قصيرة، إعادة قياس مصغر.",
    methods: "مجموعات علاجية، أسئلة محاكية، متابعة أسبوعية.",
    duration: "أسبوعان",
    responsibility: "معلم المادة بإشراف قائد المدرسة",
  }));

  const studentsById = new Map(students.map((item) => [item.id, item]));
  const studentRows = results.map((item) => ({
    studentName: options.showStudentNames ? studentsById.get(item.student_id)?.name ?? "طالب غير محدد" : "محجوب",
    score: Number(item.score),
    total: Number(item.total),
    percentage: pct(item.percentage),
    level: item.level || "غير محدد",
  }));

  return {
    reportType: options.reportType,
    title: reportTitle(options.reportType),
    period: {
      from: resolvedFrom,
      to: resolvedTo,
      weekNumber: options.weekNumber ?? null,
      hijriLabel: options.weekNumber ? weekLabel(options.weekNumber, resolvedFrom) : formatHijriPeriod(resolvedFrom, resolvedTo),
    },
    school: schoolRes.data,
    educationRegion: options.educationRegion?.trim() || schoolRes.data?.region || "المنطقة الشرقية",
    principalName: options.principalName?.trim() || profile.name || "قائد المدرسة",
    filters: {
      subject: normalizedSubject || "جميع المواد",
      grade: options.grade ?? null,
      showStudentNames: options.showStudentNames,
      includeImprovementPlan: options.includeImprovementPlan,
      includeRecommendations: options.includeRecommendations,
    },
    hasEnoughData: results.length > 0,
    generalData: {
      studentsCount: students.length,
      classesCount: classes.length,
      simulatedAssessmentsCount: uniquePackages.size,
      testedStudentsCount: uniqueTestedStudents.size,
      performanceAverage,
      masteryPercentage,
      notMasteredPercentage,
      improvementPercentage: improvement,
    },
    indicators,
    domainAnalysis,
    skillAnalysis,
    levelDistribution,
    improvementPlan,
    recommendations,
    studentRows,
    generatedAt: new Date().toISOString(),
  };
}

export type BuiltPeriodicReport = Awaited<ReturnType<typeof buildPeriodicReport>>;

function tableRows<T>(items: T[], render: (item: T) => string, emptyCols: number) {
  if (!items.length) return `<tr><td colspan="${emptyCols}" class="empty">لا توجد بيانات كافية</td></tr>`;
  return items.map(render).join("");
}

export function renderPeriodicReportHtml(report: BuiltPeriodicReport) {
  const gd = report.generalData;
  const subjectGrade = `${escapeHtml(report.filters.subject)}${report.filters.grade ? ` - الصف ${toEnglishDigits(report.filters.grade)}` : ""}`;
  const fileTitle = `${report.title} - ${report.period.weekNumber ? `الأسبوع ${toEnglishDigits(report.period.weekNumber)}` : "تقرير دوري"}`;
  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(fileTitle)}</title>
<style>
  @page { size: A4; margin: 14mm; }
  body { font-family: Arial, Tahoma, sans-serif; color: ${COLORS.navy}; margin: 0; background: #fff; }
  .page { max-width: 980px; margin: 0 auto; }
  .official-header { display: grid; grid-template-columns: 1fr auto 1fr; align-items: start; gap: 16px; border-bottom: 2px solid ${COLORS.navy}; padding-bottom: 14px; }
  .center { text-align: center; }
  .muted { color: #64748b; font-size: 12px; line-height: 1.8; }
  h1 { font-size: 22px; margin: 8px 0 4px; }
  h2 { font-size: 16px; margin: 24px 0 10px; padding: 8px 12px; background: #f8fafc; border-right: 4px solid ${COLORS.navy}; border-radius: 8px; }
  .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
  .card { border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px; background: #f8fafc; }
  .label { color: #64748b; font-size: 11px; font-weight: 700; }
  .value { font-size: 18px; font-weight: 900; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; page-break-inside: auto; }
  th, td { border: 1px solid #dbe3ea; padding: 8px; font-size: 12px; vertical-align: top; }
  th { background: #f1f5f9; font-weight: 900; }
  .empty { text-align: center; color: #94a3b8; font-weight: 700; padding: 18px; }
  .notes { border: 1px solid #dbe3ea; border-radius: 10px; padding: 12px; line-height: 1.9; font-size: 13px; }
  .signature { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-top: 32px; }
  .sign-box { height: 90px; border: 1px dashed #94a3b8; border-radius: 10px; padding: 10px; font-size: 12px; }
  @media print { .no-print { display: none; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head>
<body>
<div class="page">
  <button class="no-print" onclick="window.print()" style="position:fixed;left:16px;top:16px;padding:10px 16px;border-radius:10px;border:0;background:${COLORS.navy};color:white;font-weight:900">طباعة / حفظ PDF</button>
  <section class="official-header">
    <div class="muted">
      <strong>الإدارة العامة للتعليم بـ</strong> ${escapeHtml(report.educationRegion || ".............")}<br />
      <strong>مدرسة</strong> ${escapeHtml(report.school?.name || "—")}
    </div>
    <div class="center">
      <h1>${escapeHtml(report.title)}</h1>
      <div class="muted">${escapeHtml(report.period.hijriLabel)}</div>
    </div>
    <div class="muted">
      <strong>قائد المدرسة:</strong> ${escapeHtml(report.principalName)}<br />
      <strong>المادة والصف:</strong> ${subjectGrade}<br />
      <strong>تاريخ الإصدار:</strong> ${hijriDate(report.generatedAt.slice(0, 10)) ?? toEnglishDigits(report.generatedAt.slice(0, 10))}
    </div>
  </section>

  ${!report.hasEnoughData ? `<h2>حالة التقرير</h2><div class="notes">لا توجد نتائج كافية لإنشاء التقرير في الفترة المحددة.</div>` : ""}

  <h2>البيانات العامة</h2>
  <div class="grid">
    ${[
      ["عدد الطلاب", gd.studentsCount],
      ["عدد الفصول", gd.classesCount],
      ["عدد الاختبارات المحاكية", gd.simulatedAssessmentsCount],
      ["عدد الطلاب المختبرين", gd.testedStudentsCount],
      ["متوسط الأداء", gd.performanceAverage === null ? "—" : `${gd.performanceAverage}%`],
      ["نسبة الإتقان", gd.masteryPercentage === null ? "—" : `${gd.masteryPercentage}%`],
      ["نسبة غير المتقنين", gd.notMasteredPercentage === null ? "—" : `${gd.notMasteredPercentage}%`],
      ["نسبة التحسن", gd.improvementPercentage === null ? "—" : `${gd.improvementPercentage}%`],
    ].map(([label, value]) => `<div class="card"><div class="label">${escapeHtml(label)}</div><div class="value">${toEnglishDigits(value)}</div></div>`).join("")}
  </div>

  <h2>المؤشرات والمرئيات</h2>
  <table>
    <thead><tr><th>المؤشر</th><th>متحقق</th><th>متحقق إلى حد ما</th><th>غير متحقق</th><th>الوصف</th></tr></thead>
    <tbody>
      ${tableRows(report.indicators, (item) => `<tr><td>${escapeHtml(item.indicator)}</td><td>${item.status === "متحقق" ? "✓" : ""}</td><td>${item.status === "متحقق إلى حد ما" ? "✓" : ""}</td><td>${item.status === "غير متحقق" ? "✓" : ""}</td><td>${toEnglishDigits(escapeHtml(item.description))}</td></tr>`, 5)}
    </tbody>
  </table>

  <h2>تحليل المهارات والمجالات</h2>
  <table>
    <thead><tr><th>اسم المهارة أو المجال</th><th>عدد المتقنين</th><th>عدد غير المتقنين</th><th>نسبة الإتقان</th><th>مستوى الاحتياج</th></tr></thead>
    <tbody>
      ${tableRows([...report.skillAnalysis, ...report.domainAnalysis].slice(0, 12), (item) => `<tr><td>${escapeHtml(item.name)}</td><td>${toEnglishDigits(item.masteredCount)}</td><td>${toEnglishDigits(item.notMasteredCount)}</td><td>${toEnglishDigits(item.masteryPercentage)}%</td><td>${escapeHtml(item.needLevel)}</td></tr>`, 5)}
    </tbody>
  </table>

  <h2>توزيع الطلاب على مستويات الأداء</h2>
  <table>
    <thead><tr><th>مرتفع</th><th>متوسط</th><th>منخفض</th><th>منخفض جدًا</th></tr></thead>
    <tbody><tr><td>${toEnglishDigits(report.levelDistribution.high)}</td><td>${toEnglishDigits(report.levelDistribution.medium)}</td><td>${toEnglishDigits(report.levelDistribution.low)}</td><td>${toEnglishDigits(report.levelDistribution.veryLow)}</td></tr></tbody>
  </table>

  ${report.filters.showStudentNames ? `<h2>نتائج الطلاب</h2><table><thead><tr><th>اسم الطالب</th><th>الدرجة</th><th>النسبة</th><th>المستوى</th></tr></thead><tbody>${tableRows(report.studentRows, (item) => `<tr><td>${escapeHtml(item.studentName)}</td><td>${toEnglishDigits(item.score)}/${toEnglishDigits(item.total)}</td><td>${toEnglishDigits(item.percentage)}%</td><td>${escapeHtml(item.level)}</td></tr>`, 4)}</tbody></table>` : ""}

  ${report.filters.includeImprovementPlan ? `<h2>خطة التحسين</h2><table><thead><tr><th>المجال</th><th>العملية المراد تحسينها</th><th>وصف الاحتياج</th><th>إجراءات التحسين</th><th>أساليب وطرق التحسين</th><th>مدة الإنجاز</th><th>التنفيذ والمسؤولية</th></tr></thead><tbody>${tableRows(report.improvementPlan, (item) => `<tr><td>${escapeHtml(item.field)}</td><td>${escapeHtml(item.processToImprove)}</td><td>${toEnglishDigits(escapeHtml(item.needDescription))}</td><td>${escapeHtml(item.actions)}</td><td>${escapeHtml(item.methods)}</td><td>${escapeHtml(item.duration)}</td><td>${escapeHtml(item.responsibility)}</td></tr>`, 7)}</tbody></table>` : ""}

  ${report.filters.includeRecommendations ? `<h2>المرئيات والتوصيات</h2><div class="notes">${report.recommendations.map((item) => `• ${toEnglishDigits(escapeHtml(item))}`).join("<br />")}</div>` : ""}

  <h2>اعتماد التقرير</h2>
  <div class="signature">
    <div class="sign-box">أعضاء الفريق التنفيذي:<br /><br />................................</div>
    <div class="sign-box">قائد المدرسة:<br />${escapeHtml(report.principalName)}<br /><br />التوقيع: ................</div>
    <div class="sign-box">الختم:<br /><br /><br />................................</div>
  </div>
</div>
</body>
</html>`;
}
