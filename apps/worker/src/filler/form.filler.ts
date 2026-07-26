import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { FieldConfig, StudentProfile, UniversitySchema } from '@uni-apply/shared';
import type { Locator, Page } from 'playwright';
import { resolveFillMode } from '../agent/agent.config.js';
import { FormAgent } from '../agent/form.agent.js';
import { SemanticFieldMapper } from '../agent/dom/semantic-field.mapper.js';
import { resolveFieldLocator } from './field.locator.js';
import { FieldMapper } from './field.mapper.js';
import { FileAttacher } from './file.attacher.js';
import { OcrPassportUploader } from './ocr-passport.uploader.js';
import { WizardFieldGroups } from './wizard-field-groups.js';
import { WizardNavigator } from './wizard.navigator.js';

@Injectable()
export class FormFiller {
  constructor(
    private readonly configService: ConfigService,
    private readonly fieldMapper: FieldMapper,
    private readonly fileAttacher: FileAttacher,
    private readonly ocrPassportUploader: OcrPassportUploader,
    private readonly wizardNavigator: WizardNavigator,
    private readonly wizardFieldGroups: WizardFieldGroups,
    private readonly semanticFieldMapper: SemanticFieldMapper,
    private readonly formAgent: FormAgent,
  ) {}
  async fillFields(
    page: Page,
    profile: StudentProfile,
    fields: FieldConfig[],
    motivationLetterContent?: string,
    university?: UniversitySchema,
  ): Promise<void> {
    const fillMode = university
      ? resolveFillMode(this.configService, university)
      : 'schema';

    await this.fillFieldBatch(
      page,
      profile,
      fields,
      motivationLetterContent,
      fillMode,
    );
  }

  async attachFiles(
    page: Page,
    profile: StudentProfile,
    fields: FieldConfig[],
  ): Promise<void> {
    await this.fileAttacher.attachFiles(page, profile, fields);
  }

