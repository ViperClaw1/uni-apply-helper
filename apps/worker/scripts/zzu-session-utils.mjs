export { FORM_URL, MEMBER_URL } from './zzu-constants.mjs';
export {
  closeZzuBrowserSession,
  createZzuBrowserSession,
  loadSessionMeta,
  loadZzuSession,
  persistZzuSession,
  saveSessionMeta,
} from './zzu-browser.mjs';

export async function isLoginPage(page) {
  if (/\/member\/login\.do|\/login\.do/i.test(page.url())) {
    return true;
  }

  if ((await page.getByText('Account Sign In').count()) > 0) {
    return true;
  }

  const loginInputs = await page
    .locator("input[name='username'], input[name='password']")
    .count();

  return loginInputs >= 2;
}

export async function isCsrfBlocked(page) {
  const body = await page.locator('body').innerText();
  return /CSRF attack protection|security department/i.test(body);
}
