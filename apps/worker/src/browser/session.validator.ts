import type { SessionConfig, UniversitySchema } from '@uni-apply/shared';
import type { Page } from 'playwright';
import { SessionExpiredError } from '../errors/session-expired.error.js';
import { isCsrfBlocked, isLoginPage } from './zzu-session.loader.js';

const DEFAULT_LOGIN_PATTERN = /\/member\/login\.do|\/login\.do|\/signin|\/auth\/login/i;

export async function assertSessionValid(
  page: Page,
  university: Pick<UniversitySchema, 'id' | 'displayName' | 'session'>,
): Promise<void> {
  const session = university.session;

  if (session?.loginUrlPattern) {
    const pattern = new RegExp(session.loginUrlPattern, 'i');
    if (pattern.test(page.url())) {
      throw new SessionExpiredError(
        `Redirected to login page — session expired for ${university.displayName}`,
        university.id,
      );
    }
  } else if (DEFAULT_LOGIN_PATTERN.test(page.url())) {
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

  if (await isCsrfBlocked(page)) {
    throw new SessionExpiredError(
      `CSRF protection triggered — re-login required for ${university.displayName}`,
      university.id,
    );
  }

  if (session?.expiredIndicators?.length) {
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

export function getLoginUrl(
  formUrl: string,
  session?: SessionConfig,
): string {
  if (session?.loginUrlPattern) {
    const base = new URL(formUrl);
    return `${base.origin}/member/login.do`;
  }

  if (/zzu\.17gz\.org/i.test(formUrl)) {
    return 'https://zzu.17gz.org/member/login.do';
  }

  return formUrl;
}
