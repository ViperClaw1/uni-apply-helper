import type { Page } from 'playwright';

export type PreWizardScreen =
  | 'application_notes'
  | 'program_type'
  | 'student_type'
  | 'program_selection';

/** Split hints so desiredField doesn't steal program-type matching. */
export type PreWizardHints = {
  /** Scholarship / program-type radio, e.g. "Self-sponsored" / "Research Scholar" */
  programText?: string;
  /** Degree/student-type radio, e.g. "Undergraduate Student" */
  studentType?: string;
  /** Study-plan row match (desiredField / major) */
  studyPlanHint?: string;
};

export type StudyPlanMatcher = {
  isAvailable: () => boolean;
  generateJson: <T>(options: {
    prompt: string;
    temperature?: number;
  }) => Promise<T>;
};

function normalizeHints(
  hints?: string | PreWizardHints,
): PreWizardHints {
  if (!hints) {
    return {};
  }
  if (typeof hints === 'string') {
    const value = hints.trim();
    return value
      ? { programText: value, studyPlanHint: value }
      : {};
  }
  return hints;
}

export async function waitForUiReady(page: Page): Promise<void> {
  // Never Ok-click an in-flight processing dialog — wait it out / force-hide later.
  await dismissBlockingDialogs(page);

  await page
    .waitForFunction(() => {
      const wins = [
        ...document.querySelectorAll(
          '.messager-window, .panel.window, .window-mask, .datagrid-mask, .el-loading-mask',
        ),
      ];
      const visibleProcessing = wins.some((win) => {
        const style = getComputedStyle(win as HTMLElement);
        if (style.display === 'none' || style.visibility === 'hidden') {
          return false;
        }
        const rect = (win as HTMLElement).getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) {
          return false;
        }
        return /It'?s processing|请求正在处理中|please wait|processing your request/i.test(
          win.textContent || '',
        );
      });
      return !visibleProcessing;
    }, { timeout: 12_000 })
    .catch(() => undefined);

  await page.waitForTimeout(150);
}