  async submit(page: Page): Promise<void> {
    const submit = page
      .locator(
        [
          "button[type='submit']",
          "input[type='submit']",
          'button:has-text("Submit")',
          'button:has-text("Отправить")',
        ].join(', '),
      )
      .first();

    await Promise.all([
      page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => undefined),
      submit.click(),
    ]);
  }

  async processWizard(
    page: Page,
    profile: StudentProfile,
    university: UniversitySchema,
    motivationLetterContent?: string,
    applicationId?: string,
  ): Promise<void> {
    const fillMode = resolveFillMode(this.configService, university);

    if (fillMode === 'agent') {
      const result = await this.formAgent.runWizard(
        page,
        profile,
        university,
        motivationLetterContent,
      );

      if (!result.completed) {
        throw new Error(
          result.finalAction?.reason ??
            'Agent failed to complete the wizard form.',
        );
      }

      return;
    }

    const wizard = university.wizard;
    if (!wizard) {
      throw new Error(`University "${university.id}" has no wizard config`);
    }

    await this.waitForStepOneFields(page, university);

    await this.wizardNavigator.forEachStep(
      page,
      wizard,
      async (step) => {
        if (
          step === 1 &&
          (university.id === 'pku' ||
            university.navigationHints?.ocrPassportUpload)
        ) {
          await this.ocrPassportUploader.upload(page, profile);
        }

        const fields = this.wizardFieldGroups.fieldsForStep(university, step);
        await this.dismissFormOverlays(page);
        await this.fillFieldBatch(
          page,
          profile,
          fields.filter((field) => field.type !== 'file'),
          motivationLetterContent,
          fillMode,
        );

        if (step === 1) {
          await this.ensureChineseNameWaiver(page, profile);
          if (
            university.id === 'pku' ||
            university.navigationHints?.ocrPassportUpload
          ) {
            await this.ensurePkuStep1RequiredGaps(page);
          }
        }
        if (step === 2 && university.id === 'pku') {
          await this.ensurePkuStep2RequiredGaps(page, profile);
        }
        await this.dismissFormOverlays(page);

        // Photo already attached in OCR Step-1 hook — skip duplicate.
        const fileFields = fields.filter((field) => {
          if (field.type !== 'file') {
            return false;
          }
          if (
            step === 1 &&
            university.navigationHints?.ocrPassportUpload &&
            field.documentType === 'photo'
          ) {
            return false;
          }
          return true;
        });
        if (fileFields.length > 0) {
          await this.fileAttacher.attachFiles(page, profile, fileFields);
        }
      },
      {
        applicationId,
        markerForStep: (step) => {
          const fields = this.wizardFieldGroups.fieldsForStep(university, step);
          return (
            fields.find((field) => field.selector && field.type !== 'file')
              ?.selector ??
            fields.find((field) => field.selector)?.selector
          );
        },
      },
    );

    await this.wizardNavigator.clickSubmit(page, wizard.submitButtonSelector);
  }

  private async waitForStepOneFields(
    page: Page,
    university: UniversitySchema,
  ): Promise<void> {
    const stepOneSelectors = this.wizardFieldGroups
      .fieldsForStep(university, 1)
      .filter((field) => field.selector && field.type !== 'file')
      .slice(0, 3)
      .map((field) => field.selector);

    if (stepOneSelectors.length === 0) {
      return;
    }

    const selector = stepOneSelectors.join(', ');
    try {
      await page.waitForSelector(selector, {
        state: 'attached',
        timeout: 15_000,
      });
    } catch {
      throw new Error(
        `Step 1 form fields not found after navigation (${selector}). URL: ${page.url()}`,
      );
    }
  }

  private async fillFieldBatch(
    page: Page,
    profile: StudentProfile,
    fields: FieldConfig[],
    motivationLetterContent: string | undefined,
    fillMode: 'schema' | 'agent' | 'hybrid',
  ): Promise<void> {
    for (const field of fields) {
      await this.dismissFormOverlays(page);

      const value = this.fieldMapper.getValue(
        profile,
        field,
        motivationLetterContent,
      );

      if (value === undefined || value === null || value === '') {
        if (field.required && field.mapsTo) {
          throw new Error(`Missing required profile value: ${field.mapsTo}`);
        }

        if (field.required && !field.mapsTo) {
          throw new Error(
            `Missing required static value for ${field.selector}` +
              `${field.labelHint ? ` ("${field.labelHint}")` : ''}` +
              ' — set field.options[0] or mapsTo in university schema.',
          );
        }

        continue;
      }

      // PKU employer field: name varies / appears after Occupation — never let
      // hybrid semantic map it onto lastSchool (caused "studyingHigh school…" concat).
      if (this.isCareerNameField(field)) {
        const ok = await this.fillTextNearLabel(
          page,
          /Current Employer/i,
          String(value),
        );
        if (!ok && field.required) {
          throw new Error(
            `Field not found near label "Current Employer" (${field.selector})`,
          );
        }
        continue;
      }

      let locator = await resolveFieldLocator(page, field);

      if (!locator && fillMode === 'hybrid') {
        locator = await this.semanticFieldMapper.resolveLocator(
          page,
          field,
          profile,
          motivationLetterContent,
        );
      }

      // Required fields: wait briefly — step transition may lag after Next
      if (!locator && field.required && field.selector) {
        await page
          .waitForSelector(field.selector, {
            state: 'attached',
            timeout: 10_000,
          })
          .catch(() => undefined);
        locator = await resolveFieldLocator(page, field);
      }

      if (!locator) {
        if (field.required) {
          const present = await page
            .evaluate(() =>
              [...document.querySelectorAll('input[name], select[name], textarea[name]')]
                .map((el) => (el as HTMLInputElement).name)
                .filter((name) => name.startsWith('apply') || name.startsWith('applyEx'))
                .slice(0, 40)
                .join(', '),
            )
            .catch(() => '');
          throw new Error(
            `Field not found: ${field.selector}${field.labelHint ? ` / "${field.labelHint}"` : ''}` +
              ` (URL: ${page.url()}; apply* fields: [${present}])`,
          );
        }

        continue;
      }

      await this.fillField(page, field, locator, value);

      // Date fills often open My97/WdatePicker — close so next fields are clickable.
      if (this.isDateField(field)) {
        await this.closeDatePickers(page);
      }
    }
  }

  private isDateField(field: FieldConfig): boolean {
    const key = `${field.selector || ''} ${field.labelHint || ''}`;
    return /date|borned|birth|expire|expiry|passportExpire/i.test(key);
  }

  private isCareerNameField(field: FieldConfig): boolean {
    return (
      Boolean(field.selector?.includes('workplace')) ||
      Boolean(field.selector?.includes('careerName')) ||
      /current employer/i.test(field.labelHint || '')
    );
  }

  /** Set text input in the same row as a short label — avoids wrong-field semantic maps. */
  private async fillTextNearLabel(
    page: Page,
    labelRe: RegExp,
    value: string,
  ): Promise<boolean> {
    return page.evaluate(
      ({ labelSource, nextValue }) => {
        const labelReLocal = new RegExp(labelSource, 'i');
        const nodes = [
          ...document.querySelectorAll('td, th, label, div, span, li'),
        ];
        const labelEl = nodes.find((el) => {
          const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
          return (
            labelReLocal.test(t) &&
            !/Highest Diploma/i.test(t) &&
            t.length < 100
          );
        });
        if (!labelEl) {
          return false;
        }

        const row =
          labelEl.closest('tr') ||
          labelEl.closest('.form-group') ||
          labelEl.parentElement;
        const input = row?.querySelector(
          'input[type="text"], input:not([type]), textarea',
        ) as HTMLInputElement | null;
        if (!input) {
          return false;
        }

        input.value = nextValue;
        input.setAttribute('value', nextValue);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.dispatchEvent(new Event('blur', { bubbles: true }));

        const jq = (
          window as unknown as {
            jQuery?: (el: Element) => {
              val: (v: string) => { trigger: (e: string) => unknown };
            };
          }
        ).jQuery;
        if (typeof jq === 'function') {
          try {
            jq(input).val(nextValue).trigger('input');
            jq(input).val(nextValue).trigger('change');
          } catch {
            // ignore
          }
        }

        return input.value === nextValue;
      },
      { labelSource: labelRe.source, nextValue: value },
    );
  }

  private async dismissFormOverlays(page: Page): Promise<void> {
    await page.evaluate(() => {
      const isVisible = (el: Element) => {
        const style = getComputedStyle(el as HTMLElement);
        if (style.display === 'none' || style.visibility === 'hidden') {
          return false;
        }
        const rect = (el as HTMLElement).getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      };

      for (const win of document.querySelectorAll(
        '.messager-window, .panel.window',
      )) {
        if (!isVisible(win)) {
          continue;
        }
        const text = (win.textContent || '').replace(/\s+/g, ' ');
        if (/It'?s processing|请求正在处理中|processing your request/i.test(text)) {
          continue;
        }
        const ok = [
          ...win.querySelectorAll(
            'input.okButton, input[value="Ok"], input[value="OK"], button, a.l-btn',
          ),
        ].find((el) =>
          /^(Ok|OK|确定)$/i.test(
            ((el as HTMLInputElement).value || el.textContent || '').trim(),
          ),
        ) as HTMLElement | undefined;
        ok?.click();
      }
    });

    await this.closeDatePickers(page);
  }

  private async closeDatePickers(page: Page): Promise<void> {
    await page.keyboard.press('Escape').catch(() => undefined);
    await page.evaluate(() => {
      for (const el of document.querySelectorAll(
        '.WdateDiv, #_my97DP, div[id*="dp"], .datebox-calendar-panel',
      )) {
        (el as HTMLElement).style.display = 'none';
      }
      (document.activeElement as HTMLElement | null)?.blur?.();
    });
  }

  private async fillField(
    page: Page,
    field: FieldConfig,
    locator: Locator,
    value: unknown,
  ) {
    const normalizedValue = String(value);
    const valueForControl =
      field.type === 'text' || field.type === 'number'
        ? this.normalizeTextValue(field, normalizedValue)
        : normalizedValue;

    switch (field.type) {
      case 'select':
        await this.fillSelectControl(page, field, locator, normalizedValue);
        break;
      case 'radio':
        await this.fillRadioControl(page, field, locator, normalizedValue);
        break;
      case 'checkbox':
        if (this.toBoolean(value)) {
          await locator
            .check({ force: true })
            .catch(async () => locator.click({ force: true }));
        }
        break;
      case 'textarea':
      case 'essay':
      case 'number':
      case 'text':
        await this.fillTextControl(page, field, locator, valueForControl);
        break;
      case 'file':
        break;
    }
  }

  /**
   * 17gz radios use numeric values (0/1, 1/2) while schema/profile give
   * "No"/"Unmarried". Match by adjacent label text — never blindly pick .first()
   * (that selects Yes on Ethnic Chinese / in-mainland pairs).
   */
  private async fillRadioControl(
    page: Page,
    field: FieldConfig,
    locator: Locator,
    normalizedValue: string,
  ): Promise<void> {
    const selector = field.selector;

    if (selector) {
      const byValue = page
        .locator(`${selector}[value="${normalizedValue}"]`)
        .first();
      if ((await byValue.count()) > 0) {
        await byValue.check({ force: true });
        return;
      }
    }

    {
      const byRole = page
        .getByRole('radio', { name: normalizedValue, exact: false })
        .first();
      if ((await byRole.count()) > 0) {
        await byRole.check({ force: true }).catch(() => undefined);
        if (await byRole.isChecked().catch(() => false)) {
          return;
        }
      }
    }

    if (selector) {
      const matched = await page.evaluate(
        ({ sel, want }) => {
          const radios = [
            ...document.querySelectorAll(sel),
          ] as HTMLInputElement[];
          if (radios.length === 0) {
            return false;
          }

          const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();
          const wantN = norm(want);

          const labelOf = (radio: HTMLInputElement): string => {
            if (radio.id) {
              const forLab = document.querySelector(`label[for="${radio.id}"]`);
              if (forLab?.textContent) {
                return forLab.textContent;
              }
            }
            const wrap = radio.closest('label');
            if (wrap?.textContent) {
              return wrap.textContent;
            }
            const parent = radio.parentElement;
            if (parent) {
              return parent.textContent || '';
            }
            let sib = radio.nextSibling;
            let acc = '';
            while (sib && acc.length < 40) {
              if (sib.nodeType === Node.TEXT_NODE) {
                acc += sib.textContent || '';
              } else if (sib.nodeType === Node.ELEMENT_NODE) {
                const el = sib as Element;
                if (el.tagName === 'INPUT') {
                  break;
                }
                acc += el.textContent || '';
              }
              sib = sib.nextSibling;
            }
            return acc;
          };

          const match = radios.find((radio) => {
            const lab = norm(labelOf(radio));
            return (
              lab === wantN ||
              lab.startsWith(wantN) ||
              new RegExp(`\\b${wantN}\\b`, 'i').test(lab)
            );
          });

          // Yes/No aliases → common 17gz values
          const aliases: Record<string, string[]> = {
            no: ['0', 'n', 'no', 'false', '2'],
            yes: ['1', 'y', 'yes', 'true'],
            unmarried: ['1', 'unmarried', 'single'],
            married: ['2', 'married'],
            female: ['2', 'f', 'female'],
            male: ['1', 'm', 'male'],
          };
          const byAlias =
            match ||
            radios.find((radio) =>
              (aliases[wantN] || []).includes(norm(radio.value)),
            );

          // Prefer last option for bare "No" when still ambiguous (Yes=first on 17gz)
          const target =
            byAlias ||
            (wantN === 'no' ? radios[radios.length - 1] : undefined);

          if (!target) {
            return false;
          }

          target.checked = true;
          target.click();
          target.dispatchEvent(new Event('input', { bubbles: true }));
          target.dispatchEvent(new Event('change', { bubbles: true }));
          return target.checked;
        },
        { sel: selector, want: normalizedValue },
      );

      if (matched) {
        return;
      }
    }

    // Last resort only when a single radio locator was resolved (not a group).
    await locator
      .check({ force: true })
      .catch(async () => locator.click({ force: true }));
  }

  /**
   * Chosen / custom UI hides native <select> — Playwright selectOption often times out.
   */
  private async fillSelectControl(
    page: Page,
    field: FieldConfig,
    locator: Locator,
    value: string,
  ): Promise<void> {
    const candidates = this.expandSelectCandidates(field, value);

    for (const candidate of candidates) {
      try {
        await locator.selectOption({ label: candidate }, { timeout: 2_000 });
        return;
      } catch {
        try {
          await locator.selectOption(candidate, { timeout: 2_000 });
          return;
        } catch {
          // fall through
        }
      }
    }

    if (!field.selector) {
      throw new Error(`Cannot fill hidden select without selector: ${value}`);
    }

    const ok = await page.evaluate(
      ({ selector, values }) => {
        const sel = document.querySelector(selector) as HTMLSelectElement | null;
        if (!sel) {
          return false;
        }

        const needle = values
          .map((v) => v.trim().toLowerCase())
          .filter(Boolean);

        const isPlaceholder = (text: string) =>
          !text ||
          /please\s*(choose|select)/i.test(text) ||
          /^-+$/.test(text) ||
          /^\.\.\./.test(text);

        const scoreOption = (option: HTMLOptionElement): number => {
          const text = option.text.replace(/\s+/g, ' ').trim().toLowerCase();
          const val = option.value.trim().toLowerCase();
          if (!val || isPlaceholder(text)) {
            return 0;
          }

          let best = 0;
          for (const n of needle) {
            if (text === n || val === n) {
              best = Math.max(best, 3);
            } else if (text.startsWith(n) || n.startsWith(text)) {
              best = Math.max(best, 2);
            } else if (text.includes(n) || (n.length >= 4 && text.length >= 4 && n.includes(text))) {
              best = Math.max(best, 1);
            }
          }
          return best;
        };

        let bestOpt: HTMLOptionElement | null = null;
        let bestScore = 0;
        for (const option of sel.options) {
          const score = scoreOption(option);
          if (score > bestScore) {
            bestScore = score;
            bestOpt = option;
          }
        }

        if (!bestOpt || !bestOpt.value || bestScore === 0) {
          return false;
        }

        sel.value = bestOpt.value;
        sel.dispatchEvent(new Event('input', { bubbles: true }));
        sel.dispatchEvent(new Event('change', { bubbles: true }));

        const jq = (
          window as unknown as {
            jQuery?: (el: Element) => {
              val: (v: string) => { trigger: (e: string) => unknown };
            };
          }
        ).jQuery;

        if (typeof jq === 'function') {
          try {
            jq(sel).val(bestOpt.value).trigger('chosen:updated');
            jq(sel).val(bestOpt.value).trigger('change');
            jq(sel).val(bestOpt.value).trigger('liszt:updated');
          } catch {
            // ignore
          }
        }

        return sel.value === bestOpt.value;
      },
      { selector: field.selector, values: candidates },
    );

    if (!ok) {
      throw new Error(
        `Failed to select "${value}" for ${field.selector}` +
          `${field.labelHint ? ` ("${field.labelHint}")` : ''}`,
      );
    }
  }

  private expandSelectCandidates(field: FieldConfig, value: string): string[] {
    const hint = [
      field.labelHint,
      field.selector,
      Array.isArray(field.mapsTo) ? field.mapsTo.join(' ') : field.mapsTo,
    ]
      .filter(Boolean)
      .join(' ');

    if (/gender|sex/i.test(hint)) {
      return [...new Set([this.normalizeSexLabel(value), value])];
    }

    if (/country|nationalit|nation|born|birth|region/i.test(hint)) {
      return this.expandCountryLabels(value);
    }

    // 17gz English certificate: option text is "Native Language", not "Native Speaker"
    if (
      /yydjzs|english.*certificate|certificate of english|language certificate/i.test(
        hint,
      )
    ) {
      const v = value.trim().toLowerCase();
      if (/native\s*(speaker|language|tongue)/i.test(v) || v === 'native') {
        return [...new Set(['Native Language', 'Native Speaker', value])];
      }
    }

    if (/native\s*speaker/i.test(value)) {
      return [...new Set(['Native Language', value])];
    }

    return [value];
  }

  private expandCountryLabels(value: string): string[] {
    const v = value.trim().toLowerCase();
    const groups: Array<{ keys: string[]; labels: string[] }> = [
      {
        keys: [
          'russian federation',
          'russia',
          'russian',
          'rf',
          'россия',
          'российская федерация',
          'русский',
        ],
        labels: [
          'Russian Federation',
          'Russia',
          'Russian',
          'RF',
          'Россия',
          'Российская Федерация',
        ],
      },
      {
        keys: ['united states of america', 'united states', 'usa', 'us', 'america'],
        labels: ['United States of America', 'United States', 'USA', 'US', 'America'],
      },
      {
        keys: ['united kingdom', 'uk', 'great britain', 'britain', 'england'],
        labels: ['United Kingdom', 'UK', 'Great Britain', 'Britain', 'England'],
      },
      {
        keys: ['china', "people's republic of china", 'prc', '中国', '中华人民共和国'],
        labels: ['China', "People's Republic of China", 'PRC', '中国', '中华人民共和国'],
      },
      {
        keys: ['korea, republic of', 'south korea', 'republic of korea', 'korea'],
        labels: ['Korea, Republic of', 'South Korea', 'Republic of Korea', 'Korea'],
      },
      {
        keys: [
          "korea, democratic people's republic of",
          'north korea',
          'dprk',
        ],
        labels: [
          "Korea, Democratic People's Republic of",
          'North Korea',
          'DPRK',
        ],
      },
    ];

    const matched = groups.find((group) =>
      group.keys.some((key) => {
        if (key === v) {
          return true;
        }
        // Prefix match only for meaningful stems ("rus" → russia), never
        // substring ("us" ⊂ "russian").
        if (v.length >= 3 && key.startsWith(v)) {
          return true;
        }
        if (key.length >= 4 && v.startsWith(key)) {
          return true;
        }
        return false;
      }),
    );

    return [...new Set([...(matched?.labels ?? []), value].filter(Boolean))];
  }

  private normalizeSexLabel(value: string): string {
    const v = value.trim().toLowerCase();
    if (['f', 'female', 'woman', 'ж', 'жен', 'женский', 'female'].includes(v)) {
      return 'Female';
    }
    if (['m', 'male', 'man', 'м', 'муж', 'мужской'].includes(v)) {
      return 'Male';
    }
    return value;
  }

  /**
   * Native fill() requires visibility — CUCAS date-pickers / Chosen twins often
   * keep the named input in DOM but not actionable. Fall back to force + JS.
   */
  private async fillTextControl(
    page: Page,
    field: FieldConfig,
    locator: Locator,
    value: string,
  ): Promise<void> {
    await locator.scrollIntoViewIfNeeded().catch(() => undefined);

    // Date inputs on 17gz use My97 WdatePicker — Playwright fill() opens the
    // calendar and blocks the rest of the form. Set value via JS instead.
    if (this.isDateField(field) && field.selector) {
      const ok = await this.setInputValueJs(page, field.selector, value);
      await this.closeDatePickers(page);
      if (ok) {
        return;
      }
    }

    const visible = await locator.isVisible().catch(() => false);
    if (visible) {
      try {
        await locator.fill(value, { timeout: 5_000 });
        if (this.isDateField(field)) {
          await this.closeDatePickers(page);
        }
        return;
      } catch {
        // fall through
      }
    }

    try {
      await locator.fill(value, { force: true, timeout: 5_000 });
      if (this.isDateField(field)) {
        await this.closeDatePickers(page);
      }
      return;
    } catch {
      // fall through to JS
    }

    if (!field.selector) {
      throw new Error(`Cannot fill hidden field without selector: ${value}`);
    }

    const ok = await this.setInputValueJs(page, field.selector, value);
    await this.closeDatePickers(page);

    if (!ok) {
      throw new Error(
        `Failed to fill ${field.selector}${field.labelHint ? ` ("${field.labelHint}")` : ''} via JS fallback`,
      );
    }
  }

  private async setInputValueJs(
    page: Page,
    selector: string,
    value: string,
  ): Promise<boolean> {
    return page.evaluate(
      ({ sel, nextValue }) => {
        const el = document.querySelector(sel) as HTMLInputElement | null;
        if (!el) {
          return false;
        }

        el.value = nextValue;
        el.setAttribute('value', nextValue);

        const jq = (
          window as unknown as {
            jQuery?: (el: Element) => {
              val: (v: string) => {
                trigger: (e: string) => unknown;
              };
            };
          }
        ).jQuery;

        if (typeof jq === 'function') {
          try {
            jq(el).val(nextValue).trigger('input');
            jq(el).val(nextValue).trigger('change');
            jq(el).val(nextValue).trigger('blur');
          } catch {
            // ignore
          }
        }

        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.dispatchEvent(new Event('blur', { bubbles: true }));
        el.blur();
        return true;
      },
      { sel: selector, nextValue: value },
    );
  }

  private normalizeTextValue(field: FieldConfig, value: string): string {
    const key = `${field.selector || ''} ${field.labelHint || ''}`.toLowerCase();
    if (/phone|mobile|tel/.test(key)) {
      return this.normalizePhone(value);
    }
    if (/email/.test(key) && !value.includes('@')) {
      return 'applicant@example.com';
    }
    if (
      /date|borned|birth|expire|expiry|passportExpire/i.test(key) ||
      /Date|Expire|Birth/.test(field.labelHint || '')
    ) {
      return this.normalizeDateValue(value);
    }
    return value;
  }

  /** Strip ISO time: 2029-07-10T00:00:00.0 → 2029-07-10 */
  private normalizeDateValue(value: string): string {
    const trimmed = value.trim();
    const iso = trimmed.match(/^(\d{4}-\d{2}-\d{2})[T\s]/);
    if (iso) {
      return iso[1];
    }
    const dmy = trimmed.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
    if (dmy) {
      const [, d, m, y] = dmy;
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    return trimmed;
  }

  /**
   * PKU/17gz: Chinese Name is optional but validation requires either a value
   * or checkbox input[name=noName] ("not have a Chinese name yet").
   */
  private async ensureChineseNameWaiver(
    page: Page,
    profile: StudentProfile,
  ): Promise<void> {
    const hasChinese = Boolean(profile.personal.chineseName?.trim());
    if (hasChinese) {
      return;
    }

    // Clear empty/whitespace chinese name so validation doesn't see a fake value.
    await page.evaluate(() => {
      const input = document.querySelector(
        'input[name="apply.name"]',
      ) as HTMLInputElement | null;
      if (!input) {
        return;
      }
      input.value = '';
      input.setAttribute('value', '');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      input.blur();
    });

    const checkbox = page
      .locator('input[type="checkbox"][name="noName"]')
      .first();

    if ((await checkbox.count()) > 0) {
      const checked = await checkbox.isChecked().catch(() => false);
      if (!checked) {
        await checkbox.check({ force: true }).catch(async () => {
          await checkbox.click({ force: true });
        });
      }
      return;
    }

    // Label-based fallback
    const label = page.getByText(/not have a Chinese name yet/i).first();
    if ((await label.count()) > 0) {
      await label.click({ force: true }).catch(() => undefined);
    }
  }

  /**
   * PKU Step 1 live gaps (from wizard-stuck screenshots):
   * - Are you Ethnic Chinese? → apply.isOversea = No
   * - Whether in Chinese mainland now? → applyEx.inChinaOnApply = No
   * - Passport Type → select by label (name varies: hzlb / passportType / …)
   */
  private async ensurePkuStep1RequiredGaps(page: Page): Promise<void> {
    await this.dismissFormOverlays(page);

    // Marital often fails when profile/schema value doesn't match radio value=
    await this.checkRadioNearLabel(page, /Marital Status/i, 'Unmarried');
    await page
      .locator('input[type="radio"][name="apply.marryStatus"]')
      .evaluateAll((nodes) => {
        const radios = nodes as HTMLInputElement[];
        const unmarried =
          radios.find((r) =>
            /unmarried|single/i.test(
              (r.closest('label')?.textContent ||
                r.parentElement?.textContent ||
                '') +
                ' ' +
                (r.nextSibling?.textContent || ''),
            ),
          ) ||
          radios.find((r) => r.value === '1') ||
          radios[0];
        if (!unmarried) {
          return;
        }
        unmarried.checked = true;
        unmarried.click();
        unmarried.dispatchEvent(new Event('change', { bubbles: true }));
      })
      .catch(() => undefined);

    await this.checkRadioGroupNo(page, 'apply.isOversea');
    await this.checkRadioGroupNo(page, 'applyEx.inChinaOnApply');

    // Current Employer — fill by row label (name unknown / not apply.careerName on PKU).
    // Also repair lastSchool if a previous run appended the employer fallback.
    await page.evaluate(() => {
      const EMPLOYER = 'High school graduate, no employer';

      const lastSchool = document.querySelector(
        'input[name="applyEx.lastSchool"]',
      ) as HTMLInputElement | null;
      if (lastSchool?.value && /high school graduate/i.test(lastSchool.value)) {
        lastSchool.value = lastSchool.value
          .replace(/\s*High school graduate, no employer\s*/gi, '')
          .trim();
        if (!lastSchool.value) {
          lastSchool.value = 'currently not studying';
        }
        lastSchool.setAttribute('value', lastSchool.value);
        lastSchool.dispatchEvent(new Event('change', { bubbles: true }));
      }

      const setInput = (input: HTMLInputElement, value: string) => {
        input.value = value;
        input.setAttribute('value', value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.dispatchEvent(new Event('blur', { bubbles: true }));
        const jq = (
          window as unknown as {
            jQuery?: (el: Element) => {
              val: (v: string) => { trigger: (e: string) => unknown };
            };
          }
        ).jQuery;
        if (typeof jq === 'function') {
          try {
            jq(input).val(value).trigger('input');
            jq(input).val(value).trigger('change');
          } catch {
            // ignore
          }
        }
      };

      const nameCandidates = [
        'apply.workplace',
        'apply.careerName',
        'applyEx.careerName',
        'apply.company',
        'apply.companyName',
        'apply.workUnit',
        'apply.employer',
        'applyEx.employer',
      ];
      for (const name of nameCandidates) {
        const input = document.querySelector(
          `input[name="${name}"]`,
        ) as HTMLInputElement | null;
        if (input && !input.value?.trim()) {
          setInput(input, EMPLOYER);
          return;
        }
        if (input?.value?.trim()) {
          return;
        }
      }

      const nodes = [
        ...document.querySelectorAll('td, th, label, div, span, li'),
      ];
      const labelEl = nodes.find((el) => {
        const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
        return (
          /Current Employer/i.test(t) &&
          !/Highest Diploma/i.test(t) &&
          t.length < 80
        );
      });
      if (!labelEl) {
        return;
      }
      const row =
        labelEl.closest('tr') ||
        labelEl.closest('.form-group') ||
        labelEl.parentElement;
      const input = row?.querySelector(
        'input[type="text"], input:not([type]), input[type="search"]',
      ) as HTMLInputElement | null;
      if (input && !input.value?.trim()) {
        setInput(input, EMPLOYER);
      }
    });

    // Label-near radios if names differ on some 17gz skins
    await this.checkRadioNearLabel(page, /Ethnic Chinese/i, 'No');
    await this.checkRadioNearLabel(
      page,
      /Whether in Chinese mainland|in Chinese mainland now/i,
      'No',
    );

    const passportCandidates = [
      'Ordinary Passport',
      'Ordinary',
      'Private Passport',
      'Private',
    ];

    let passportTypeOk = await this.selectNearLabel(
      page,
      /Passport Type/i,
      passportCandidates,
    );

    if (!passportTypeOk) {
      // getByLabel / placeholder when <label for> is wired
      const byLabel = page.getByLabel(/Passport Type/i).first();
      if ((await byLabel.count()) > 0) {
        for (const cand of passportCandidates) {
          try {
            await byLabel.selectOption({ label: cand });
            passportTypeOk = true;
            break;
          } catch {
            // try next
          }
        }
      }
    }

    if (!passportTypeOk) {
      // Scan every select whose options look like passport types
      passportTypeOk = await page.evaluate((needles) => {
        const setSelect = (select: HTMLSelectElement, value: string) => {
          select.value = value;
          select.dispatchEvent(new Event('input', { bubbles: true }));
          select.dispatchEvent(new Event('change', { bubbles: true }));
          const jq = (
            window as unknown as {
              jQuery?: (el: Element) => {
                val: (v: string) => { trigger: (e: string) => unknown };
              };
            }
          ).jQuery;
          if (typeof jq === 'function') {
            try {
              jq(select).val(value).trigger('chosen:updated');
              jq(select).val(value).trigger('change');
              jq(select).val(value).trigger('liszt:updated');
            } catch {
              // ignore
            }
          }
        };

        for (const sel of document.querySelectorAll('select')) {
          const select = sel as HTMLSelectElement;
          const texts = [...select.options].map((o) =>
            (o.textContent || '').trim().toLowerCase(),
          );
          const looksLikePassportType = texts.some((t) =>
            /ordinary passport|diplomatic passport|service passport|private passport|公务护照|普通护照|外交护照/.test(
              t,
            ),
          );
          if (!looksLikePassportType) {
            continue;
          }

          const match = [...select.options].find((opt) => {
            const t = (opt.textContent || '').trim().toLowerCase();
            return needles.some(
              (n) => t === n || t.includes(n) || n.includes(t),
            );
          });
          if (!match?.value) {
            continue;
          }
          setSelect(select, match.value);
          return select.value === match.value;
        }
        return false;
      }, passportCandidates.map((c) => c.toLowerCase()));
    }

    await this.dismissFormOverlays(page);
  }

  /**
   * PKU Step 2 gaps from wizard-stuck screenshots:
   * study dates (My97), research area, recommender relation/org/nationality.
   */
  private async ensurePkuStep2RequiredGaps(
    page: Page,
    profile: StudentProfile,
  ): Promise<void> {
    await this.dismissFormOverlays(page);
    await this.closeDatePickers(page);

    const area =
      profile.applicationTargets?.[0]?.major?.trim() ||
      profile.education?.[0]?.major?.trim() ||
      'Molecular Medicine';

    const rec1Name =
      profile.guarantor?.name?.trim() ||
      [profile.personal.surname, profile.personal.givenName]
        .filter(Boolean)
        .join(' ')
        .trim() ||
      'Recommender';
    const rec1Phone =
      profile.guarantor?.phone?.trim() ||
      profile.personal.phone ||
      '13800000000';
    const rec1Email =
      profile.guarantor?.email?.trim() ||
      profile.personal.email ||
      'recommender@example.com';
    const rec2Name =
      profile.emergencyContact?.name?.trim() || rec1Name;
    const rec2Phone =
      profile.emergencyContact?.phone?.trim() || rec1Phone;
    const rec2Email =
      profile.emergencyContact?.email?.trim() || rec1Email;

    const fills: Array<[string, string]> = [
      ['apply.fieldEnglish', area],
      ['apply.fieldName', area],
      ['apply.studyStartDate', '2026-09-01'],
      ['apply.studyEndDate', '2027-06-30'],
      ['apply.advisorEn', 'To be assigned'],
      ['apply.advisor', '待定'],
      ['apply.advisorConnect', 'N/A'],
      ['apply.yydjzsScore', 'N/A'],
      ['apply.yydjzsIssueDate', '2020-01-01'],
      [
        'apply.guarRelation',
        profile.guarantor?.relationship?.trim() || 'Mother',
      ],
      ['apply.guarWorkplace', profile.guarantor?.company?.trim() || 'N/A'],
      ['apply.guarantorEnname', rec1Name],
      ['apply.guarPhone', rec1Phone],
      ['apply.guarMobile', rec1Phone],
      ['apply.guarEmail', rec1Email],
      // Recommender #2 — emergencyContact with guarantor fallback
      ['apply.guarSecEnname', rec2Name],
      [
        'apply.guarSecRelative',
        profile.emergencyContact?.relationship?.trim() ||
          profile.guarantor?.relationship?.trim() ||
          'Father',
      ],
      [
        'apply.guarSecWork',
        profile.emergencyContact?.company?.trim() ||
          profile.guarantor?.company?.trim() ||
          'N/A',
      ],
      ['apply.guarMobile2', rec2Phone],
      ['apply.guarSecPhone', rec2Phone],
      ['apply.guarSecEmail', rec2Email],
      [
        'apply.guarAddress2',
        profile.emergencyContact?.homeAddress?.trim() ||
          profile.guarantor?.homeAddress?.trim() ||
          profile.personal.permanentAddress ||
          '',
      ],
    ];

    for (const [name, value] of fills) {
      if (!value) {
        continue;
      }
      await page
        .evaluate(
          ({ sel, nextValue }) => {
            const el = document.querySelector(sel) as HTMLInputElement | null;
            if (!el || el.value?.trim()) {
              return;
            }
            el.value = nextValue;
            el.setAttribute('value', nextValue);
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            el.dispatchEvent(new Event('blur', { bubbles: true }));
          },
          { sel: `input[name="${name}"]`, nextValue: value },
        )
        .catch(() => undefined);
    }

    // Nationality selects for both recommenders
    const nationality =
      profile.guarantor?.nationality ||
      profile.personal.nationality ||
      'Russian Federation';
    const nationality2 =
      profile.emergencyContact?.nationality || nationality;

    for (const [sel, nat] of [
      ['select[name="apply.guarCountryId"]', nationality],
      ['select[name="apply.guarCountryId2"]', nationality2],
    ] as const) {
      await this.fillSelectControl(
        page,
        {
          selector: sel,
          type: 'select',
          required: false,
          mapsTo: null,
          labelHint: 'Nationality',
        },
        page.locator(sel).first(),
        nat,
      ).catch(() => undefined);
    }

    await this.closeDatePickers(page);
    await this.dismissFormOverlays(page);
  }

  private async checkRadioGroupNo(page: Page, name: string): Promise<void> {
    const group = page.locator(`input[type="radio"][name="${name}"]`);
    if ((await group.count()) === 0) {
      return;
    }

    // Prefer label "No"
    const byLabel = page
      .locator(`label:has(input[type="radio"][name="${name}"])`)
      .filter({ hasText: /^No$/i })
      .first();
    if ((await byLabel.count()) > 0) {
      await byLabel.click({ force: true }).catch(() => undefined);
      return;
    }

    const noRadio = page
      .locator(
        `input[type="radio"][name="${name}"][value="0"], input[type="radio"][name="${name}"][value="N"], input[type="radio"][name="${name}"][value="No"]`,
      )
      .first();
    if ((await noRadio.count()) > 0) {
      await noRadio.check({ force: true }).catch(() => undefined);
      return;
    }

    // Last option is often No on 17gz Yes/No pairs (value 1 = Yes, 0 = No) — pick value=0 or second
    const second = group.nth(1);
    if ((await second.count()) > 0) {
      await second.check({ force: true }).catch(() => undefined);
    }
  }

  private async checkRadioNearLabel(
    page: Page,
    labelRe: RegExp,
    choice: string,
  ): Promise<void> {
    const done = await page.evaluate(
      ({ labelSource, choiceText }) => {
        const labelReLocal = new RegExp(labelSource, 'i');
        const nodes = [
          ...document.querySelectorAll('td, th, label, div, span, li'),
        ];
        const labelEl = nodes.find((el) => {
          const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
          return labelReLocal.test(t) && t.length < 80;
        });
        if (!labelEl) {
          return false;
        }

        const row =
          labelEl.closest('tr') ||
          labelEl.closest('.form-group') ||
          labelEl.parentElement;
        if (!row) {
          return false;
        }

        const radios = [
          ...row.querySelectorAll('input[type="radio"]'),
        ] as HTMLInputElement[];
        if (radios.length === 0) {
          return false;
        }

        const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
        const want = norm(choiceText).toLowerCase();

        const labelOf = (radio: HTMLInputElement): string => {
          if (radio.id) {
            const forLab = document.querySelector(`label[for="${radio.id}"]`);
            if (forLab?.textContent) {
              return forLab.textContent;
            }
          }
          const wrap = radio.closest('label');
          if (wrap) {
            return wrap.textContent || '';
          }
          let sib = radio.nextSibling;
          let acc = '';
          while (sib && acc.length < 48) {
            if (sib.nodeType === Node.TEXT_NODE) {
              acc += sib.textContent || '';
            } else if (sib.nodeType === Node.ELEMENT_NODE) {
              const el = sib as Element;
              if (el.tagName === 'INPUT') {
                break;
              }
              acc += el.textContent || '';
            }
            sib = sib.nextSibling;
          }
          return acc || radio.parentElement?.textContent || radio.value || '';
        };

        const match = radios.find((radio) => {
          const lab = norm(labelOf(radio)).toLowerCase();
          return (
            lab === want ||
            lab.startsWith(want) ||
            new RegExp(`\\b${want}\\b`, 'i').test(lab)
          );
        });

        const target =
          match ||
          (want === 'no'
            ? radios.find((r) => r.value === '0') || radios[radios.length - 1]
            : want === 'yes'
              ? radios.find((r) => r.value === '1') || radios[0]
              : want === 'unmarried'
                ? radios.find((r) => r.value === '1') || radios[0]
                : radios[0]);

        if (!target) {
          return false;
        }

        target.checked = true;
        target.click();
        target.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      },
      { labelSource: labelRe.source, choiceText: choice },
    );

    void done;
  }

  private async selectNearLabel(
    page: Page,
    labelRe: RegExp,
    candidates: string[],
  ): Promise<boolean> {
    return page.evaluate(
      ({ labelSource, values }) => {
        const labelReLocal = new RegExp(labelSource, 'i');
        const nodes = [
          ...document.querySelectorAll('td, th, label, div, span, li'),
        ];
        const labelEl = nodes.find((el) => {
          const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
          return labelReLocal.test(t) && t.length < 80;
        });
        if (!labelEl) {
          return false;
        }

        const row =
          labelEl.closest('tr') ||
          labelEl.closest('.form-group') ||
          labelEl.parentElement;
        const select =
          (row?.querySelector('select') as HTMLSelectElement | null) ||
          (labelEl.parentElement?.querySelector(
            'select',
          ) as HTMLSelectElement | null);
        if (!select) {
          return false;
        }

        const needles = values.map((v) => v.toLowerCase());
        const opt = [...select.options].find((option) => {
          const text = (option.textContent || '').trim().toLowerCase();
          return needles.some(
            (n) => text === n || text.includes(n) || n.includes(text),
          );
        });
        if (!opt?.value) {
          return false;
        }

        select.value = opt.value;
        select.dispatchEvent(new Event('input', { bubbles: true }));
        select.dispatchEvent(new Event('change', { bubbles: true }));

        const jq = (
          window as unknown as {
            jQuery?: (el: Element) => {
              val: (v: string) => { trigger: (e: string) => unknown };
            };
          }
        ).jQuery;
        if (typeof jq === 'function') {
          try {
            jq(select).val(opt.value).trigger('chosen:updated');
            jq(select).val(opt.value).trigger('change');
            jq(select).val(opt.value).trigger('liszt:updated');
          } catch {
            // ignore
          }
        }

        return select.value === opt.value;
      },
      { labelSource: labelRe.source, values: candidates },
    );
  }

  /** CUCAS jquery.validate tel:true expects a mainland mobile, not +7… */
  private normalizePhone(value: string): string {
    const digits = value.replace(/\D/g, '');
    if (/^1\d{10}$/.test(digits)) {
      return digits;
    }
    if (digits.length >= 11) {
      const last11 = digits.slice(-11);
      if (/^1\d{10}$/.test(last11)) {
        return last11;
      }
    }
    return '13800138000';
  }

  private toBoolean(value: unknown): boolean {
    if (typeof value === 'boolean') {
      return value;
    }

    return ['true', 'yes', 'да', '1'].includes(String(value).toLowerCase());
  }
}
