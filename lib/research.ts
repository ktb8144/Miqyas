/**
 * Optional research participation (separate from the service terms).
 *
 * A school opts in (principal, or an independent teacher for their own account) and can withdraw at
 * any time; a parent can exclude their child from the parent report page. Research exports include only
 * schools whose consent matches the CURRENT version below, so changing the research information (for
 * example after ethics approval) means bumping the version: schools are asked to confirm again, and
 * nothing from older consents is exported.
 */

/** Bump when the research information on /research changes in substance. */
export const RESEARCH_CONSENT_VERSION = "2026-11-08";

/** Smallest group shown in any research output (classes and aggregate cells below this are dropped). */
export const RESEARCH_MIN_CELL = 5;

/** The research export stays locked until ethics and Ministry approvals are in place. */
export function researchExportEnabled() {
  return process.env.RESEARCH_EXPORT_ENABLED === "true";
}

/** Short wording of what a school agrees to, shown next to every consent control. */
export const RESEARCH_CONSENT_SUMMARY =
  "أوافق على استخدام نتائج مدرستي بعد تجهيلها (بلا أسماء طلاب أو معلمين أو اسم المدرسة) في البحث العلمي التربوي، وأعلم أن المشاركة اختيارية ويمكنني سحبها في أي وقت.";

export type ResearchConsentState = {
  granted: boolean;
  /** Consent was given to an older version of the research information. */
  outdated: boolean;
  version: string | null;
  updatedAt: string | null;
};

export function consentState(row: {
  research_consent?: boolean | null;
  research_consent_version?: string | null;
  research_consent_updated_at?: string | null;
} | null | undefined): ResearchConsentState {
  const granted = Boolean(row?.research_consent);
  const version = row?.research_consent_version ?? null;
  return {
    granted,
    outdated: granted && version !== RESEARCH_CONSENT_VERSION,
    version,
    updatedAt: row?.research_consent_updated_at ?? null,
  };
}
