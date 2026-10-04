// When a weekly test is shown to teachers, based on its start/end dates.
//
//   start - PRINT_AHEAD_DAYS ........ start ............ end ........ end + LATE_GRACE_DAYS
//   |-------- "upcoming" -------------|------------------ "current" -----------------------|  "past" →
//
// - upcoming: shown on the teacher's home so they can print it before the week begins.
// - current:  the test of the week (scanning open), including a short grace period after the end.
// - past:     leaves the home screen; still reachable under "الاختبارات السابقة" with its grades.
// - later:    too far ahead to show.

export const PRINT_AHEAD_DAYS = 3;
export const LATE_GRACE_DAYS = 3;
/** Used when a test has a start date but no end date. */
const DEFAULT_LENGTH_DAYS = 6;

export type TestPhase = "later" | "upcoming" | "current" | "past";

type DatedTest = {
  start_date?: string | null;
  end_date?: string | null;
  published_at?: string | null;
  created_at?: string | null;
};

/** Today's date (YYYY-MM-DD) in Saudi Arabia. */
export function saudiToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh" }).format(now);
}

export function addDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** The test's start and end dates, filling gaps: no start → publish date; no end → start + 6 days. */
export function testWindow(test: DatedTest) {
  const fallbackStart = (test.published_at ?? test.created_at ?? null)?.slice(0, 10) ?? null;
  const start = test.start_date ?? (test.end_date ? addDays(test.end_date, -DEFAULT_LENGTH_DAYS) : fallbackStart);
  const end = test.end_date ?? (start ? addDays(start, DEFAULT_LENGTH_DAYS) : null);
  return { start, end };
}

export function testPhase(test: DatedTest, today = saudiToday()): TestPhase {
  const { start, end } = testWindow(test);
  if (!start || !end) return "past";
  if (today < addDays(start, -PRINT_AHEAD_DAYS)) return "later";
  if (today < start) return "upcoming";
  if (today <= addDays(end, LATE_GRACE_DAYS)) return "current";
  return "past";
}
