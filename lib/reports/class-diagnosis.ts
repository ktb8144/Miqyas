import { getLevelFromPercentage, MASTERY_THRESHOLD, type LevelName } from "@/lib/levels";
import { misconceptionForOption } from "@/lib/assessment/question-helpers";

/**
 * Turns a class's saved test results into a diagnosis: how each skill is going, which wrong
 * answers keep coming back, and whether the class is moving. Pure and deterministic, so the
 * numbers in the report never come from the AI — the AI only explains them.
 */

export type DiagnosisInput = {
  className: string;
  grade: number | null;
  subject: string | null;
  students: Array<{ id: string; name: string }>;
  tests: Array<{ packageId: string; title: string; week: number | null; date: string | null }>;
  results: Array<{ id: string; studentId: string; packageId: string; score: number; total: number; percentage: number; scannedAt: string | null }>;
  answers: Array<{ resultId: string; studentId: string; questionId: string | null; selected: string | null; isCorrect: boolean }>;
  questions: Array<{
    id: string;
    packageId: string;
    number: number;
    text: string | null;
    options: Record<string, string> | null;
    correct: string | null;
    skill: string | null;
    domain: string | null;
    misconceptions: unknown;
    remediation: string | null;
  }>;
};

export type TestSummary = {
  packageId: string;
  title: string;
  week: number | null;
  date: string | null;
  tested: number;
  average: number;
  levels: Record<LevelName, number>;
};

export type SkillStat = {
  skill: string;
  domain: string;
  attempts: number;
  mastery: number;
  questionCount: number;
  testsCount: number;
  /** Students who got less than two thirds of this skill's questions right. */
  studentsMissed: number;
  studentsMeasured: number;
  earlierMastery: number | null;
  latestMastery: number | null;
  /** The wrong answer chosen most, on the question where it happened; share is of that question's wrong answers. */
  topWrong: { question: number; option: string; value: string | null; share: number } | null;
  misconception: { text: string; count: number } | null;
};

export type FocusQuestion = {
  number: number;
  test: string;
  text: string | null;
  options: Record<string, string> | null;
  correct: string | null;
  attempts: number;
  mastery: number;
  /** How many students chose each option ("blank" for no answer). */
  choices: Record<string, number>;
  recordedMisconception: string | null;
  remediation: string | null;
};

export type FocusSkill = SkillStat & { questions: FocusQuestion[] };

/** A question where almost nobody matched the key and most chose the same other option. */
export type KeyCheck = {
  test: string;
  question: number;
  skill: string;
  keyOption: string;
  keyValue: string | null;
  popularOption: string;
  popularValue: string | null;
  /** Share of all students on that question who chose the popular option. */
  popularShare: number;
  mastery: number;
  attempts: number;
};

export type ClassDiagnosis = {
  className: string;
  grade: number | null;
  subject: string | null;
  studentCount: number;
  testedCount: number;
  tests: TestSummary[];
  trend: { first: number; latest: number; change: number; tests: number } | null;
  skills: SkillStat[];
  domains: Array<{ domain: string; mastery: number; attempts: number }>;
  focus: FocusSkill[];
  /** Who to group for each focus skill. Shown to the teacher only, never sent to the AI. */
  groups: Array<{ skill: string; students: Array<{ id: string; name: string }> }>;
  notTestedLatest: Array<{ id: string; name: string }>;
  keyChecks: KeyCheck[];
  gaps: string[];
};

const LEVELS: LevelName[] = ["متقدم", "متمكن", "أساسي", "دون الأساسي"];
const UNKNOWN_SKILL = "مهارة غير محددة";
const UNKNOWN_DOMAIN = "مجال غير محدد";
/** The most recent tests a report looks at. */
export const REPORT_TEST_WINDOW = 8;

const pct = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : 0);
const missed = (correct: number, attempts: number) => correct * 3 < attempts * 2;

/** Question text that only points to the PDF is no use to anyone reading the report. */
export function usableQuestionText(text: string | null | undefined) {
  const value = text?.trim();
  if (!value) return null;
  if (/راجع\s+(ملف\s+)?(ال)?pdf/i.test(value) || /^سؤال\s+رقم\s*\d+\s*$/.test(value)) return null;
  return value.length > 300 ? `${value.slice(0, 300)}…` : value;
}

function testTime(test: { date: string | null; week: number | null }, firstScan: string | null) {
  const date = test.date ?? firstScan;
  const time = date ? Date.parse(date) : NaN;
  return Number.isFinite(time) ? time : (test.week ?? 0) * 7 * 86400000;
}

