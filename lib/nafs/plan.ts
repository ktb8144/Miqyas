import { DALA_SUBJECT, type NafsBaseline, type NafsSubject } from "./baseline";

/**
 * Turns a school's previous NAFS results into a situation report and an improvement plan.
 * Everything here is a fixed, explainable rule — no AI — so the principal can see why each
 * priority and target was chosen, and change them.
 */

export type Priority = "عاجلة" | "مرتفعة" | "متابعة";

export type DomainStatus = {
  name: string;
  percent: number;
  previous: number | null;
  change: number | null;
  priority: Priority;
  target: number;
};

export type SubjectStatus = {
  grade: number;
  subject: NafsSubject;
  dalaSubject: string;
  year: number;
  overall: number | null;
  previousOverall: number | null;
  change: number | null;
  mastery: number | null;
  previousMastery: number | null;
  domains: DomainStatus[];
};

export type PlanAction = { title: string; detail: string; owner: string; when: string; measure: string };

export type NafsPlan = {
  year: number;
  previousYear: number | null;
  subjects: SubjectStatus[];
  priorities: Array<{ grade: number; subject: NafsSubject; domain: string; percent: number; target: number; priority: Priority }>;
  attendance: Array<{ grade: number; tested: number; absent: number; rate: number; flagged: boolean }>;
  findings: string[];
  actions: PlanAction[];
  cycle: Array<{ week: number; subject: string; focus: string[] }>;
  rules: string[];
};

const round1 = (value: number) => Math.round(value * 10) / 10;

export function priorityFor(percent: number): Priority {
  if (percent < 35) return "عاجلة";
  if (percent < 50) return "مرتفعة";
  return "متابعة";
}

/** Suggested target for next year: bigger gain where the need is greatest. */
export function targetFor(percent: number) {
  const gain = percent < 35 ? 10 : percent < 50 ? 7 : 4;
  return round1(Math.min(100, percent + gain));
}

const PRIORITY_RANK: Record<Priority, number> = { "عاجلة": 0, "مرتفعة": 1, "متابعة": 2 };
const ABSENCE_FLAG = 0.1;

