export async function verifyUniversitySession(page, university) {
  await page.goto(university.formUrl, {
    waitUntil: 'networkidle',
    timeout: 60_000,
  });

  const url = page.url();
  const bodyPreview = (await page.locator('body').innerText().catch(() => '')).slice(
    0,
    1_500,
  );

  const redirectedToLogin =
    /login|signin|register/i.test(url) ||
    /sign in|log in|account sign in/i.test(bodyPreview);

  return {
    ok: !redirectedToLogin,
    url,
    reason: redirectedToLogin
      ? 'Redirected to login — session not valid yet'
      : 'Session looks valid',
  };
}

export function printVerifyResult(university, result) {
  if (result.ok) {
    console.log(`\n✓ ${university.displayName}: ${result.reason}`);
    console.log(`  URL: ${result.url}`);
    return;
  }

  console.log(`\n✗ ${university.displayName}: ${result.reason}`);
  console.log(`  URL: ${result.url}`);
}