export async function dismissBlockingDialogs(page: Page): Promise<void> {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const isProcessing = await page
      .evaluate(() => {
        const wins = [
          ...document.querySelectorAll(
            '.messager-window, .panel.window, .window-mask',
          ),
        ];
        return wins.some((win) => {
          const style = getComputedStyle(win as HTMLElement);
          if (style.display === 'none' || style.visibility === 'hidden') {
            return false;
          }
          const rect = (win as HTMLElement).getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) {
            return false;
          }
          return /It'?s processing|请求正在处理中|please wait|processing your request/i.test(
            win.textContent || '',
          );
        });
      })
      .catch(() => false);

    // Don't click Ok on "It's processing!" — it never clears and we thrash.
    if (isProcessing) {
      break;
    }

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
    await page.waitForTimeout(300);
  }

  // Force-hide ONLY if a processing overlay is still visibly stuck.
  await page
    .evaluate(() => {
      const wins = [
        ...document.querySelectorAll(
          '.window-mask, .datagrid-mask, .messager-window, .panel.window, .window-shadow, .el-loading-mask',
        ),
      ];
      const stuck = wins.some((win) => {
        const style = getComputedStyle(win as HTMLElement);
        if (style.display === 'none' || style.visibility === 'hidden') {
          return false;
        }
        const rect = (win as HTMLElement).getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) {
          return false;
        }
        return /It'?s processing|请求正在处理中|please wait|processing your request/i.test(
          win.textContent || '',
        );
      });
      if (!stuck) {
        return;
      }
      for (const el of wins) {
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

    // CSU/17gz: onclick="projectTypeOnClick22(this,arguments[0])"
    const evt = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      view: window,
    });
    targetRadio.checked = true;
    const raw = targetRadio.getAttribute('onclick') || '';
    const match = raw.match(/^(projectTypeOnClick\w*)\s*\(/);
    const fnName = match?.[1];
    const fn = fnName
      ? (window as unknown as Record<string, unknown>)[fnName]
      : undefined;
    if (typeof fn === 'function') {
      try {
        (fn as (el: HTMLInputElement, e: Event) => void)(targetRadio, evt);
      } catch {
        /* ignore */
      }
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
      // index 0 is often "Please choose" with empty value — still valid to clear filters
      if (!option || (index > 0 && !option.value)) {
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

/** Reset query filters to blank / "Please choose" (index 0). */
async function clearStudyPlanFilters(page: Page): Promise<void> {
  for (const name of ['collegeId', 'majorId', 'teachLanguage'] as const) {
    await setHiddenSelectByName(page, name, 0);
  }

  await page
    .locator('input[name="researchArea"], input[name="research"], input[name*="research" i]')
    .first()
    .fill('')
    .catch(() => undefined);
}

async function clickStudyPlanFind(page: Page): Promise<boolean> {
  const find = page
    .locator(
      [
        'input[type="button"][value="Find"]',
        'input[type="submit"][value="Find"]',
        'input[value="查询"]',
        'button:has-text("Find")',
        'button:has-text("查询")',
        'a:has-text("Find")',
      ].join(', '),
    )
    .first();

  if ((await find.count()) === 0) {
    return false;
  }
  if (!(await find.isVisible().catch(() => false))) {
    return false;
  }

  await find.click({ force: true });
  await page.waitForTimeout(1200);
  await waitForUiReady(page);
  return true;
}

/**
 * Study-plan query: NEVER guess Department/Major/Language.
 * Blind index=1 picks (e.g. Metallurgy + English) wipe CSU's Chinese list → Total:0.
 * Keep the default unfiltered list; only clear+Find when already empty.
 */
async function fillProgramSelection(page: Page): Promise<void> {
  const rows = await collectStudyPlanRows(page);
  if (rows.length > 0 && !(await isProgramSelectionEmpty(page))) {
    return;
  }

  await clearStudyPlanFilters(page);
  await clickStudyPlanFind(page);
}

async function isProgramSelectionEmpty(page: Page): Promise<boolean> {
  return page.evaluate(() => /Total:\s*0/i.test(document.body?.innerText ?? ''));
}

async function expandStudyPlanPageSize(page: Page): Promise<void> {
  const changed = await page.evaluate(() => {
    const selects = [
      ...document.querySelectorAll('select'),
    ] as HTMLSelectElement[];
    const perPage = selects.find((sel) => {
      const opts = [...sel.options].map((o) => o.text.trim());
      const nearLabel =
        sel.closest('td, div, span, label')?.textContent?.toLowerCase() || '';
      return (
        /per\s*page|page\s*size|条/i.test(nearLabel) ||
        opts.includes('20') ||
        opts.includes('50') ||
        opts.includes('100')
      );
    });
    if (!perPage) {
      return false;
    }
    const preferred = ['100', '50', '30', '20'].find((v) =>
      [...perPage.options].some((o) => o.value === v || o.text.trim() === v),
    );
    if (!preferred || perPage.value === preferred) {
      return false;
    }
    perPage.value = preferred;
    perPage.dispatchEvent(new Event('change', { bubbles: true }));
    const jq = (
      window as unknown as {
        jQuery?: (el: Element) => {
          val: (v: string) => { trigger: (e: string) => unknown };
        };
      }
    ).jQuery;
    if (typeof jq === 'function') {
      try {
        jq(perPage).val(preferred).trigger('change');
      } catch {
        // ignore
      }
    }
    return true;
  });

  if (changed) {
    await page.waitForTimeout(1500);
  }
}

type StudyPlanRow = {
  index: number;
  text: string;
};

async function collectStudyPlanRows(page: Page): Promise<StudyPlanRow[]> {
  return page.evaluate(() => {
    const labelOf = (el: Element) =>
      ((el as HTMLInputElement).value || el.textContent || '')
        .replace(/\s+/g, ' ')
        .trim();

    const isApplyLink = (el: Element) => {
      const onclick = el.getAttribute('onclick') || '';
      const href = el.getAttribute('href') || '';
      return (
        /saveChoose|StudyPlan|ChooseProject|choose/i.test(onclick) ||
        /^(Apply|申请|选择|Select)$/i.test(labelOf(el)) ||
        /apply/i.test(href)
      );
    };

    const rows: StudyPlanRow[] = [];
    const trs = [...document.querySelectorAll('tr')];
    for (const tr of trs) {
      const link = [...tr.querySelectorAll('a, input[type="button"]')].find(
        isApplyLink,
      );
      if (!link) {
        continue;
      }
      const text = (tr.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 240);
      if (!text || /study plan name|department|application deadline/i.test(text)) {
        continue;
      }
      rows.push({ index: rows.length, text });
    }
    return rows;
  });
}

async function clickStudyPlanRowByIndex(
  page: Page,
  rowIndex: number,
): Promise<string | null> {
  return page.evaluate((index) => {
    const labelOf = (el: Element) =>
      ((el as HTMLInputElement).value || el.textContent || '')
        .replace(/\s+/g, ' ')
        .trim();

    const isApplyLink = (el: Element) => {
      const onclick = el.getAttribute('onclick') || '';
      const href = el.getAttribute('href') || '';
      return (
        /saveChoose|StudyPlan|ChooseProject|choose/i.test(onclick) ||
        /^(Apply|申请|选择|Select)$/i.test(labelOf(el)) ||
        /apply/i.test(href)
      );
    };

    const applyRows = [...document.querySelectorAll('tr')].filter((tr) =>
      [...tr.querySelectorAll('a, input[type="button"]')].some(isApplyLink),
    );

    const tr = applyRows[index];
    if (!tr) {
      return null;
    }

    const link = [...tr.querySelectorAll('a, input[type="button"]')].find(
      isApplyLink,
    ) as HTMLElement | undefined;
    if (!link) {
      return null;
    }

    link.scrollIntoView({ block: 'center', inline: 'nearest' });
    link.dispatchEvent(
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window,
      }),
    );
    const onclick = link.getAttribute('onclick') || '';
    return `Apply:row${index}:${onclick.slice(0, 48)}`;
  }, rowIndex);
}

function scoreStudyPlanRow(text: string, hint: string): number {
  const hay = text.toLowerCase();
  const needles = hint
    .toLowerCase()
    .split(/[\s,/|;]+/)
    .map((n) => n.trim())
    .filter((n) => n.length >= 3);

  let score = 0;
  for (const n of needles) {
    if (hay.includes(n)) {
      score += n.length >= 6 ? 3 : 2;
    }
  }
  if (hay.includes(hint.toLowerCase())) {
    score += 10;
  }
  return score;
}

async function selectStudyPlanRow(
  page: Page,
  programHint?: string,
  gemini?: StudyPlanMatcher,
): Promise<string | null> {
  const APPLY_LINK_SELECTOR = [
    'a[onclick*="saveChooseProjectBind"]',
    'a[onclick*="StudyPlan"]',
    'a[onclick*="choose"]',
    'a[onclick*="ChooseProject"]',
    'a[onclick*="saveChoose"]',
    'td a',
  ].join(', ');

  for (let attempt = 0; attempt < 4; attempt += 1) {
    await page
      .waitForSelector(APPLY_LINK_SELECTOR, {
        state: 'attached',
        timeout: 10_000,
      })
      .catch(() => undefined);
    await page.waitForTimeout(attempt === 0 ? 500 : 1200);

    if (attempt === 0) {
      await expandStudyPlanPageSize(page);
    }

    const rows = await collectStudyPlanRows(page);
    if (rows.length === 0) {
      continue;
    }

    let chosenIndex = 0;

    // Lexical match first (cheap)
    if (programHint?.trim()) {
      let bestScore = 0;
      let bestIndex = -1;
      for (const row of rows) {
        const score = scoreStudyPlanRow(row.text, programHint);
        if (score > bestScore) {
          bestScore = score;
          bestIndex = row.index;
        }
      }
      if (bestIndex >= 0 && bestScore > 0) {
        chosenIndex = bestIndex;
      } else if (gemini?.isAvailable()) {
        try {
          const result = await gemini.generateJson<{ rowIndex?: number }>({
            prompt: [
              'You pick the best matching university study-plan row for a student.',
              'Return ONLY JSON: {"rowIndex":<number>}. Use -1 if nothing is reasonably close.',
              `Student desired field / program hint: "${programHint}"`,
              'Available study plans (index: text):',
              ...rows.map((r) => `${r.index}: ${r.text}`),
            ].join('\n'),
            temperature: 0,
          });
          const idx = result.rowIndex;
          if (
            typeof idx === 'number' &&
            Number.isInteger(idx) &&
            idx >= 0 &&
            idx < rows.length
          ) {
            chosenIndex = idx;
          }
        } catch {
          // fall through to first row
        }
      }
    }

    const clicked = await clickStudyPlanRowByIndex(page, chosenIndex);
    if (clicked) {
      return clicked;
    }

    // Legacy first-Apply fallback
    const clickedLegacy = await page.evaluate(() => {
      const labelOf = (el: Element) =>
        ((el as HTMLInputElement).value || el.textContent || '')
          .replace(/\s+/g, ' ')
          .trim();

      const fireApplyClick = (link: HTMLElement): string => {
        link.scrollIntoView({ block: 'center', inline: 'nearest' });
        link.dispatchEvent(
          new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window,
          }),
        );
        const onclick = link.getAttribute('onclick') || '';
        return `Apply:dispatch:${onclick.slice(0, 48)}`;
      };

      const byText = [
        ...document.querySelectorAll(
          'a, input[type="button"], input[type="submit"]',
        ),
      ].find((el) =>
        /^(Apply|申请|选择|Select)$/i.test(labelOf(el)),
      ) as HTMLElement | undefined;

      if (byText) {
        return fireApplyClick(byText);
      }

      const byOnclick = [
        ...document.querySelectorAll(
          [
            'a[href*="apply"]',
            'a[onclick*="StudyPlan"]',
            'a[onclick*="choose"]',
            'a[onclick*="Choose"]',
            'a[onclick*="ChooseProject"]',
            'a[onclick*="saveChoose"]',
            'a[onclick*="ProjectBind"]',
            'a[onclick*="saveChooseProjectBind"]',
          ].join(', '),
        ),
      ].find((el) => {
        const style = getComputedStyle(el as HTMLElement);
        return style.display !== 'none' && style.visibility !== 'hidden';
      }) as HTMLElement | undefined;

      if (byOnclick) {
        return fireApplyClick(byOnclick);
      }

      return null;
    });

    if (clickedLegacy) {
      return clickedLegacy;
    }

    const applyLink = page
      .locator('td a, table a, a')
      .filter({ hasText: /^(Apply|申请|选择|Select)$/i })
      .first();

    if ((await applyLink.count()) > 0) {
      await applyLink.scrollIntoViewIfNeeded().catch(() => undefined);
      await applyLink.click({ force: true });
      return 'Apply:playwright';
    }
  }

  return null;
}

