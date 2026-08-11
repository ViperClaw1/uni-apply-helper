export type AttentionReason = 'captcha' | 'two_factor' | 'text_indicator';

/** Automation hit something a human has to clear by hand — CAPTCHA, 2FA, or an unrecognized challenge page. Distinct from SessionExpiredError: the session itself may still be valid. */
export class AttentionRequiredError extends Error {
  readonly universityId?: string;
  readonly reason: AttentionReason;

  constructor(message: string, reason: AttentionReason, universityId?: string) {
    super(message);
    this.name = 'AttentionRequiredError';
    this.reason = reason;
    this.universityId = universityId;
  }
}
