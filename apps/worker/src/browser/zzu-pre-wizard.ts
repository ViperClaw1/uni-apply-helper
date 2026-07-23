import type { Page } from 'playwright';

export type PreWizardScreen =
  | 'application_notes'
  | 'program_type'
  | 'program_selection';

export async function waitForUiReady(page: Page): Promise<void> {
  // Dismiss dialogs first — otherwise "请求正在处理中..." never clears and we burn 30s.
  await dismissBlockingDialogs(page);

  await page
    .locator('.window-mask, .el-loading-mask, .datagrid-mask')
    .first()
    .waitFor({ state: 'hidden', timeout: 10_000 })
    .catch(() => undefined);

  await page
    .waitForFunction(
      () => {
        const text = document.body?.innerText ?? '';
        return !/请求正在处理中|please wait|processing/i.test(text);
      },
      { timeout: 8_000 },
    )
    .catch(() => undefined);

  await page.waitForTimeout(200);
}

export async function dismissBlockingDialogs(page: Page): Promise<void> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const okButton = page
      .locator(
        [
          'input.okButton',
          'input[value="Ok"]',
          'input[value="OK"]',
          '.messager-button .okButton',
          '.messager-button input[value="Ok"]',
          '.messager-button input[value="OK"]',
          '.messager-button a',
          '.messager-window input.okButton',
          'button:has-text("OK")',
          'button:has-text("Ok")',
          'button:has-text("Continue")',
          'button:has-text("Accept")',
          'button:has-text("确定")',
        ].join(', '),
      )
      .first();

    if ((await okButton.count()) === 0) {
      break;
    }

    if (!(await okButton.isVisible().catch(() => false))) {
      break;
    }

    await okButton.click({ force: true }).catch(() => undefined);
    await page.waitForTimeout(400);
  }

  // Force-hide stuck easyui overlay if Ok never worked.
  await page
    .evaluate(() => {
      const text = document.body?.innerText ?? '';
      if (!/请求正在处理中|processing/i.test(text)) {
        return;
      }

      for (const el of document.querySelectorAll(
        '.window-mask, .datagrid-mask, .messager-window, .panel.window, .window-shadow',
      )) {
        (el as HTMLElement).style.display = 'none';
      }
    })
    .catch(() => undefined);
}

export async function detectPreWizardScreen(
  page: Page,
): Promise<PreWizardScreen | null> {
  return page.evaluate(() => {
    if (document.querySelector('select[name="collegeId"]')) {
      return 'program_selection';
    }

    // Radios win over notes text — KMMC combines 申请须知 + program type on one page.
    if (document.querySelector('input[name="projectTypeId"]')) {
      return 'program_type';
    }

    const bodyText = document.body?.innerText ?? '';
    if (
      /application notes|application instructions|申请须知|申请人保证/i.test(
        bodyText,
      )
    ) {
      return 'application_notes';
    }

    if (
      /please choose your (program|type)|choose your (program )?type/i.test(
        bodyText,
      )
    ) {
      return 'program_type';
    }

    return null;
  });
}

export async function isMainWizard(page: Page): Promise<boolean> {
  // Hidden Step 1 fields can sit in DOM on pre-wizard screens — require visible.
  const selectors = [
    'input[name="apply.lastName"]',
    'input[name="apply.givenName"]',
    'input[name="apply.passportNo"]',
  ];

  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if ((await locator.count()) === 0) {
      continue;
    }

    if (await locator.isVisible().catch(() => false)) {
      return true;
    }
  }

  return false;
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

/**
 * Prefer Playwright real gestures over page.evaluate click — evaluate
 * synthetic clicks often don't stick on 17gz/easyUI radios.
 */
