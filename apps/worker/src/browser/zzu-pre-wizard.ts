import type { Page } from 'playwright';

export type PreWizardScreen =
  | 'application_notes'
  | 'program_type'
  | 'program_selection';

export async function waitForUiReady(page: Page): Promise<void> {
  await page
    .locator('.window-mask, .el-loading-mask')
    .first()
    .waitFor({ state: 'hidden', timeout: 20_000 })
    .catch(() => undefined);
  await page.waitForTimeout(300);
}

export async function dismissBlockingDialogs(page: Page): Promise<void> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const okButton = page
      .locator(
        [
          '.messager-button .okButton',
          '.messager-button input[value="Ok"]',
          '.messager-button input[value="OK"]',
          'button:has-text("OK")',
          'button:has-text("Continue")',
          'button:has-text("Accept")',
        ].join(', '),
      )
      .first();

    if ((await okButton.count()) === 0) {
      break;
    }

    await okButton.click({ force: true }).catch(() => undefined);
    await page.waitForTimeout(400);
  }
}

export async function detectPreWizardScreen(
  page: Page,
): Promise<PreWizardScreen | null> {
  return page.evaluate(() => {
    if (document.querySelector('select[name="collegeId"]')) {
      return 'program_selection';
    }

    const bodyText = document.body.innerText;
    if (/application notes|application instructions/i.test(bodyText)) {
      return 'application_notes';
    }

    if (
      /please choose your (program|type)|choose your (program )?type/i.test(
        bodyText,
      )
    ) {
      return 'program_type';
    }

    if (document.querySelector('input[name="projectTypeId"]')) {
      return 'program_type';
    }

    return null;
  });
}

export async function isMainWizard(page: Page): Promise<boolean> {
  const hasStepFields =
    (await page
      .locator(
        [
          'input[name="apply.lastName"]',
          'input[name="apply.givenName"]',
          'input[name="apply.passportNo"]',
          'form[action*="saveBase"]',
        ].join(', '),
      )
      .count()) > 0;

  return hasStepFields;
}

async function getPreWizardSignature(
  page: Page,
  screen: string | null,
): Promise<string> {
  const names = await page.evaluate(() =>
    [...document.querySelectorAll('input[name], select[name], textarea[name]')]
      .filter((el) => {
        const type = (el as HTMLInputElement).type?.toLowerCase?.() ?? '';
        return type !== 'hidden' && type !== 'button' && type !== 'submit';
      })
      .map((el) => (el as HTMLInputElement).name)
      .filter(Boolean)
      .sort()
      .slice(0, 8)
      .join('|'),
  );

  return `pre:${screen ?? 'unknown'}:${names}`;
}

