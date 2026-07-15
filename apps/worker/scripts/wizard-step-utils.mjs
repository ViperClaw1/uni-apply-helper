export async function waitForUiReady(page) {
  await page
    .locator('.window-mask, .el-loading-mask')
    .first()
    .waitFor({ state: 'hidden', timeout: 20_000 })
    .catch(() => undefined);
  await page.waitForTimeout(300);
}

export async function detectActiveWizardStep(page) {
  return page.evaluate(() => {
    const processHead = document.querySelector('.el-step__head.is-process');
    if (processHead) {
      const cell = processHead.closest('td') ?? processHead.closest('.el-step');
      const title = cell?.querySelector('.el-step__title')?.textContent?.trim() ?? '';
      const desc = cell?.querySelector('.el-step__description')?.textContent?.trim() ?? '';
      const num = title.match(/(\d+)/)?.[1];
      return {
        number: num ? Number(num) : null,
        title: desc || title || null,
      };
    }

    const bodyText = document.body.innerText;
    if (/upload documents/i.test(bodyText)) {
      return { number: 6, title: 'Upload Application Documents' };
    }
    if (/preview and submit/i.test(bodyText)) {
      return { number: 7, title: 'Preview and Submit' };
    }

    return null;
  });
}

export async function getStepSignature(page, collectFields) {
  const active = await detectActiveWizardStep(page);
  const fields = await collectFields(page);
  const names = fields
    .map((field) => field.name)
    .filter(Boolean)
    .sort()
    .slice(0, 8)
    .join('|');

  const stepNum = active?.number ?? '';
  const stepTitle = active?.title ?? '';
  return `${stepNum}:${stepTitle}:${names}`;
}

const WIZARD_STEP_TITLES = [
  'Basic Info',
  'Study Plan',
  'Education',
  'Additional Information',
  'Contact Information',
  'Upload Application Documents',
  'Preview and Submit',
];

export async function goToWizardStep(page, title) {
  await waitForUiReady(page);

  const scoped = page
    .locator('#left, .left, .left-menu, .apply-left, .step-list, .nav-list, ul')
    .getByText(new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'))
    .first();

  if ((await scoped.count()) > 0) {
    await scoped.click({ force: true });
    await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => undefined);
    await waitForUiReady(page);
    return true;
  }

  const fallback = page.getByText(new RegExp(`step\\s*\\d+[\\s:-]*${title}`, 'i')).first();
  if ((await fallback.count()) > 0) {
    await fallback.click({ force: true });
    await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => undefined);
    await waitForUiReady(page);
    return true;
  }

  return false;
}

export { WIZARD_STEP_TITLES };

export async function dismissBlockingDialogs(page) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const okButton = page
      .locator(
        '.messager-button .okButton, .messager-button input[value="Ok"], .messager-button input[value="OK"], .el-message-box__btns button:has-text("OK"), .el-message-box__btns button:has-text("Confirm"), .el-dialog__footer button:has-text("OK")',
      )
      .first();

    if ((await okButton.count()) === 0) {
      break;
    }

    await okButton.click({ force: true }).catch(() => undefined);
    await page.waitForTimeout(400);
  }

  await page
    .locator('.window-mask:not([style*="display: none"])')
    .first()
    .waitFor({ state: 'hidden', timeout: 10_000 })
    .catch(() => undefined);
}

async function invokeSaveAndNext(page) {
  return page.evaluate(() => {
    const btn =
      document.querySelector('input[value="Save and Next"]') ??
      document.querySelector('input[value="Next"]');

    if (!btn) {
      return null;
    }

    const onclick = btn.getAttribute('onclick');
    if (onclick) {
      // eslint-disable-next-line no-new-func
      const run = new Function('btn', onclick.replace(/\bthis\b/g, 'btn'));
      run(btn);
      return onclick;
    }

    btn.click();
    return 'click';
  });
}

async function hasValidationDialog(page) {
  return (
    (await page
      .locator('.messager-warning, .validate-result-msg, .messager-body')
      .filter({ hasText: /required|error|incorrect|format/i })
      .count()) > 0
  );
}

export async function clickSaveAndNext(page, collectFields) {
  await waitForUiReady(page);
  await dismissBlockingDialogs(page);

  const before = await getStepSignature(page, collectFields);
  const invoked = await invokeSaveAndNext(page);

  if (!invoked) {
    return false;
  }

  await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => undefined);

  for (let attempt = 0; attempt < 12; attempt += 1) {
    await waitForUiReady(page);

    if (await hasValidationDialog(page)) {
      await dismissBlockingDialogs(page);
      return false;
    }

    const after = await getStepSignature(page, collectFields);
    if (after !== before) {
      return true;
    }

    await dismissBlockingDialogs(page);
    await page.waitForTimeout(500);
  }

  return false;
}