async function pickProjectTypeRadio(
  page: Page,
  programHint?: string,
): Promise<boolean> {
  await dismissBlockingDialogs(page);

  const radios = page.locator('input[type="radio"][name="projectTypeId"]');
  const count = await radios.count();
  if (count === 0) {
    return false;
  }

  let index = 0;
  if (programHint) {
    const needle = programHint.toLowerCase();
    for (let i = 0; i < count; i += 1) {
      const radio = radios.nth(i);
      const labelText = await radio.evaluate((el) => {
        const input = el as HTMLInputElement;
        return (
          input.closest('label')?.textContent ??
          input.closest('.el-radio')?.textContent ??
          input.parentElement?.textContent ??
          ''
        ).trim();
      });
      if (labelText.toLowerCase().includes(needle)) {
        index = i;
        break;
      }
    }
  }

  const target = radios.nth(index);
  const value = await target.getAttribute('value');

  // 1) Playwright check() — real browser gesture
  await target.check({ force: true }).catch(() => undefined);
  if (await target.isChecked().catch(() => false)) {
    return true;
  }

  // 2) Click associated label / parent text via Playwright
  if (programHint) {
    const byText = page
      .getByText(new RegExp(programHint.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'))
      .first();
    if ((await byText.count()) > 0) {
      await byText.click({ force: true }).catch(() => undefined);
      if (await target.isChecked().catch(() => false)) {
        return true;
      }
    }
  }

  // 3) evaluate: label.click() only (no manual checked=true)
  const clicked = await page.evaluate((hint) => {
    const list = [
      ...document.querySelectorAll('input[type="radio"][name="projectTypeId"]'),
    ] as HTMLInputElement[];
    if (list.length === 0) {
      return false;
    }

    const labelOf = (radio: HTMLInputElement) =>
      (
        radio.closest('label')?.textContent ??
        radio.closest('.el-radio')?.textContent ??
        radio.parentElement?.textContent ??
        ''
      ).trim();

    let targetRadio = hint
      ? list.find((radio) =>
          labelOf(radio).toLowerCase().includes(hint.toLowerCase()),
        )
      : undefined;
    targetRadio ??=
      list.find((radio) => radio.value && radio.value !== '0') ?? list[0];

    if (!targetRadio) {
      return false;
    }

    const elLabel = targetRadio
      .closest('.el-radio')
      ?.querySelector('.el-radio__label') as HTMLElement | null;
    elLabel?.click();
    if (targetRadio.checked) {
      return true;
    }

    targetRadio.closest('label')?.click();
    if (targetRadio.checked) {
      return true;
    }

    if (targetRadio.id) {
      document
        .querySelector(`label[for="${CSS.escape(targetRadio.id)}"]`)
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }

    return targetRadio.checked;
  }, programHint ?? null);

  if (clicked || (await target.isChecked().catch(() => false))) {
    return true;
  }

  // 4) Last resort: set checked without click events, verify immediately
  await page.evaluate((selectedValue) => {
    for (const radio of document.querySelectorAll(
      'input[name="projectTypeId"]',
    ) as NodeListOf<HTMLInputElement>) {
      radio.checked = radio.value === selectedValue;
    }
  }, value);

  return target.isChecked().catch(() => false);
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

async function setHiddenSelectByName(
  page: Page,
  name: string,
  optionIndex = 1,
): Promise<string | null> {
  return page.evaluate(
    ({ fieldName, index }) => {
      const sel = document.querySelector(
        `select[name="${fieldName}"]`,
      ) as HTMLSelectElement | null;
      if (!sel || sel.options.length <= index) {
        return null;
      }

      const option = sel.options[index];
      if (!option?.value) {
        return null;
      }

      sel.value = option.value;

      const jq = (window as unknown as { jQuery?: (el: Element) => {
        val: (v: string) => { trigger: (e: string) => unknown };
      } }).jQuery;

      if (typeof jq === 'function') {
        try {
          jq(sel).val(option.value).trigger('chosen:updated');
          jq(sel).val(option.value).trigger('change');
        } catch {
          // fall through to native events
        }
      }

      sel.dispatchEvent(new Event('input', { bubbles: true }));
      sel.dispatchEvent(new Event('change', { bubbles: true }));

      // 17gz cascade: college → major
      const stepCollege = (
        window as unknown as {
          stepCollegeOnChange?: (
            form: HTMLFormElement,
            major: HTMLSelectElement | null,
          ) => void;
        }
      ).stepCollegeOnChange;
      if (fieldName === 'collegeId' && typeof stepCollege === 'function' && sel.form) {
        stepCollege(
          sel.form,
          sel.form.querySelector(
            'select[name="majorId"]',
          ) as HTMLSelectElement | null,
        );
      }

      const onchangeAttr = sel.getAttribute('onchange');
      if (onchangeAttr && fieldName !== 'collegeId') {
        try {
          const run = new Function('event', onchangeAttr);
          run.call(sel, new Event('change', { bubbles: true }));
        } catch {
          // ignore broken inline handlers
        }
      }

      return option.value;
    },
    { fieldName: name, index: optionIndex },
  );
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

  // chosen-select hides the native <select> — Playwright selectOption times out.
  await setHiddenSelectByName(page, 'collegeId', 1);

  await page.waitForTimeout(1500);
  await page
    .waitForFunction(() => {
      const major = document.querySelector(
        'select[name="majorId"]',
      ) as HTMLSelectElement | null;
      return Boolean(major && major.options.length > 1);
    }, { timeout: 15_000 })
    .catch(() => undefined);

  await setHiddenSelectByName(page, 'majorId', 1);
  await setHiddenSelectByName(page, 'teachLanguage', 1);
  await page.waitForTimeout(500);
}

async function isProgramSelectionEmpty(page: Page): Promise<boolean> {
  return page.evaluate(() => /Total:\s*0/i.test(document.body?.innerText ?? ''));
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
      await checkAgree(page);
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
  programHint?: string,
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
    // HARD GUARD: never call saveProjectType without a checked radio —
    // empty submit leaves a stuck "请求正在处理中..." overlay.
    const checked = page.locator('input[name="projectTypeId"]:checked').first();
    if ((await checked.count()) === 0) {
      return null;
    }

    const checkedValue = await checked.getAttribute('value');

    return page.evaluate((selectedValue) => {
      const selected = document.querySelector(
        'input[name="projectTypeId"]:checked',
      ) as HTMLInputElement | null;

      if (!selected || selected.value !== selectedValue) {
        return null;
      }

      const form =
        selected.form ??
        (document.querySelector('form') as HTMLFormElement | null);
      const save = (
        window as unknown as {
          saveProjectType?: (form: HTMLFormElement) => void;
        }
      ).saveProjectType;

      if (typeof save === 'function' && form) {
        save(form);
        return `saveProjectType:${selected.value}`;
      }

      const btn = document.querySelector(
        'input[value="Next"]',
      ) as HTMLInputElement | null;
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
    }, checkedValue);
  }

  if (screen === 'program_selection') {
    if (await isProgramSelectionEmpty(page)) {
      return 'empty_list';
    }

    const row = await selectStudyPlanRow(page);
    if (row) {
      return row;
    }

    // College/major Chosen selects + Next (no study-plan table yet)
    return invokeButton(page, ['Next', 'Save and Next']);
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

  if (current === 'program_type') {
    const selected = await page
      .locator('input[name="projectTypeId"]:checked')
      .count();
    if (selected === 0) {
      return false;
    }
  }

  const clicked = await clickPreWizardNext(page, current, programHint);
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

export async function clearStuckProcessing(page: Page): Promise<boolean> {
  const stuck = await page.evaluate(() =>
    /请求正在处理中|please wait|processing your request/i.test(
      document.body?.innerText ?? '',
    ),
  );

  if (!stuck) {
    return false;
  }

  await dismissBlockingDialogs(page);
  await page.waitForTimeout(2_000);

  const stillStuck = await page.evaluate(() =>
    /请求正在处理中|please wait|processing your request/i.test(
      document.body?.innerText ?? '',
    ),
  );

  if (!stillStuck) {
    return true;
  }

  // Frozen overlay from a previous attempt — hard refresh.
  await page.reload({ waitUntil: 'networkidle', timeout: 60_000 }).catch(() => undefined);
  await waitForUiReady(page);
  return true;
}

export async function advanceThroughPreWizard(
  page: Page,
  programHint?: string,
  { maxSteps = 10 } = {},
): Promise<boolean> {
  await clearStuckProcessing(page);

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

    const inputs = [
      ...document.querySelectorAll('input[name="projectTypeId"]'),
    ] as HTMLInputElement[];
    const checked = inputs.find((input) => input.checked);
    const inputDump = inputs
      .map(
        (input) =>
          `type=${input.type};value=${input.value};checked=${input.checked};display=${getComputedStyle(input).display}`,
      )
      .join(' | ');
    const hasSave =
      typeof (window as unknown as { saveProjectType?: unknown }).saveProjectType ===
      'function';
    const next = document.querySelector('input[value="Next"]');
    const form = document.querySelector('form');
    const body = (document.body?.innerText ?? '')
      .replace(/\s+/g, ' ')
      .slice(0, 240);

    const lastName = document.querySelector(
      'input[name="apply.lastName"]',
    ) as HTMLInputElement | null;

    return [
      `screen=${screen}`,
      `radios=${inputs.length}`,
      `checked=${checked ? checked.value : 'none'}`,
      `inputs=[${inputDump}]`,
      `saveProjectType=${hasSave}`,
      `next=${Boolean(next)}`,
      `form=${Boolean(form)}`,
      `step1Visible=${Boolean(lastName && lastName.offsetParent !== null)}`,
      `body="${body}"`,
    ].join('; ');
  });
}
