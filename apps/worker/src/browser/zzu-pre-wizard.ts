import type { Page } from 'playwright';

export type PreWizardScreen =
  | 'application_notes'
  | 'program_type'
  | 'student_type'
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
  if ((await page.locator('select[name="collegeId"]').count()) > 0) {
    return 'program_selection';
  }

  const bodyText = await page.locator('body').innerText().catch(() => '');

  // KMMC: 请选择招生类别 (= "please choose your type") — NOT 类型, it's 类别!
  // Same name=projectTypeId as program screen, so body text must win.
  if (
    /please choose your type\s*:/i.test(bodyText) ||
    /请选择招生类别|请选择.*类别|请选择学生|报考类别/.test(bodyText)
  ) {
    return 'student_type';
  }

  if (
    /please choose your program/i.test(bodyText) ||
    /请选择.*项目|请选择培养项目|请选择招生项目/.test(bodyText)
  ) {
    return 'program_type';
  }

  // Scholarship program radios (visible) — typically 2–3 options
  const programRadios = page.locator(
    'input[type="radio"][name="projectTypeId"]',
  );
  const programCount = await programRadios.count();
  let visibleProgram = 0;
  for (let i = 0; i < programCount; i += 1) {
    if (await programRadios.nth(i).isVisible().catch(() => false)) {
      visibleProgram += 1;
    }
  }
  // Student-type screen also reuses projectTypeId with ~7 options
  if (visibleProgram >= 5) {
    return 'student_type';
  }
  if (visibleProgram > 0) {
    return 'program_type';
  }

  // Visible non-projectType radios → student category
  const anyRadios = page.locator('input[type="radio"]');
  const anyCount = await anyRadios.count();
  for (let i = 0; i < anyCount; i += 1) {
    const radio = anyRadios.nth(i);
    if (!(await radio.isVisible().catch(() => false))) {
      continue;
    }
    const name = await radio.getAttribute('name').catch(() => null);
    if (name !== 'projectTypeId') {
      return 'student_type';
    }
  }

  if (
    /application notes|application instructions|申请须知|申请人保证/i.test(
      bodyText,
    )
  ) {
    return 'application_notes';
  }

  return null;
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
  // KMMC Apply links are often below the fold — isVisible() falsely fails.
  await page.evaluate(() => {
    const table =
      document.querySelector('table.datagrid-btable, .datagrid-view table, table') ??
      null;
    table?.scrollIntoView({ block: 'start' });
  });
  await page.waitForTimeout(300);

  const applyLink = page
    .locator('td a, table a, a')
    .filter({ hasText: /^(Apply|申请|选择|Select)$/i })
    .first();

  if ((await applyLink.count()) > 0) {
    await applyLink.scrollIntoViewIfNeeded().catch(() => undefined);
    await applyLink.click({ force: true });
    return 'Apply';
  }

  return page.evaluate(() => {
    const labelOf = (el: Element) =>
      ((el as HTMLInputElement).value || el.textContent || '')
        .replace(/\s+/g, ' ')
        .trim();

    const link = [
      ...document.querySelectorAll('a, input[type="button"], input[type="submit"]'),
    ].find((el) =>
      /^(Apply|申请|选择|Select)$/i.test(labelOf(el)),
    ) as HTMLElement | null;

    if (!link) {
      // href-based fallback (no visible text / icon-only)
      const byHref = [
        ...document.querySelectorAll('a[href*="apply"], a[onclick*="StudyPlan"], a[onclick*="choose"]'),
      ].find((el) => {
        const style = getComputedStyle(el as HTMLElement);
        return style.display !== 'none' && style.visibility !== 'hidden';
      }) as HTMLElement | null;
      if (!byHref) {
        return null;
      }
      const onclick = byHref.getAttribute('onclick');
      if (onclick) {
        const run = new Function('el', onclick.replace(/\bthis\b/g, 'el'));
        run(byHref);
        return `Apply:onclick`;
      }
      byHref.click();
      return 'Apply:href';
    }

    const onclick = link.getAttribute('onclick');
    if (onclick) {
      const run = new Function('el', onclick.replace(/\bthis\b/g, 'el'));
      run(link);
      return `Apply:${onclick.slice(0, 40)}`;
    }

    link.click();
    return `Apply:${labelOf(link)}`;
  });
}