/** 17gz radios often need onclick / Element-UI label click, not raw .click(). */
async function pickProjectTypeRadio(
  page: Page,
  programHint?: string,
): Promise<boolean> {
  return page.evaluate((hint) => {
    const radios = [
      ...document.querySelectorAll('input[type="radio"][name="projectTypeId"]'),
    ] as HTMLInputElement[];

    if (radios.length === 0) {
      return false;
    }

    const labelOf = (radio: HTMLInputElement) =>
      (
        radio.closest('label')?.textContent ??
        radio.closest('.el-radio')?.textContent ??
        radio.parentElement?.textContent ??
        ''
      ).trim();

    let target: HTMLInputElement | undefined;
    if (hint) {
      const needle = hint.toLowerCase();
      target = radios.find((radio) =>
        labelOf(radio).toLowerCase().includes(needle),
      );
    }

    target ??=
      radios.find((radio) => radio.value && radio.value !== '0' && !radio.disabled) ??
      radios[0];

    if (!target) {
      return false;
    }

    const onclick = target.getAttribute('onclick');
    const fnName = onclick?.match(/^([\w$]+)\(/)?.[1];
    if (fnName && typeof (window as unknown as Record<string, unknown>)[fnName] === 'function') {
      (
        (window as unknown as Record<string, (el: HTMLElement, ev: Event) => void>)[
          fnName
        ]
      )(target, new MouseEvent('click'));
      if (target.checked) {
        return true;
      }
    }

    const elLabel = target
      .closest('.el-radio')
      ?.querySelector('.el-radio__label') as HTMLElement | null;
    if (elLabel) {
      elLabel.click();
      if (target.checked) {
        return true;
      }
    }

    target.closest('label')?.click();
    if (!target.checked) {
      target.checked = true;
      target.dispatchEvent(new Event('change', { bubbles: true }));
      target.dispatchEvent(new Event('click', { bubbles: true }));
    }

    return target.checked;
  }, programHint ?? null);
}

async function checkAgree(page: Page): Promise<void> {
  const agree = page.locator('[name="agree"]');
  if ((await agree.count()) === 0) {
    return;
  }

  const checked = await agree.isChecked().catch(() => false);
  if (!checked) {
    await agree.click({ force: true }).catch(() => undefined);
  }
}

async function fillProgramSelection(page: Page): Promise<void> {
  const hasNativeOptions = await page.evaluate(() => {
    const college = document.querySelector(
      'select[name="collegeId"]',
    ) as HTMLSelectElement | null;
    return Boolean(college && college.options.length > 1);
  });

  if (!hasNativeOptions) {
    return;
  }

  const college = page.locator('select[name="collegeId"]');
  const collegeValue = await college
    .locator('option:nth-child(2)')
    .getAttribute('value');
  if (collegeValue) {
    await college.selectOption(collegeValue);
  }

  await page.waitForTimeout(1500);
  await page
    .waitForFunction(() => {
      const major = document.querySelector(
        'select[name="majorId"]',
      ) as HTMLSelectElement | null;
      return Boolean(major && major.options.length > 1);
    }, { timeout: 15_000 })
    .catch(() => undefined);

  const major = page.locator('select[name="majorId"]');
  if ((await major.count()) > 0 && (await major.locator('option').count()) > 1) {
    const majorValue = await major
      .locator('option:nth-child(2)')
      .getAttribute('value');
    if (majorValue) {
      await major.selectOption(majorValue);
    }
  }

  const language = page.locator('select[name="teachLanguage"]');
  if (
    (await language.count()) > 0 &&
    (await language.locator('option').count()) > 1
  ) {
    const langValue = await language
      .locator('option:nth-child(2)')
      .getAttribute('value');
    if (langValue) {
      await language.selectOption(langValue);
    }
  }

  await page.waitForTimeout(500);
}

async function isProgramSelectionEmpty(page: Page): Promise<boolean> {
  return page.evaluate(() => /Total:\s*0/i.test(document.body.innerText));
}

async function selectStudyPlanRow(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const rowLink = document.querySelector(
      'td.operation a, td:last-child a[onclick], a[onclick*="chooseStudyPlan"], a[onclick*="selectStudyPlan"], a[onclick*="chooseProject"]',
    ) as HTMLElement | null;

    if (!rowLink) {
      return null;
    }

    const onclick = rowLink.getAttribute('onclick');
    if (onclick) {
      const run = new Function('el', onclick.replace(/\bthis\b/g, 'el'));
      run(rowLink);
      return onclick;
    }

    rowLink.click();
    return rowLink.textContent?.trim() ?? 'click';
  });
}

export async function fillPreWizardScreen(
  page: Page,
  screen: PreWizardScreen,
  programHint?: string,
): Promise<boolean> {
  switch (screen) {
    case 'application_notes':
      await checkAgree(page);
      await pickProjectTypeRadio(page, programHint);
      break;
    case 'program_type':
      await pickProjectTypeRadio(page, programHint);
      break;
    case 'program_selection':
      await fillProgramSelection(page);
      break;
    default:
      break;
  }

  return true;
}

/**
 * Critical: program_type Next must call saveProjectType(form), not DOM click.
 */
async function clickPreWizardNext(
  page: Page,
  screen: PreWizardScreen,
): Promise<string | null> {
  if (screen === 'application_notes') {
    const agreeButton = page
      .getByRole('button', { name: /agree and continue/i })
      .first();
    if ((await agreeButton.count()) > 0) {
      await page
        .waitForFunction(() => {
          const buttons = [...document.querySelectorAll('button')];
          const agree = buttons.find((button) =>
            /agree and continue/i.test(button.textContent ?? ''),
          );
          return Boolean(agree && !(agree as HTMLButtonElement).disabled);
        }, { timeout: 10_000 })
        .catch(() => undefined);

      await agreeButton.click({ force: true });
      return 'Agree and Continue';
    }

    return invokeButton(page, ['Agree and Continue', 'Agree']);
  }

  if (screen === 'program_type') {
    return page.evaluate(() => {
      if (!document.querySelector('input[name="projectTypeId"]:checked')) {
        return null;
      }

      const btn = document.querySelector(
        'input[value="Next"]',
      ) as HTMLInputElement | null;
      const save = (window as unknown as { saveProjectType?: (form: HTMLFormElement) => void })
        .saveProjectType;

      if (typeof save === 'function' && btn?.form) {
        save(btn.form);
        return 'saveProjectType';
      }

      if (btn) {
        const onclick = btn.getAttribute('onclick');
        if (onclick) {
          const run = new Function('btn', onclick.replace(/\bthis\b/g, 'btn'));
          run(btn);
          return 'Next:onclick';
        }

        btn.click();
        return 'Next:click';
      }

      return null;
    });
  }

  if (screen === 'program_selection') {
    if (await isProgramSelectionEmpty(page)) {
      return 'empty_list';
    }

    return selectStudyPlanRow(page);
  }

  return invokeButton(page, ['Next']);
}

