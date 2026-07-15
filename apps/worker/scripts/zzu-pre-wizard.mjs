import { detectActiveWizardStep, dismissBlockingDialogs, waitForUiReady } from './wizard-step-utils.mjs';

export async function detectPreWizardScreen(page) {
  return page.evaluate(() => {
    if (document.querySelector('select[name="collegeId"]')) {
      return 'program_selection';
    }

    const bodyText = document.body.innerText;
    if (/application notes|application instructions/i.test(bodyText)) {
      return 'application_notes';
    }

    if (/please choose your program type|choose your type/i.test(bodyText)) {
      return 'program_type';
    }

    if (document.querySelector('[name="projectTypeId"]')) {
      return 'program_type';
    }

    return null;
  });
}

export async function isMainWizard(page) {
  const active = await detectActiveWizardStep(page);
  if (active?.number) {
    return true;
  }

  if ((await page.locator('form[action*="saveBase"], [name="apply.lastName"]').count()) > 0) {
    return true;
  }

  return false;
}

export async function getPreWizardSignature(page, screen) {
  const names = await page.evaluate(() =>
    [...document.querySelectorAll('input[name], select[name], textarea[name]')]
      .filter((el) => {
        const type = el.type?.toLowerCase?.() ?? '';
        return type !== 'hidden' && type !== 'button' && type !== 'submit';
      })
      .map((el) => el.name)
      .filter(Boolean)
      .sort()
      .slice(0, 8)
      .join('|'),
  );

  return `pre:${screen ?? 'unknown'}:${names}`;
}

