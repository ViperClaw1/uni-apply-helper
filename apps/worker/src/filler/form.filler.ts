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
        await this.fillFieldBatch(
          page,
          profile,
          fields.filter((field) => field.type !== 'file'),
          motivationLetterContent,
          fillMode,
        );

        if (step === 1) {
          await this.ensureChineseNameWaiver(page, profile);
        }

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
                .filter((name) => name.startsWith('apply'))
                .slice(0, 25)
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
    }
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
        if (field.selector) {
          const byValue = page
            .locator(`${field.selector}[value="${normalizedValue}"]`)
            .first();
          if ((await byValue.count()) > 0) {
            await byValue.check({ force: true });
            break;
          }
        }

        {
          const byLabel = page
            .getByRole('radio', { name: normalizedValue, exact: false })
            .first();
          if ((await byLabel.count()) > 0) {
            await byLabel.check({ force: true }).catch(() => undefined);
            if (await byLabel.isChecked().catch(() => false)) {
              break;
            }
          }
        }

        // CUCAS mailing radios often lack useful labels in captures — pick first.
        await (field.selector
          ? page.locator(field.selector).first()
          : locator
        )
          .check({ force: true })
          .catch(async () =>
            (field.selector
              ? page.locator(field.selector).first()
              : locator
            ).click({ force: true }),
          );
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
    const hint = [field.labelHint, field.selector, field.mapsTo]
      .filter(Boolean)
      .join(' ');

    if (/gender|sex/i.test(hint)) {
      return [...new Set([this.normalizeSexLabel(value), value])];
    }

    if (/country|nationalit|nation|born|birth|region/i.test(hint)) {
      return this.expandCountryLabels(value);
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

    const visible = await locator.isVisible().catch(() => false);
    if (visible) {
      try {
        await locator.fill(value, { timeout: 5_000 });
        return;
      } catch {
        // fall through
      }
    }

    try {
      await locator.fill(value, { force: true, timeout: 5_000 });
      return;
    } catch {
      // fall through to JS
    }

    if (!field.selector) {
      throw new Error(`Cannot fill hidden field without selector: ${value}`);
    }

    const ok = await page.evaluate(
      ({ selector, nextValue }) => {
        const el = document.querySelector(selector) as HTMLInputElement | null;
        if (!el) {
          return false;
        }

        el.focus();
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
        return true;
      },
      { selector: field.selector, nextValue: value },
    );

    if (!ok) {
      throw new Error(
        `Failed to fill ${field.selector}${field.labelHint ? ` ("${field.labelHint}")` : ''} via JS fallback`,
      );
    }
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