const STUDENT_TYPE_HINTS = [
  'Undergraduate Student',
  '本科生',
  '本科',
  'undergraduate',
  'bachelor',
];

/**
 * Student-type: each radio wrapped in <label>, onclick on input.
 * Probe: label.click / radio.click / checked=true all stick.
 * Prefer Playwright text click (same as program_type success path).
 */
async function pickStudentTypeRadio(page: Page): Promise<boolean> {
  for (const hint of STUDENT_TYPE_HINTS) {
    const byText = page.getByText(hint, { exact: false }).first();
    try {
      if (
        (await byText.count()) > 0 &&
        (await byText.isVisible().catch(() => false))
      ) {
        await byText.click({ force: true });
        const checked = await page.locator('input[type="radio"]:checked').count();
        if (checked > 0) {
          return true;
        }
      }
    } catch {
      /* try next hint / fallback */
    }
  }

  // Visible label wrapping the preferred radio
  const labels = page.locator('label:has(input[type="radio"][name="projectTypeId"])');
  const labelCount = await labels.count();
  for (const prefer of [true, false]) {
    for (let i = 0; i < labelCount; i += 1) {
      const label = labels.nth(i);
      if (!(await label.isVisible().catch(() => false))) {
        continue;
      }
      const text = ((await label.innerText().catch(() => '')) || '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
      const isPreferred = STUDENT_TYPE_HINTS.some((hint) =>
        text.includes(hint.toLowerCase()),
      );
      if (prefer && !isPreferred) {
        continue;
      }
      if (!prefer && isPreferred) {
        continue;
      }

      await label.click({ force: true });
      if ((await page.locator('input[type="radio"]:checked').count()) > 0) {
        return true;
      }
    }
  }

  // evaluate: label.click only (proven in headed probe)
  return page.evaluate((hints) => {
    const normalize = (value: string) => value.replace(/\s+/g, ' ').trim();
    const radios = [
      ...document.querySelectorAll(
        'input[type="radio"][name="projectTypeId"]',
      ),
    ] as HTMLInputElement[];

    const labelOf = (radio: HTMLInputElement) =>
      normalize(radio.closest('label')?.textContent ?? '');

    const target =
      radios.find((radio) => {
        const label = labelOf(radio).toLowerCase();
        return hints.some((hint) => label.includes(String(hint).toLowerCase()));
      }) ?? radios[0];

    if (!target) {
      return false;
    }

    target.closest('label')?.click();
    if (target.checked) {
      return true;
    }

    target.click();
    if (target.checked) {
      return true;
    }

    // force without extra click (radio groups don't toggle-off on re-click,
    // but keep this path click-free anyway)
    for (const radio of radios) {
      radio.checked = radio === target;
    }
    target.dispatchEvent(new Event('change', { bubbles: true }));
    // Fire native onclick if present (saveProjectType validation may depend on it)
    const onclick = target.getAttribute('onclick');
    if (onclick) {
      try {
        const run = new Function('event', onclick);
        run.call(target, new Event('click'));
      } catch {
        /* ignore */
      }
    }
    return target.checked;
  }, STUDENT_TYPE_HINTS);
}

/** Next labels: EN "Next" / ZH "下一步". KMMC uses <button class="el-button">. */
const NEXT_NAME_RE = /^(Next|下一步|Save and Next|保存并下一步)$/i;

async function clickVisibleNext(page: Page): Promise<string | null> {
  // Student-type Next is input[value=Next] onclick=saveProjectType(this.form).
  // Program-type may be <button>Next</button>. Try both; prefer visible.
  const candidates = [
    page.locator('input[type="button"][value="Next"], input[type="button"][value="下一步"]'),
    page.locator('input[value="Next"], input[value="下一步"]'),
    page.getByRole('button', { name: NEXT_NAME_RE }),
    page.locator('button.el-button--primary').filter({ hasText: NEXT_NAME_RE }),
    page.locator('button').filter({ hasText: NEXT_NAME_RE }),
    page.locator('a.el-button').filter({ hasText: NEXT_NAME_RE }),
  ];

  for (const locator of candidates) {
    const btn = locator.first();
    if ((await btn.count()) === 0) {
      continue;
    }
    if (!(await btn.isVisible().catch(() => false))) {
      continue;
    }

    await btn.click({ force: true });
    return 'Next:button';
  }

  // DOM fallback — ZH/EN + primary el-button (Railway session often serves 中文 UI)
  return page.evaluate(() => {
    const normalize = (value: string) => value.replace(/\s+/g, ' ').trim();
    const nextRe = /^(Next|下一步|Save and Next|保存并下一步)$/i;
    const isShown = (el: HTMLElement) => {
      const style = getComputedStyle(el);
      return (
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        (el as HTMLButtonElement).offsetParent !== null
      );
    };

    const nodes = [
      ...document.querySelectorAll(
        'button, a.el-button, input[type="button"], input[type="submit"], .el-button',
      ),
    ] as HTMLElement[];

    const byLabel = nodes.find((el) => {
      if (!isShown(el) || (el as HTMLButtonElement).disabled) {
        return false;
      }
      const label = normalize(
        (el as HTMLInputElement).value ||
          el.getAttribute('aria-label') ||
          el.textContent ||
          '',
      );
      return nextRe.test(label);
    });

    if (byLabel) {
      byLabel.click();
      return `Next:dom:${normalize(byLabel.textContent || (byLabel as HTMLInputElement).value || '')}`;
    }

    const primary = nodes.find((el) => {
      if (!el.classList.contains('el-button--primary')) {
        return false;
      }
      if (!isShown(el) || (el as HTMLButtonElement).disabled) {
        return false;
      }
      const label = normalize(el.textContent || '');
      return label.length > 0 && !/search|login|查询|登录|搜/i.test(label);
    });

    if (primary) {
      primary.click();
      return `Next:primary:${normalize(primary.textContent || '')}`;
    }

    return null;
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
    case 'student_type':
      await pickStudentTypeRadio(page);
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
 * After radio select, click visible Next button.
 * Do NOT prefer window.saveProjectType — on KMMC it leaves stuck "请求正在处理中" overlay.
 * Next is an Element-UI <button>, not input[value="Next"].
 */
async function clickPreWizardNext(
  page: Page,
  screen: PreWizardScreen,
  _programHint?: string,
): Promise<string | null> {
  if (screen === 'application_notes') {
    const agreeButton = page
      .getByRole('button', {
        name: /agree and continue|同意并继续|同意/i,
      })
      .first();
    if ((await agreeButton.count()) > 0) {
      await page
        .waitForFunction(() => {
          const buttons = [...document.querySelectorAll('button')];
          const agree = buttons.find((button) =>
            /agree and continue|同意并继续|同意/i.test(
              button.textContent ?? '',
            ),
          );
          return Boolean(agree && !(agree as HTMLButtonElement).disabled);
        }, { timeout: 10_000 })
        .catch(() => undefined);

      await agreeButton.click({ force: true });
      return 'Agree and Continue';
    }

    return invokeButton(page, [
      'Agree and Continue',
      'Agree',
      '同意并继续',
      '同意',
    ]);
  }

  if (screen === 'program_type' || screen === 'student_type') {
    if (screen === 'program_type') {
      const checked = page.locator('input[name="projectTypeId"]:checked').first();
      if ((await checked.count()) === 0) {
        return null;
      }
    } else {
      const anyChecked = page.locator('input[type="radio"]:checked').first();
      if ((await anyChecked.count()) === 0) {
        return null;
      }
    }

    const nextClicked = await clickVisibleNext(page);
    if (nextClicked) {
      return nextClicked;
    }

    // input[value=Next] often present on student_type even when <button> isn't
    const invoked = await invokeButton(page, [
      'Next',
      '下一步',
      'Save and Next',
      '保存并下一步',
    ]);
    if (invoked) {
      return invoked;
    }

    // saveProjectType is ONLY for scholarship/program screen — never student_type
    if (screen !== 'program_type') {
      return null;
    }

    return page.evaluate(() => {
      const selected = document.querySelector(
        'input[name="projectTypeId"]:checked',
      ) as HTMLInputElement | null;
      if (!selected) {
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
      return null;
    });
  }

  if (screen === 'program_selection') {
    if (await isProgramSelectionEmpty(page)) {
      return 'empty_list';
    }

    const row = await selectStudyPlanRow(page);
    if (row) {
      return row;
    }

    return (
      (await clickVisibleNext(page)) ??
      invokeButton(page, ['Next', '下一步', 'Save and Next', '保存并下一步'])
    );
  }

  return (
    (await clickVisibleNext(page)) ??
    invokeButton(page, ['Next', '下一步'])
  );
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

  if (current === 'student_type') {
    const selected = await page.locator('input[type="radio"]:checked').count();
    if (selected === 0) {
      return false;
    }
  }

  const clicked = await clickPreWizardNext(page, current, programHint);
  if (!clicked || clicked === 'empty_list') {
    return false;
  }

  // networkidle on 17gz can hang forever (polling) — keep short
  await page
    .waitForLoadState('domcontentloaded', { timeout: 10_000 })
    .catch(() => undefined);
  await page.waitForTimeout(600);

  for (let attempt = 0; attempt < 6; attempt += 1) {
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

    await page.waitForTimeout(350);
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
  { maxSteps = 6 } = {},
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
    const normalize = (value: string) => value.replace(/\s+/g, ' ').trim();
    const nextRe = /^(Next|下一步|Save and Next|保存并下一步)$/i;
    const bodyRaw = document.body?.innerText ?? '';
    const body = normalize(bodyRaw).slice(0, 240);

    const screen = (() => {
      if (document.querySelector('select[name="collegeId"]')) {
        return 'program_selection';
      }
      if (
        /请选择招生类别|please choose your type/i.test(bodyRaw)
      ) {
        return 'student_type';
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
      ...document.querySelectorAll('input[type="radio"]'),
    ] as HTMLInputElement[];
    const checked = inputs.find((input) => input.checked);
    const inputDump = inputs
      .slice(0, 10)
      .map(
        (input) =>
          `name=${input.name};value=${input.value};checked=${input.checked};display=${getComputedStyle(input).display}`,
      )
      .join(' | ');
    const hasSave =
      typeof (window as unknown as { saveProjectType?: unknown }).saveProjectType ===
      'function';
    const nextInput = document.querySelector(
      'input[value="Next"], input[value="下一步"]',
    ) as HTMLInputElement | null;
    const buttons = [...document.querySelectorAll('button, a.el-button')].map(
      (button) => normalize(button.textContent ?? ''),
    );
    const nextButton = buttons.find((text) => nextRe.test(text));
    const form = document.querySelector('form');

    const lastName = document.querySelector(
      'input[name="apply.lastName"]',
    ) as HTMLInputElement | null;

    return [
      `screen=${screen}`,
      `radios=${inputs.length}`,
      `checked=${checked ? `${checked.name}:${checked.value}` : 'none'}`,
      `inputs=[${inputDump}]`,
      `saveProjectType=${hasSave}`,
      `nextInput=${Boolean(nextInput)}`,
      `nextButton=${Boolean(nextButton)}`,
      `buttons=[${buttons.filter(Boolean).slice(0, 12).join(' | ')}]`,
      `form=${Boolean(form)}`,
      `step1Visible=${Boolean(lastName && lastName.offsetParent !== null)}`,
      `body="${body}"`,
    ].join('; ');
  });
}
