/**
 * Session is valid if we can open formUrl without landing on a login page.
 * Do NOT scan body for loose "sign in" / "log in" — apply pages often contain those strings.
 */
export async function verifyUniversitySession(page, university) {
  const formUrl = university.formUrl;
  let referer;
  try {
    referer = `${new URL(formUrl).origin}/member/index.do`;
  } catch {
    referer = undefined;
  }

  // 17gz rejects cold apply/index.do without member Referer (looks like dead session).
  await page.goto(formUrl, {
    waitUntil: 'domcontentloaded',
    timeout: 60_000,
    ...(referer ? { referer } : {}),
  });

  const url = page.url();
  const body = await page.locator('body').innerText().catch(() => '');
  if (/CSRF attack protection|security department|操作被拒绝/i.test(body)) {
    return {
      ok: false,
      url,
      reason:
        'CSRF blocked even with referer — session cookies invalid, re-capture',
    };
  }

  const onLoginPage = await isLoginPage(page);
  const identity = await readLoggedInIdentity(page);

  return {
    ok: !onLoginPage,
    url,
    identity,
    reason: onLoginPage
      ? 'Redirected to login — session not valid yet'
      : 'Session looks valid',
  };
}

/** Best-effort account label from 17gz header (username / email). */
async function readLoggedInIdentity(page) {
  return page
    .evaluate(() => {
      const body = (document.body?.innerText || '').replace(/\s+/g, ' ').trim();
      const email = body.match(
        /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,
      )?.[0];
      // Header pattern: "中文English <user> <email>"
      const user =
        body.match(
          /(?:English|中文)\s+([A-Za-z0-9._-]{2,40})\s+[a-zA-Z0-9._%+-]+@/i,
        )?.[1] ?? null;
      return { user, email: email ?? null };
    })
    .catch(() => ({ user: null, email: null }));
}

async function isLoginPage(page) {
  const url = page.url();
  let pathname = url;

  try {
    pathname = new URL(url).pathname;
  } catch {
    // keep raw url
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

  const username = await page.locator("input[name='username']").count();
  const password = await page
    .locator("input[name='password'], input[type='password']")
    .count();

  return username > 0 && password > 0;
}

export function printVerifyResult(university, result) {
  const who =
    result.identity?.email || result.identity?.user
      ? ` as ${[result.identity.user, result.identity.email].filter(Boolean).join(' / ')}`
      : '';

  if (result.ok) {
    console.log(`\n✓ ${university.displayName}: ${result.reason}${who}`);
    console.log(`  URL: ${result.url}`);
    return;
  }

  console.log(`\n✗ ${university.displayName}: ${result.reason}${who}`);
  console.log(`  URL: ${result.url}`);
}