async function pickFirstRadio(page, name) {
  await page.evaluate((fieldName) => {
    const radio = [...document.querySelectorAll(`input[type="radio"][name="${fieldName}"]`)].find(
      (el) => el.value && el.value !== '0',
    );
    if (!radio) {
      return;
    }

    const onclick = radio.getAttribute('onclick');
    const fnName = onclick?.match(/^([\w$]+)\(/)?.[1];
    if (fnName && typeof window[fnName] === 'function') {
      window[fnName](radio, new MouseEvent('click'));
      if (radio.checked) {
        return;
      }
    }

    const elRadioLabel = radio.closest('.el-radio')?.querySelector('.el-radio__label');
    if (elRadioLabel) {
      elRadioLabel.click();
      if (radio.checked) {
        return;
      }
    }

    radio.closest('label')?.click();
    if (!radio.checked) {
      radio.checked = true;
      radio.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }, name);

  await page.waitForTimeout(400);
}

async function checkAgree(page) {
  const agree = page.locator('[name="agree"]');
  if ((await agree.count()) === 0) {
    return;
  }

  const checked = await agree.isChecked().catch(() => false);
  if (!checked) {
    await agree.click({ force: true }).catch(() => undefined);
  }
}

async function fillProgramSelection(page) {
  const hasNativeOptions = await page.evaluate(() => {
    const college = document.querySelector('select[name="collegeId"]');
    return Boolean(college && college.options.length > 1);
  });

  if (hasNativeOptions) {
    const college = page.locator('select[name="collegeId"]');
    const collegeValue = await college.locator('option:nth-child(2)').getAttribute('value');
    if (collegeValue) {
      await college.selectOption(collegeValue);
    }

    await page.waitForTimeout(1500);
    await page
      .waitForFunction(
        () => {
          const major = document.querySelector('select[name="majorId"]');
          return major && major.options.length > 1;
        },
        { timeout: 15_000 },
      )
      .catch(() => undefined);

    const major = page.locator('select[name="majorId"]');
    if ((await major.count()) > 0 && (await major.locator('option').count()) > 1) {
      const majorValue = await major.locator('option:nth-child(2)').getAttribute('value');
      if (majorValue) {
        await major.selectOption(majorValue);
      }
    }

    const language = page.locator('select[name="teachLanguage"]');
    if ((await language.count()) > 0 && (await language.locator('option').count()) > 1) {
      const langValue = await language.locator('option:nth-child(2)').getAttribute('value');
      if (langValue) {
        await language.selectOption(langValue);
      }
    }

    await page.waitForTimeout(500);
  }
}

export async function isProgramSelectionEmpty(page) {
  return page.evaluate(() => /Total:\s*0/i.test(document.body.innerText));
}

async function selectStudyPlanRow(page) {
  return page.evaluate(() => {
    const rowLink = document.querySelector(
      'td.operation a, td:last-child a[onclick], a[onclick*="chooseStudyPlan"], a[onclick*="selectStudyPlan"], a[onclick*="chooseProject"]',
    );

    if (!rowLink) {
      return null;
    }

    const onclick = rowLink.getAttribute('onclick');
    if (onclick) {
      // eslint-disable-next-line no-new-func
      const run = new Function('el', onclick.replace(/\bthis\b/g, 'el'));
      run(rowLink);
      return onclick;
    }

    rowLink.click();
    return rowLink.textContent?.trim() ?? 'click';
  });
}

export async function fillPreWizardScreen(page, screen = null) {
  const current = screen ?? (await detectPreWizardScreen(page));
  if (!current) {
    return false;
  }

  switch (current) {
    case 'application_notes':
      await checkAgree(page);
      await pickFirstRadio(page, 'projectTypeId');
      break;
    case 'program_type':
      await pickFirstRadio(page, 'projectTypeId');
      break;
    case 'program_selection':
      await fillProgramSelection(page);
      break;
    default:
      break;
  }

  return true;
}

async function invokeButton(page, labels = ['Next']) {
  const playwrightNext = page.getByRole('button', { name: /^Next$/i }).first();
  if ((await playwrightNext.count()) > 0) {
    await playwrightNext.click({ force: true });
    return 'Next';
  }

  const inputNext = page.locator('input[type="button"][value="Next"], input[value="Next"]').first();
  if ((await inputNext.count()) > 0) {
    const onclick = await inputNext.getAttribute('onclick');
    if (onclick) {
      await inputNext.evaluate((btn, handler) => {
        const run = new Function('btn', handler.replace(/\bthis\b/g, 'btn'));
        run(btn);
      }, onclick);
      return 'Next';
    }

    await inputNext.click({ force: true });
    return 'Next';
  }

  return page.evaluate((buttonLabels) => {
    const matches = (el) => {
      if (el.tagName === 'INPUT') {
        return buttonLabels.some((label) => el.value?.trim() === label);
      }

      return buttonLabels.some((label) =>
        new RegExp(`^${label}$`, 'i').test(el.textContent?.trim() ?? ''),
      );
    };

    const btn = [
      ...document.querySelectorAll('input[type="button"], input[type="submit"], button, a'),
    ].find(matches);

    if (!btn) {
      return null;
    }

    const onclick = btn.getAttribute('onclick');
    if (onclick) {
      // eslint-disable-next-line no-new-func
      const run = new Function('btn', onclick.replace(/\bthis\b/g, 'btn'));
      run(btn);
      return btn.value || btn.textContent?.trim();
    }

    btn.click();
    return btn.value || btn.textContent?.trim();
  }, labels);
}

async function clickPreWizardNext(page, screen) {
  if (screen === 'application_notes') {
    const agreeButton = page.getByRole('button', { name: /agree and continue/i }).first();
    if ((await agreeButton.count()) > 0) {
      await page
        .waitForFunction(() => {
          const buttons = [...document.querySelectorAll('button')];
          const agree = buttons.find((button) =>
            /agree and continue/i.test(button.textContent ?? ''),
          );
          return Boolean(agree && !agree.disabled);
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

      const btn = document.querySelector('input[value="Next"]');
      if (typeof saveProjectType === 'function' && btn?.form) {
        saveProjectType(btn.form);
        return 'saveProjectType';
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

export async function advancePreWizardScreen(page, screen = null) {
  await waitForUiReady(page);
  await dismissBlockingDialogs(page);

  const current = screen ?? (await detectPreWizardScreen(page));
  if (!current) {
    return false;
  }

  const before = await getPreWizardSignature(page, current);
  await fillPreWizardScreen(page, current);
  const clicked = await clickPreWizardNext(page, current);

  if (!clicked) {
    return false;
  }

  await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => undefined);

  for (let attempt = 0; attempt < 12; attempt += 1) {
    await waitForUiReady(page);

    if (await isMainWizard(page)) {
      return true;
    }

    const afterScreen = await detectPreWizardScreen(page);
    const after = await getPreWizardSignature(page, afterScreen ?? current);
    if (after !== before) {
      return true;
    }

    await dismissBlockingDialogs(page);
    await page.waitForTimeout(500);
  }

  return false;
}

export async function advanceThroughPreWizard(page, { maxSteps = 10 } = {}) {
  for (let step = 0; step < maxSteps; step += 1) {
    if (await isMainWizard(page)) {
      return true;
    }

    const screen = await detectPreWizardScreen(page);
    if (!screen) {
      return false;
    }

    const advanced = await advancePreWizardScreen(page, screen);
    if (!advanced) {
      return false;
    }
  }

  return isMainWizard(page);
}
