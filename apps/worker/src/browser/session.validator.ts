import type { SessionConfig, UniversitySchema } from '@uni-apply/shared';
import type { Page } from 'playwright';
import { AttentionRequiredError } from '../errors/attention-required.error.js';
import { SessionExpiredError } from '../errors/session-expired.error.js';
import {
  describeAttentionReason,
  detectAttentionRequired,
} from './attention-detector.js';
import { isCsrfBlocked, isZzuFormUrl } from './zzu-session.loader.js';

const DEFAULT_LOGIN_PATTERN =
  /\/member\/login\.do|\/login\.do|\/student\/login(?:\/|$|\?)|\/signin|\/auth\/login/i;

export async function assertSessionValid(
  page: Page,
  university: Pick<UniversitySchema, 'id' | 'displayName' | 'session'>,
): Promise<void> {
  const session = university.session;
  const url = page.url();

  if (session?.loginUrlPattern) {
    const pattern = new RegExp(session.loginUrlPattern, 'i');
    if (pattern.test(url)) {
      throw new SessionExpiredError(
        `Redirected to login page — session expired for ${university.displayName}`,
        university.id,
      );
    }
  } else if (DEFAULT_LOGIN_PATTERN.test(url)) {
    throw new SessionExpiredError(
      `Redirected to login page — session expired for ${university.displayName}`,
      university.id,
    );
  }

  if (await isLoginPage(page)) {
    throw new SessionExpiredError(
      `Login form detected — session expired for ${university.displayName}`,
      university.id,
    );
  }

  // Checked only once we know we're NOT sitting on the plain login form — a CAPTCHA/2FA
  // prompt can sit in front of an otherwise-valid session on some other page, and conflating
  // that with "session expired" would send the agent into a pointless re-login loop. But on
  // platforms (e.g. 17gz) where the ordinary login form itself always carries a visible
  // CAPTCHA field as standard furniture, checking this first misclassified every expired
  // session as "attention required" instead — the login-page checks above must win first.
  const attentionReason = await detectAttentionRequired(
    page,
    session?.attentionIndicators,
  );
  if (attentionReason) {
    throw new AttentionRequiredError(
      `Automation blocked by ${describeAttentionReason(attentionReason)} for ${university.displayName}`,
      attentionReason,
      university.id,
    );
  }

  if (await isCsrfBlocked(page)) {
    throw new SessionExpiredError(
      `CSRF protection triggered — re-login required for ${university.displayName}`,
      university.id,
    );
  }

  // Body-text indicators only on login-ish URLs — CUCAS member pages can
  // contain "Sign Up" / "Forgot password" in footers and false-positive.
  if (session?.expiredIndicators?.length && looksLikeAuthUrl(url)) {
    const body = await page.locator('body').innerText();
    for (const indicator of session.expiredIndicators) {
      if (body.includes(indicator)) {
        throw new SessionExpiredError(
          `Session expired (${indicator}) — re-login required for ${university.displayName}`,
          university.id,
        );
      }
    }
  }
}

function looksLikeAuthUrl(url: string): boolean {
  return /\/login|\/signin|\/sign-in|\/register|\/auth\//i.test(url);
}

/**
 * Platform-aware login detection.
 * Avoids ZZU heuristic `form[action*=login] + password >= 2` which false-positives
 * on some CUCAS pages.
 */
export async function isLoginPage(page: Page): Promise<boolean> {
  const url = page.url();
  let pathname = url;

  try {
    pathname = new URL(url).pathname;
  } catch {
    // keep raw
  }

  if (
    /\/member\/login\.do$|\/login\.do$|\/student\/login\/?$|\/signin\/?$|\/sign-in\/?$|\/auth\/login/i.test(
      pathname,
    )
  ) {
    return true;
  }

  if ((await page.getByText('Account Sign In', { exact: true }).count()) > 0) {
    return true;
  }

  // CUCAS student login form
  const cucasLogin = await page
    .locator('#login_submit, form#myform[action*="do_login"]')
    .count();
  if (
    cucasLogin > 0 &&
    (await page.locator('input[name="password"]').count()) > 0
  ) {
    return true;
  }

  // 17gz
  const username = await page.locator("input[name='username']").count();
  const password = await page
    .locator("input[name='password'], input[type='password']")
    .count();

  return username > 0 && password > 0;
}

export function getLoginUrl(formUrl: string, session?: SessionConfig): string {
  if (session?.loginUrlPattern || isZzuFormUrl(formUrl)) {
    if (/chiwest\.cn|cucas\.cn|apply\.sdu\.edu\.cn/i.test(formUrl)) {
      return `${new URL(formUrl).origin}/en/student/login`;
    }

    return `${new URL(formUrl).origin}/member/login.do`;
  }

  return formUrl;
}