async function invokeButton(
  page: Page,
  labels: string[],
): Promise<string | null> {
  return page.evaluate((buttonLabels) => {
    const matches = (el: Element) => {
      if (el.tagName === 'INPUT') {
        const value = (el as HTMLInputElement).value?.trim() ?? '';
        return buttonLabels.some(
          (label) => value.toLowerCase() === label.toLowerCase(),
        );
      }

      const text = el.textContent?.trim() ?? '';
      return buttonLabels.some((label) =>
        new RegExp(`^${label}$`, 'i').test(text),
      );
    };

    const btn = [
      ...document.querySelectorAll(
        'input[type="button"], input[type="submit"], button, a',
      ),
    ].find(matches) as HTMLElement | undefined;

    if (!btn) {
      return null;
    }

    const onclick = btn.getAttribute('onclick');
    if (onclick) {
      const run = new Function('btn', onclick.replace(/\bthis\b/g, 'btn'));
      run(btn);
      return (
        (btn as HTMLInputElement).value ||
        btn.textContent?.trim() ||
        'clicked'
      );
    }

    btn.click();
    return (
      (btn as HTMLInputElement).value || btn.textContent?.trim() || 'clicked'
    );
  }, labels);
}

export async function advancePreWizardScreen(
  page: Page,
  screen: PreWizardScreen | null = null,
  programHint?: string,
): Promise<boolean> {
  await waitForUiReady(page);
  await dismissBlockingDialogs(page);

  const current = screen ?? (await detectPreWizardScreen(page));
  if (!current) {
    return false;
  }

  if (current === 'program_selection' && (await isProgramSelectionEmpty(page))) {
    return false;
  }

  const before = await getPreWizardSignature(page, current);
  await fillPreWizardScreen(page, current, programHint);
  await page.waitForTimeout(400);

  const clicked = await clickPreWizardNext(page, current);
  if (!clicked || clicked === 'empty_list') {
    return false;
  }

  await page
    .waitForLoadState('networkidle', { timeout: 30_000 })
    .catch(() => undefined);

  for (let attempt = 0; attempt < 12; attempt += 1) {
    await waitForUiReady(page);
    await dismissBlockingDialogs(page);

    if (await isMainWizard(page)) {
      return true;
    }

    const afterScreen = await detectPreWizardScreen(page);
    const after = await getPreWizardSignature(page, afterScreen ?? current);
    if (after !== before) {
      return true;
    }

    await page.waitForTimeout(500);
  }

  return false;
}

export async function advanceThroughPreWizard(
  page: Page,
  programHint?: string,
  { maxSteps = 10 } = {},
): Promise<boolean> {
  for (let step = 0; step < maxSteps; step += 1) {
    if (await isMainWizard(page)) {
      return true;
    }

    const screen = await detectPreWizardScreen(page);
    if (!screen) {
      return false;
    }

    const advanced = await advancePreWizardScreen(page, screen, programHint);
    if (!advanced) {
      return false;
    }
  }

  return isMainWizard(page);
}

export async function describeNavigationState(page: Page): Promise<string> {
  return page.evaluate(() => {
    const screen = (() => {
      if (document.querySelector('select[name="collegeId"]')) {
        return 'program_selection';
      }
      if (document.querySelector('input[name="projectTypeId"]')) {
        return 'program_type';
      }
      if (document.querySelector('input[name="apply.lastName"]')) {
        return 'wizard_step1';
      }
      return 'unknown';
    })();

    const radios = [
      ...document.querySelectorAll('input[name="projectTypeId"]'),
    ] as HTMLInputElement[];
    const checked = radios.find((radio) => radio.checked);
    const hasSave =
      typeof (window as unknown as { saveProjectType?: unknown }).saveProjectType ===
      'function';
    const next = document.querySelector('input[value="Next"]');
    const body = document.body.innerText.replace(/\s+/g, ' ').slice(0, 240);

    return [
      `screen=${screen}`,
      `radios=${radios.length}`,
      `checked=${checked ? checked.value : 'none'}`,
      `saveProjectType=${hasSave}`,
      `next=${Boolean(next)}`,
      `body="${body}"`,
    ].join('; ');
  });
}
