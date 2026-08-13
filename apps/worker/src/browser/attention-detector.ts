import type { Page } from 'playwright';
import type { AttentionReason } from '../errors/attention-required.error.js';

// Generic, platform-agnostic — university-specific text hints go in SessionConfig.attentionIndicators.
// `:visible` (Playwright's own CSS extension) matters here: broad selectors like
// [class*="captcha" i] would otherwise match dormant, never-shown library containers that some
// shared CMS/portal platforms bake into every page's markup regardless of whether a challenge
// is actually being presented. Note: on platforms whose ordinary login form carries a visible
// CAPTCHA field as standard furniture, a genuinely-visible match here still doesn't mean "attention
// required" — see the login-page-first ordering in session.validator.ts's assertSessionValid.
const CAPTCHA_SELECTOR = [
  'iframe[src*="recaptcha" i]:visible',
  'iframe[title*="recaptcha" i]:visible',
  '.g-recaptcha:visible',
  '#recaptcha:visible',
  'iframe[src*="hcaptcha" i]:visible',
  '.h-captcha:visible',
  'iframe[src*="turnstile" i]:visible',
  '[class*="captcha" i]:visible',
  'input[name*="captcha" i]:visible',
  'img[src*="captcha" i]:visible',
  'img[alt*="captcha" i]:visible',
].join(', ');

const TWO_FACTOR_SELECTOR = [
  'input[autocomplete="one-time-code"]:visible',
  'input[name*="otp" i]:visible',
  'input[name*="verifycode" i]:visible',
  'input[name*="verificationcode" i]:visible',
  'input[placeholder*="verification code" i]:visible',
  'input[placeholder*="one-time" i]:visible',
].join(', ');

/** Best-effort — a false negative just falls through to the existing session-expired checks. */
export async function detectAttentionRequired(
  page: Page,
  attentionIndicators?: string[],
): Promise<AttentionReason | null> {
  if ((await page.locator(CAPTCHA_SELECTOR).count()) > 0) {
    return 'captcha';
  }

  if ((await page.locator(TWO_FACTOR_SELECTOR).count()) > 0) {
    return 'two_factor';
  }

  if (attentionIndicators?.length) {
    const body = await page.locator('body').innerText();

    if (attentionIndicators.some((indicator) => body.includes(indicator))) {
      return 'text_indicator';
    }
  }

  return null;
}

export function describeAttentionReason(reason: AttentionReason): string {
  if (reason === 'captcha') {
    return 'a CAPTCHA';
  }

  if (reason === 'two_factor') {
    return 'a 2FA prompt';
  }

  return 'an unexpected verification step';
}
