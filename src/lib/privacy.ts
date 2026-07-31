/**
 * Privacy-notice configuration, read from the environment so the candidate-
 * facing notice carries the deploying company's real details rather than
 * anything hard-coded.
 *
 * This module supplies the *content* of the notice and the version stamped onto
 * each consent record. It does not, and cannot, make the deployment lawful —
 * that depends on the organisation choosing a valid legal basis, running a DPIA
 * for the camera monitoring, and enforcing the retention period it states here.
 */
export interface PrivacyConfig {
  company: string;
  contactEmail: string;
  retention: string;
  noticeVersion: string;
}

export function privacyConfig(): PrivacyConfig {
  return {
    company: process.env.COMPANY_NAME || "the hiring company",
    contactEmail: process.env.PRIVACY_CONTACT_EMAIL || "privacy@example.com",
    retention: process.env.DATA_RETENTION || "no longer than necessary for recruitment",
    noticeVersion: process.env.PRIVACY_NOTICE_VERSION || "1",
  };
}