const DEFAULT_STUDENT_TYPE_HINTS = [
  'Undergraduate Student',
  '本科生',
  '本科',
  'undergraduate',
  'bachelor',
];

function studentTypeHintList(preferred?: string): string[] {
  const preferredHints = preferred?.trim()
    ? [preferred.trim()]
    : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const hint of [...preferredHints, ...DEFAULT_STUDENT_TYPE_HINTS]) {
    const key = hint.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(hint);
  }
  return out;
}

/** DOM-direct checked check — avoids Playwright :visible:checked race after click. */
async function waitForProjectTypeChecked(
  page: Page,
  timeoutMs = 5_000,
): Promise<boolean> {
  await page
    .waitForFunction(
      () =>
        Boolean(
          document.querySelector(
            'input[type="radio"][name="projectTypeId"]:checked',
          ),
        ),
      { timeout: timeoutMs },
    )
    .catch(() => undefined);

  return page.evaluate(
    () =>
      Boolean(
        document.querySelector(
          'input[type="radio"][name="projectTypeId"]:checked',
        ),
      ),
  );
}

/**
 * CSU student-type DOM (confirmed):
 *   <label><input type="radio" name="projectTypeId" onclick="projectTypeOnClick22(this,arguments[0])">Undergraduate Student</label>
 * Must fire projectTypeOnClick22 with a real event — bare checked=true doesn't stick.
 */