export function buildClassDiagnosis(input: DiagnosisInput): ClassDiagnosis {
  const studentIds = new Set(input.students.map((s) => s.id));
  const results = input.results.filter((r) => studentIds.has(r.studentId) && r.total > 0);

  // ── Tests, oldest first, limited to the most recent window ──────────────────
  const firstScan = new Map<string, string>();
  results.forEach((r) => {
    if (!r.scannedAt) return;
    const current = firstScan.get(r.packageId);
    if (!current || r.scannedAt < current) firstScan.set(r.packageId, r.scannedAt);
  });
  const testedPackages = new Set(results.map((r) => r.packageId));
  const tests = input.tests
    .filter((t) => testedPackages.has(t.packageId))
    .sort((a, b) => testTime(a, firstScan.get(a.packageId) ?? null) - testTime(b, firstScan.get(b.packageId) ?? null))
    .slice(-REPORT_TEST_WINDOW);
  const windowPackages = new Set(tests.map((t) => t.packageId));
  const testOrder = new Map(tests.map((t, index) => [t.packageId, index]));
  const windowResults = results.filter((r) => windowPackages.has(r.packageId));
  const resultsById = new Map(windowResults.map((r) => [r.id, r]));

  const testSummaries: TestSummary[] = tests.map((test) => {
    const rows = windowResults.filter((r) => r.packageId === test.packageId);
    const levels = Object.fromEntries(LEVELS.map((level) => [level, 0])) as Record<LevelName, number>;
    rows.forEach((r) => { levels[getLevelFromPercentage(r.percentage)] += 1; });
    return {
      packageId: test.packageId,
      title: test.title,
      week: test.week,
      date: test.date ?? firstScan.get(test.packageId)?.slice(0, 10) ?? null,
      tested: rows.length,
      average: rows.length ? Math.round(rows.reduce((sum, r) => sum + r.percentage, 0) / rows.length) : 0,
      levels,
    };
  });

  const trend = testSummaries.length >= 2
    ? {
        first: testSummaries[0].average,
        latest: testSummaries[testSummaries.length - 1].average,
        change: testSummaries[testSummaries.length - 1].average - testSummaries[0].average,
        tests: testSummaries.length,
      }
    : null;

  // ── Skills ───────────────────────────────────────────────────────────────────
  const questionsById = new Map(input.questions.map((q) => [q.id, q]));
  type Bucket = {
    skill: string;
    domain: string;
    attempts: number;
    correct: number;
    questions: Set<string>;
    tests: Set<string>;
    perStudent: Map<string, { attempts: number; correct: number }>;
    perTest: Map<string, { attempts: number; correct: number }>;
    wrong: Map<string, number>;
    misconceptions: Map<string, number>;
  };
  const buckets = new Map<string, Bucket>();
  const perQuestion = new Map<string, { attempts: number; correct: number; choices: Map<string, number> }>();
  let answersWithoutQuestion = 0;

  input.answers.forEach((answer) => {
    const result = resultsById.get(answer.resultId);
    if (!result) return;
    const question = answer.questionId ? questionsById.get(answer.questionId) : undefined;
    if (!question) { answersWithoutQuestion++; return; }
    const skill = question.skill?.trim() || UNKNOWN_SKILL;
    const domain = question.domain?.trim() || UNKNOWN_DOMAIN;
    const key = `${domain}::${skill}`;
    const bucket = buckets.get(key) ?? {
      skill, domain, attempts: 0, correct: 0, questions: new Set(), tests: new Set(),
      perStudent: new Map(), perTest: new Map(), wrong: new Map(), misconceptions: new Map(),
    };
    bucket.attempts++;
    bucket.questions.add(question.id);
    bucket.tests.add(result.packageId);
    const student = bucket.perStudent.get(answer.studentId) ?? { attempts: 0, correct: 0 };
    const test = bucket.perTest.get(result.packageId) ?? { attempts: 0, correct: 0 };
    student.attempts++;
    test.attempts++;
    const choice = answer.selected?.trim() || "blank";
    if (answer.isCorrect) {
      bucket.correct++;
      student.correct++;
      test.correct++;
    } else {
      bucket.wrong.set(`${question.id}::${choice}`, (bucket.wrong.get(`${question.id}::${choice}`) ?? 0) + 1);
      const recorded = misconceptionForOption(question.misconceptions, choice);
      if (recorded) bucket.misconceptions.set(recorded, (bucket.misconceptions.get(recorded) ?? 0) + 1);
    }
    bucket.perStudent.set(answer.studentId, student);
    bucket.perTest.set(result.packageId, test);
    buckets.set(key, bucket);

    const q = perQuestion.get(question.id) ?? { attempts: 0, correct: 0, choices: new Map() };
    q.attempts++;
    if (answer.isCorrect) q.correct++;
    q.choices.set(choice, (q.choices.get(choice) ?? 0) + 1);
    perQuestion.set(question.id, q);
  });

  const skills: SkillStat[] = Array.from(buckets.values()).map((b) => {
    const topWrongEntry = Array.from(b.wrong.entries()).sort((x, y) => y[1] - x[1])[0];
    let topWrong: SkillStat["topWrong"] = null;
    if (topWrongEntry) {
      const [questionId, option] = topWrongEntry[0].split("::");
      const question = questionsById.get(questionId);
      const counts = perQuestion.get(questionId);
      const wrongOnQuestion = counts ? counts.attempts - counts.correct : 0;
      topWrong = {
        question: question?.number ?? 0,
        option,
        value: option === "blank" ? null : question?.options?.[option] ?? null,
        share: pct(topWrongEntry[1], wrongOnQuestion),
      };
    }
    const topMisconception = Array.from(b.misconceptions.entries()).sort((x, y) => y[1] - x[1])[0];
    const orderedTests = Array.from(b.perTest.entries()).sort((x, y) => (testOrder.get(x[0]) ?? 0) - (testOrder.get(y[0]) ?? 0));
    let earlierMastery: number | null = null;
    let latestMastery: number | null = null;
    if (orderedTests.length >= 2) {
      const latest = orderedTests[orderedTests.length - 1][1];
      const earlier = orderedTests.slice(0, -1).reduce((acc, [, t]) => ({ attempts: acc.attempts + t.attempts, correct: acc.correct + t.correct }), { attempts: 0, correct: 0 });
      earlierMastery = pct(earlier.correct, earlier.attempts);
      latestMastery = pct(latest.correct, latest.attempts);
    }
    return {
      skill: b.skill,
      domain: b.domain,
      attempts: b.attempts,
      mastery: pct(b.correct, b.attempts),
      questionCount: b.questions.size,
      testsCount: b.tests.size,
      studentsMissed: Array.from(b.perStudent.values()).filter((s) => missed(s.correct, s.attempts)).length,
      studentsMeasured: b.perStudent.size,
      earlierMastery,
      latestMastery,
      topWrong,
      misconception: topMisconception ? { text: topMisconception[0], count: topMisconception[1] } : null,
    };
  }).sort((a, b) => a.mastery - b.mastery || b.studentsMissed - a.studentsMissed);

  const domainMap = new Map<string, { attempts: number; correct: number }>();
  buckets.forEach((b) => {
    const d = domainMap.get(b.domain) ?? { attempts: 0, correct: 0 };
    d.attempts += b.attempts;
    d.correct += b.correct;
    domainMap.set(b.domain, d);
  });
  const domains = Array.from(domainMap.entries())
    .map(([domain, d]) => ({ domain, mastery: pct(d.correct, d.attempts), attempts: d.attempts }))
    .sort((a, b) => a.mastery - b.mastery);

  // ── Focus: the weakest skills below mastery (at most three), with their questions ─
  const known = skills.filter((s) => s.skill !== UNKNOWN_SKILL);
  const focusStats = (known.length ? known : skills).filter((s) => s.mastery < MASTERY_THRESHOLD).slice(0, 3);
  const titleOf = new Map(tests.map((t) => [t.packageId, t.title]));
  const focus: FocusSkill[] = focusStats.map((stat) => {
    const bucket = buckets.get(`${stat.domain}::${stat.skill}`)!;
    const questions = Array.from(bucket.questions)
      .map((id) => questionsById.get(id)!)
      .map((q) => {
        const counts = perQuestion.get(q.id)!;
        const top = Array.from(counts.choices.entries()).filter(([option]) => option !== q.correct).sort((x, y) => y[1] - x[1])[0];
        return {
          number: q.number,
          test: titleOf.get(q.packageId) ?? "",
          text: usableQuestionText(q.text),
          options: q.options,
          correct: q.correct,
          attempts: counts.attempts,
          mastery: pct(counts.correct, counts.attempts),
          choices: Object.fromEntries(counts.choices),
          recordedMisconception: top ? misconceptionForOption(q.misconceptions, top[0]) : null,
          remediation: q.remediation?.trim() || null,
        };
      })
      .sort((a, b) => a.mastery - b.mastery)
      .slice(0, 3);
    return { ...stat, questions };
  });

  const nameOf = new Map(input.students.map((s) => [s.id, s.name]));
  const groups = focus.map((stat) => {
    const bucket = buckets.get(`${stat.domain}::${stat.skill}`)!;
    const students = Array.from(bucket.perStudent.entries())
      .filter(([, s]) => missed(s.correct, s.attempts))
      .map(([id]) => ({ id, name: nameOf.get(id) ?? "طالب" }))
      .sort((a, b) => a.name.localeCompare(b.name, "ar", { numeric: true }));
    return { skill: stat.skill, students };
  });

  // A wrong answer key looks exactly like this: (almost) nobody "right", and most students agreeing on another option.
  const keyChecks: KeyCheck[] = [];
  perQuestion.forEach((counts, questionId) => {
    const q = questionsById.get(questionId);
    if (!q?.correct || counts.attempts < 8) return;
    const mastery = pct(counts.correct, counts.attempts);
    const popular = Array.from(counts.choices.entries()).filter(([option]) => option !== q.correct && option !== "blank").sort((x, y) => y[1] - x[1])[0];
    if (!popular || mastery > 20) return;
    const popularShare = pct(popular[1], counts.attempts);
    if (popularShare < 60 || popularShare < mastery * 3) return;
    keyChecks.push({
      test: titleOf.get(q.packageId) ?? "",
      question: q.number,
      skill: q.skill?.trim() || UNKNOWN_SKILL,
      keyOption: q.correct,
      keyValue: q.options?.[q.correct] ?? null,
      popularOption: popular[0],
      popularValue: q.options?.[popular[0]] ?? null,
      popularShare,
      mastery,
      attempts: counts.attempts,
    });
  });
  keyChecks.sort((a, b) => a.mastery - b.mastery || b.popularShare - a.popularShare);

  const latestTest = tests[tests.length - 1];
  const testedLatest = new Set(windowResults.filter((r) => r.packageId === latestTest?.packageId).map((r) => r.studentId));
  const notTestedLatest = latestTest
    ? input.students.filter((s) => !testedLatest.has(s.id)).map((s) => ({ id: s.id, name: s.name }))
    : [];

  // ── What the data cannot tell us ───────────────────────────────────────────
  const gaps: string[] = [];
  if (testSummaries.length === 1) gaps.push("التقرير مبني على اختبار واحد، فلا يظهر اتجاه التطور بعد.");
  if (testSummaries.length > 1) gaps.push("الاختبارات تقيس مهارات مختلفة، فمقارنة متوسطاتها تقريبية؛ الأدق مقارنة كل مهارة بنفسها في عمود «قبل ← آخر قياس».");
  const singleQuestionFocus = focus.filter((s) => s.questionCount < 2).map((s) => s.skill);
  if (singleQuestionFocus.length) gaps.push(`مقيسة بسؤال واحد فقط: ${singleQuestionFocus.join("، ")}. أعد قياسها قبل الحكم النهائي.`);
  const unknownAttempts = skills.filter((s) => s.skill === UNKNOWN_SKILL).reduce((sum, s) => sum + s.attempts, 0);
  if (unknownAttempts) gaps.push("بعض الأسئلة غير مربوطة بمهارة، فلم تدخل في تحليل المهارات.");
  const focusQuestions = focus.flatMap((s) => s.questions);
  if (focusQuestions.length && focusQuestions.every((q) => !q.recordedMisconception)) {
    gaps.push("أسئلة المهارات الأضعف بلا أخطاء شائعة مسجّلة، فالسبب المرجّح مستنتج من البدائل التي اختارها الطلاب.");
  }
  if (answersWithoutQuestion) gaps.push("بعض الإجابات لا ترتبط بسؤال محفوظ وتم تجاهلها.");

  return {
    className: input.className,
    grade: input.grade,
    subject: input.subject,
    studentCount: input.students.length,
    testedCount: new Set(windowResults.map((r) => r.studentId)).size,
    tests: testSummaries,
    trend,
    skills,
    domains,
    focus,
    groups,
    notTestedLatest,
    keyChecks,
    gaps,
  };
}