export function buildNafsPlan(baselines: NafsBaseline[]): NafsPlan | null {
  if (!baselines.length) return null;
  const year = Math.max(...baselines.map((b) => b.year));
  const latest = baselines.filter((b) => b.year === year);
  const earlierYears = baselines.map((b) => b.year).filter((y) => y < year);
  const previousYear = earlierYears.length ? Math.max(...earlierYears) : null;
  const previous = (grade: number, subject: string) =>
    previousYear === null ? undefined : baselines.find((b) => b.year === previousYear && b.grade === grade && b.subject === subject);

  const subjects: SubjectStatus[] = latest
    .sort((a, b) => a.grade - b.grade || a.subject.localeCompare(b.subject, "ar"))
    .map((b) => {
      const prev = previous(b.grade, b.subject);
      const sorted = [...b.domains].sort((x, y) => x.percent - y.percent);
      const domains = sorted.map((d, index) => {
        const prevDomain = prev?.domains.find((p) => p.name === d.name);
        let priority = priorityFor(d.percent);
        // The weakest domain of every subject is at least a high priority.
        if (index === 0 && priority === "متابعة") priority = "مرتفعة";
        return {
          name: d.name,
          percent: d.percent,
          previous: prevDomain?.percent ?? null,
          change: prevDomain ? round1(d.percent - prevDomain.percent) : null,
          priority,
          target: targetFor(d.percent),
        };
      });
      return {
        grade: b.grade,
        subject: b.subject,
        dalaSubject: DALA_SUBJECT[b.subject],
        year: b.year,
        overall: b.overallPercent,
        previousOverall: prev?.overallPercent ?? null,
        change: b.overallPercent !== null && prev?.overallPercent !== null && prev?.overallPercent !== undefined
          ? round1(b.overallPercent - prev.overallPercent)
          : null,
        mastery: b.masteryPercent,
        previousMastery: prev?.masteryPercent ?? null,
        domains,
      };
    });

  const priorities = subjects
    .flatMap((s) => s.domains
      .filter((d) => d.priority !== "متابعة")
      .map((d) => ({ grade: s.grade, subject: s.subject, domain: d.name, percent: d.percent, target: d.target, priority: d.priority })))
    .sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.percent - b.percent)
    .slice(0, 6);

  const attendance = Array.from(new Set(latest.map((b) => b.grade))).flatMap((grade) => {
    const withCounts = latest.find((b) => b.grade === grade && b.testedCount !== null && b.absentCount !== null);
    if (!withCounts) return [];
    const tested = withCounts.testedCount ?? 0;
    const absent = withCounts.absentCount ?? 0;
    const total = tested + absent;
    const rate = total ? absent / total : 0;
    return [{ grade, tested, absent, rate: round1(rate * 100), flagged: rate >= ABSENCE_FLAG }];
  });

  // ── Findings (plain statements of what the numbers say) ────────────────────
  const findings: string[] = [];
  const withChange = subjects.filter((s) => s.change !== null);
  if (withChange.length && withChange.every((s) => (s.change ?? 0) < 0)) {
    findings.push(`تراجعت كل المواد المقيسة عن ${previousYear}، فالخطة تحتاج متابعة شهرية لا نهاية العام فقط.`);
  }
  subjects.forEach((s) => {
    const label = `${s.subject} (الصف ${s.grade})`;
    if (s.overall !== null) {
      const trend = s.change === null ? "" : s.change < 0 ? `، بتراجع ${Math.abs(s.change)} نقطة عن ${previousYear}` : s.change > 0 ? `، بتحسن ${s.change} نقطة عن ${previousYear}` : "، دون تغير";
      findings.push(`${label}: ${s.overall}%${trend}.`);
    }
    const weakest = s.domains[0];
    if (weakest) findings.push(`أضعف مجال في ${label}: ${weakest.name} (${weakest.percent}%).`);
  });
  attendance.filter((a) => a.flagged).forEach((a) => {
    findings.push(`غاب ${a.absent} طالبًا من الصف ${a.grade} يوم الاختبار (${a.rate}%)، وهذا وحده يخفض نتيجة المدرسة.`);
  });

  // ── Actions, tied to how Dala runs every week ───────────────────────────────
  const prioritySummary = priorities.slice(0, 3).map((p) => `${p.domain} (${p.subject}، الصف ${p.grade})`).join("، ");
  const actions: PlanAction[] = [
    {
      title: "تشخيص أولي للمجالات ذات الأولوية",
      detail: prioritySummary
        ? `تطبيق تدريب دالة تشخيصي في: ${prioritySummary}، لمعرفة الأخطاء المفاهيمية الشائعة لدى طلاب هذا العام.`
        : "تطبيق تدريب دالة تشخيصي في كل مادة لمعرفة نقطة البداية لطلاب هذا العام.",
      owner: "معلمو المواد",
      when: "الأسبوعان الأولان",
      measure: "نسبة إتقان كل مجال في التدريب التشخيصي",
    },
    {
      title: "تدريب أسبوعي مركّز",
      detail: "في أسبوع كل مادة من دورة دالة، تُخصَّص 40% على الأقل من الأسئلة لمجالات الأولوية.",
      owner: "معلمو المواد",
      when: "كل دورة (4 أسابيع)",
      measure: "تطور إتقان مجالات الأولوية من دورة لأخرى",
    },
    {
      title: "معالجة فورية ثم إعادة قياس",
      detail: "بعد كل تدريب: ورقة معالجة للطلاب الذين لم يتقنوا مهارات المجال، ثم إعادة القياس في الدورة التالية.",
      owner: "معلمو المواد",
      when: "خلال أسبوع من كل تدريب",
      measure: "نسبة من أتقنوا المهارة بعد المعالجة",
    },
    {
      title: "مراجعة القيادة",
      detail: "عرض تقرير الدورة في اجتماع المعلمين ومقارنة كل مجال بالهدف المقترح أدناه.",
      owner: "قائد المدرسة",
      when: "نهاية كل دورة",
      measure: "عدد مجالات الأولوية التي تقترب من هدفها",
    },
    {
      title: "محاكاة نافس",
      detail: "اختبار محاكاة في الأسبوع الرابع من كل دورة، ومحاكاتان كاملتان قبل موعد نافس.",
      owner: "قائد المدرسة والمعلمون",
      when: "الأسبوع الرابع من كل دورة",
      measure: "متوسط المحاكاة ونسبة الطلاب دون الأساسي",
    },
  ];
  if (attendance.some((a) => a.flagged)) {
    actions.push({
      title: "رفع الحضور يوم اختبار نافس",
      detail: "إبلاغ أولياء الأمور بموعد الاختبار مبكرًا وتذكيرهم قبله بأسبوع ويوم، ومتابعة الغياب في أيام المحاكاة كتجربة.",
      owner: "قائد المدرسة والموجه الطلابي",
      when: "قبل موعد نافس بشهر",
      measure: "نسبة الغياب يوم الاختبار (الهدف أقل من 5%)",
    });
  }

  // ── One Dala cycle, with what each week focuses on ──────────────────────────
  const focusFor = (dalaSubject: string) =>
    priorities.filter((p) => DALA_SUBJECT[p.subject] === dalaSubject).slice(0, 2).map((p) => `${p.domain} — الصف ${p.grade}`);
  const hasScience = subjects.some((s) => s.subject === "علوم");
  const cycle = [
    { week: 1, subject: "رياضيات", focus: focusFor("رياضيات") },
    { week: 2, subject: "لغة عربية (القراءة)", focus: focusFor("لغة عربية") },
    ...(hasScience ? [{ week: 3, subject: "علوم", focus: focusFor("علوم") }] : []),
    { week: hasScience ? 4 : 3, subject: "محاكاة نافس", focus: ["كل المجالات، مع أسئلة إضافية في مجالات الأولوية"] },
  ];

  return {
    year,
    previousYear,
    subjects,
    priorities,
    attendance,
    findings,
    actions,
    cycle,
    rules: [
      "الأولوية «عاجلة» لمجال أقل من 35%، و«مرتفعة» لمجال أقل من 50%، وأضعف مجال في كل مادة أولويته «مرتفعة» على الأقل.",
      "الهدف المقترح للعام القادم: +10 نقاط للمجال العاجل، و+7 للمرتفع، و+4 لغيره. عدّل الأهداف حسب واقع مدرستك.",
      "نتائج نافس تصل للمدارس أرقامًا مجمّعة، فقياس التقدم خلال العام يكون من تدريبات دالة لا من نافس نفسه.",
    ],
  };
}