async function pickStudentTypeRadio(
  page: Page,
  studentType?: string,
): Promise<boolean> {
  await dismissBlockingDialogs(page);

  const hints = studentTypeHintList(studentType);
  const hint = hints[0] ?? 'Undergraduate Student';

  const visibleChecked = () => waitForProjectTypeChecked(page, 3_000);

  // 1) Click wrapping <label> that owns the radio (exact CSU structure)
  for (const textHint of hints) {
    const escaped = textHint.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const label = page
      .locator('label:has(input[type="radio"][name="projectTypeId"])')
      .filter({ hasText: new RegExp(escaped, 'i') })
      .first();
    if ((await label.count()) === 0) {
      continue;
    }
    await label.scrollIntoViewIfNeeded().catch(() => undefined);
    await label.click({ force: true });
    if (await visibleChecked()) {
      return true;
    }
    // CDP mouse on label center
    const box = await label.boundingBox().catch(() => null);
    if (box) {
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      if (await visibleChecked()) {
        return true;
      }
    }
  }

  // 2) Invoke projectTypeOnClick22(radio, event) explicitly — this is what CSU needs
  const forced = await page.evaluate((needle) => {
    const isVisible = (el: Element) => {
      const style = getComputedStyle(el as HTMLElement);
      if (style.display === 'none' || style.visibility === 'hidden') {
        return false;
      }
      const rect = (el as HTMLElement).getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };

    const radios = [
      ...document.querySelectorAll(
        'input[type="radio"][name="projectTypeId"]',
      ),
    ].filter(isVisible) as HTMLInputElement[];

    const labelOf = (radio: HTMLInputElement) =>
      (radio.closest('label')?.textContent ?? '').replace(/\s+/g, ' ').trim();

    const target =
      radios.find((radio) =>
        labelOf(radio).toLowerCase().includes(needle.toLowerCase()),
      ) ??
      radios.find((radio) =>
        /undergraduate|本科/i.test(labelOf(radio)),
      ) ??
      radios[2] ??
      radios[0];

    if (!target) {
      return { ok: false, reason: 'no-radio' };
    }

    const label = target.closest('label') as HTMLLabelElement | null;
    const evt = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      view: window,
    });

    // Prefer label click (same as user gesture path)
    label?.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true, view: window }),
    );
    if (target.checked) {
      return { ok: true, reason: 'label-dispatch' };
    }

    // Call 17gz handler directly with (this, event)
    const win = window as unknown as {
      projectTypeOnClick22?: (el: HTMLInputElement, e: Event) => void;
    };
    target.checked = true;
    if (typeof win.projectTypeOnClick22 === 'function') {
      try {
        win.projectTypeOnClick22(target, evt);
      } catch {
        /* ignore */
      }
    } else {
      // Fall back to inline onclick attribute
      const raw = target.getAttribute('onclick') || '';
      const match = raw.match(
        /^(projectTypeOnClick\w*)\s*\(\s*this\s*,\s*arguments\[0\]\s*\)\s*;?$/,
      );
      if (match?.[1]) {
        const fn = (window as unknown as Record<string, unknown>)[match[1]];
        if (typeof fn === 'function') {
          try {
            (fn as (el: HTMLInputElement, e: Event) => void)(target, evt);
          } catch {
            /* ignore */
          }
        }
      }
    }

    if (!target.checked) {
      target.checked = true;
      target.setAttribute('checked', 'checked');
    }

    return {
      ok: target.checked,
      reason: `onclick:${typeof win.projectTypeOnClick22}`,
      label: labelOf(target).slice(0, 80),
    };
  }, hint);

  if (forced.ok && (await visibleChecked())) {
    return true;
  }

  console.warn('[pickStudentTypeRadio] failed', forced);
  return visibleChecked();
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
  hints?: string | PreWizardHints,
): Promise<boolean> {
  const resolved = normalizeHints(hints);

  switch (screen) {
    case 'application_notes':
      await checkAgree(page);
      await pickProjectTypeRadio(page, resolved.programText);
      break;
    case 'program_type':
      await checkAgree(page);
      await pickProjectTypeRadio(page, resolved.programText);
      break;
    case 'student_type':
      await pickStudentTypeRadio(page, resolved.studentType);
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
  hints?: string | PreWizardHints,
  gemini?: StudyPlanMatcher,
): Promise<string | null> {
  const resolved = normalizeHints(hints);
  const studyPlanHint = resolved.studyPlanHint;
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
    // Race: Playwright :checked can lag behind DOM after label/onclick.
    if (!(await waitForProjectTypeChecked(page, 5_000))) {
      return null;
    }

    const nextClicked = await clickVisibleNext(page);
    if (nextClicked) {
      return nextClicked;
    }

    // input[value=Next] — CSU student_type / program_type
    const invoked = await invokeButton(page, [
      'Next',
      '下一步',
      'Save and Next',
      '保存并下一步',
    ]);
    if (invoked) {
      return invoked;
    }

    // CSU Next is often input[value=Next] onclick=saveProjectType(this.form)
    // for BOTH program_type and student_type.
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

      const next = document.querySelector(
        'input[type="button"][value="Next"], input[value="Next"], input[value="下一步"]',
      ) as HTMLInputElement | null;
      if (next) {
        next.click();
        return `Next:dom:${next.value}`;
      }
      return null;
    });
  }

  if (screen === 'program_selection') {
    if (await isProgramSelectionEmpty(page)) {
      return 'empty_list';
    }

    const row = await selectStudyPlanRow(page, studyPlanHint, gemini);
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
  hints?: string | PreWizardHints,
  gemini?: StudyPlanMatcher,
): Promise<boolean> {
  await waitForUiReady(page);
  await dismissBlockingDialogs(page);

  const current = screen ?? (await detectPreWizardScreen(page));
  if (!current) {
    return false;
  }

  const before = await getPreWizardSignature(page, current);
  await fillPreWizardScreen(page, current, hints);
  await page.waitForTimeout(200);

  // After fill (clear+Find if needed) — only then treat empty as hard fail.
  if (current === 'program_selection' && (await isProgramSelectionEmpty(page))) {
    return false;
  }

  if (current === 'program_type' || current === 'student_type') {
    // Wait for DOM checked — Playwright :visible:checked races after onclick.
    if (!(await waitForProjectTypeChecked(page, 5_000))) {
      return false;
    }
  }

  const clicked = await clickPreWizardNext(page, current, hints, gemini);
  if (!clicked || clicked === 'empty_list') {
    return false;
  }

  // networkidle on 17gz can hang forever (polling) — keep short
  await page
    .waitForLoadState('domcontentloaded', { timeout: 10_000 })
    .catch(() => undefined);
  await page.waitForTimeout(600);

  for (let attempt = 0; attempt < 4; attempt += 1) {
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

    await page.waitForTimeout(300);
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

  // Frozen overlay from a previous attempt — hard refresh (never networkidle on 17gz).
  await page
    .reload({ waitUntil: 'domcontentloaded', timeout: 30_000 })
    .catch(() => undefined);
  await waitForUiReady(page);
  return true;
}

export async function advanceThroughPreWizard(
  page: Page,
  hints?: string | PreWizardHints,
  {
    maxSteps = 10,
    deadlineMs = 90_000,
    gemini,
  }: {
    maxSteps?: number;
    /** Hard cap so open_form can't hang 10+ minutes / stall BullMQ into a duplicate step. */
    deadlineMs?: number;
    gemini?: StudyPlanMatcher;
  } = {},
): Promise<boolean> {
  const MAX_CONSECUTIVE_FAILS = 3;
  const MAX_SAME_SCREEN = 3;
  let consecutiveFails = 0;
  let sameScreenHits = 0;
  let lastScreen: PreWizardScreen | null = null;
  const deadline = Date.now() + deadlineMs;

  await clearStuckProcessing(page);

  for (let step = 0; step < maxSteps; step += 1) {
    if (Date.now() > deadline) {
      return isMainWizard(page);
    }

    if (await isMainWizard(page)) {
      return true;
    }

    const screen = await detectPreWizardScreen(page);
    if (!screen) {
      consecutiveFails += 1;
      if (consecutiveFails >= MAX_CONSECUTIVE_FAILS) {
        return false;
      }
      await page.waitForTimeout(800);
      continue;
    }

    if (screen === lastScreen) {
      sameScreenHits += 1;
      if (sameScreenHits >= MAX_SAME_SCREEN) {
        return false;
      }
    } else {
      lastScreen = screen;
      sameScreenHits = 0;
    }

    const advanced = await advancePreWizardScreen(
      page,
      screen,
      hints,
      gemini,
    );
    if (await isMainWizard(page)) {
      return true;
    }
    if (advanced) {
      consecutiveFails = 0;
      // Signature change on same screen (e.g. dialog flicker) must not loop forever.
      const after = await detectPreWizardScreen(page);
      if (after && after !== screen) {
        lastScreen = after;
        sameScreenHits = 0;
      }
      continue;
    }

    consecutiveFails += 1;
    if (consecutiveFails >= MAX_CONSECUTIVE_FAILS) {
      return false;
    }
    await page.waitForTimeout(800);
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
      .map((input) => {
        const parent = (
          input.closest('label') ?? input.parentElement
        )?.outerHTML?.replace(/\s+/g, ' ')
          .slice(0, 120);
        return (
          `name=${input.name};value=${input.value};checked=${input.checked};` +
          `disabled=${input.disabled};display=${getComputedStyle(input).display};` +
          `parent=${parent ?? ''}`
        );
      })
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
