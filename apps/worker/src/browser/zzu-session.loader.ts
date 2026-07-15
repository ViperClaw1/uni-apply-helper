import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ConfigService } from '@nestjs/config';
import type { BrowserContextOptions, Page } from 'playwright';

export function loadZzuStorageState(
  configService: ConfigService,
): BrowserContextOptions['storageState'] | undefined {
  const b64 = configService.get<string>('ZZU_SESSION_STATE_B64');

  if (b64) {
    return JSON.parse(Buffer.from(b64, 'base64').toString('utf-8'));
  }

  const filePath = resolve(process.cwd(), 'zzu-session.json');

  if (existsSync(filePath)) {
    return JSON.parse(readFileSync(filePath, 'utf-8'));
  }

  return undefined;
}

export function isLoginRedirect(url: string): boolean {
  return /\/member\/login\.do|\/login\.do/i.test(url);
}

export async function isLoginPage(page: Page): Promise<boolean> {
  if (isLoginRedirect(page.url())) {
    return true;
  }

  const signInHeading = await page.getByText('Account Sign In').count();
  if (signInHeading > 0) {
    return true;
  }

  const loginForm = await page
    .locator("form[action*='login'], input[name='username'], input[name='password']")
    .count();

  return loginForm >= 2;
}

export async function isCsrfBlocked(page: Page): Promise<boolean> {
  const body = await page.locator('body').innerText();
  return /CSRF attack protection|security department/i.test(body);
}

export function isZzuFormUrl(formUrl: string): boolean {
  return /zzu\.17gz\.org/i.test(formUrl);
}
