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
import { GeocodingService } from '../geocoding/geocoding.service.js';
import { detectCurrentWizardStep } from '../browser/zzu-pre-wizard.js';

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
    private readonly geocoding: GeocodingService,
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
      {
        softSkipAbsent: university
          ? this.is17gzPortal(university)
          : false,
      },
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

    // Retry may land mid-wizard (e.g. Step 3) — resume, don't require Step 1 DOM.
    const resumeStep =
      (await detectCurrentWizardStep(page).catch(() => null)) ?? 1;

    if (resumeStep <= 1) {
      await this.waitForStepOneFields(page, university);
    }

    await this.wizardNavigator.forEachStep(
      page,
      wizard,
      async (step) => {
        if (
          step === 1 &&
          university.navigationHints?.ocrPassportUpload
        ) {
          await this.ocrPassportUploader.upload(page, profile);
          // Photo OCR often leaves "It's processing!" up — don't fill under it.
          await this.wizardNavigator.waitForProcessingDone(page, 90_000);
        }

        const fields = this.wizardFieldGroups.fieldsForStep(university, step);
        await this.wizardNavigator.waitForProcessingDone(page, 60_000);
        await this.dismissFormOverlays(page);
        await this.fillFieldBatch(
          page,
          profile,
          fields.filter((field) => field.type !== 'file'),
          motivationLetterContent,
          fillMode,
          { softSkipAbsent: this.is17gzPortal(university) },
        );

        if (step === 1) {
          await this.ensureChineseNameWaiver(page, profile);
          if (this.is17gzPortal(university)) {
            await this.ensurePkuStep1RequiredGaps(page, profile);
          }
        }
        if (step === 2 && this.is17gzPortal(university)) {
          await this.ensurePkuStep2RequiredGaps(page, profile);
          await this.assertPkuStep2CriticalFilled(page, profile);
        }
        if (step === 3 && this.is17gzPortal(university)) {
          await this.ensurePkuStep3RequiredGaps(page, profile);
        }
        if (step === 4 && this.is17gzPortal(university)) {
          await this.ensurePkuStep4RequiredGaps(page, profile);
        }
        if (step === 5 && this.is17gzPortal(university)) {
          await this.ensurePkuStep5RequiredGaps(page, profile);
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
        startStep: resumeStep,
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
    {
      softSkipAbsent = false,
    }: {
      /**
       * 17gz skins differ by student type (undergrad has no Area of Research /
       * Duration inputs — read-only summary). Schema lists the union; absent DOM
       * nodes are skipped instead of hard-failing.
       */
      softSkipAbsent?: boolean;
    } = {},
  ): Promise<void> {
    for (const field of fields) {
      await this.wizardNavigator.waitForProcessingDone(page, 60_000);
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
            timeout: softSkipAbsent ? 2_000 : 10_000,
          })
          .catch(() => undefined);
        locator = await resolveFieldLocator(page, field);
      }

      if (!locator) {
        if (field.required && !softSkipAbsent) {
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
        await this.fillSelectControl(
          page,
          field,
          locator,
          this.applyValueMap(field, normalizedValue),
        );
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
   * "No"/"Unmarried"/"Женский (Female)". Match within the named group only —
   * never page-wide getByRole and never locator.first() (Yes on 17gz).
   */
  private async fillRadioControl(
    page: Page,
    field: FieldConfig,
    _locator: Locator,
    normalizedValue: string,
  ): Promise<void> {
    const selector = field.selector;
    if (!selector) {
      throw new Error(
        `Radio field needs selector to avoid ambiguous Yes/No match` +
          `${field.labelHint ? ` ("${field.labelHint}")` : ''}`,
      );
    }

    await this.wizardNavigator.waitForProcessingDone(page, 60_000);

    const want = this.canonicalizeRadioValue(normalizedValue.trim());
    const wantLower = want.toLowerCase();
    const valueAliases: Record<string, string[]> = {
      no: ['0', 'n', 'no', 'false'],
      yes: ['1', 'y', 'yes', 'true'],
      unmarried: ['1', 'unmarried', 'single'],
      married: ['2', 'married'],
      female: ['2', 'f', 'female'],
      male: ['1', 'm', 'male'],
    };
    const aliasValues = valueAliases[wantLower] ?? [want];
    const labelNeedles = [
      wantLower,
      ...aliasValues.map((v) => v.toLowerCase()).filter((v) => !/^\d+$/.test(v)),
    ];

    for (const v of aliasValues) {
      const byValue = page.locator(`${selector}[value="${v}"]`).first();
      if ((await byValue.count()) > 0) {
        // JS set — works even under a leftover mask; Playwright check can flake.
        const ok = await page.evaluate(
          ({ sel, value }) => {
            const el = document.querySelector(
              `${sel}[value="${value}"]`,
            ) as HTMLInputElement | null;
            if (!el) {
              return false;
            }
            el.checked = true;
            el.click();
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            return el.checked;
          },
          { sel: selector, value: v },
        );
        if (ok) {
          return;
        }
      }
    }

    const matched = await page.evaluate(
      ({ sel, want: wantRaw, aliases, needles }) => {
        const radios = [
          ...document.querySelectorAll(sel),
        ] as HTMLInputElement[];
        if (radios.length === 0) {
          return false;
        }

        const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();
        const wantN = norm(wantRaw);

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

        const byLabel = radios.find((radio) => {
          const lab = norm(labelOf(radio));
          if (lab === wantN || new RegExp(`\\b${wantN}\\b`, 'i').test(lab)) {
            return true;
          }
          return needles.some(
            (n) => n.length >= 2 && (lab === n || new RegExp(`\\b${n}\\b`, 'i').test(lab)),
          );
        });

        const byAlias = radios.find((radio) =>
          aliases.includes(norm(radio.value)),
        );

        // Prefer last option for bare "No" when still ambiguous (Yes=first on 17gz)
        const target =
          byLabel ||
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
      {
        sel: selector,
        want,
        aliases: aliasValues.map((v) => v.toLowerCase()),
        needles: labelNeedles,
      },
    );

    if (!matched) {
      throw new Error(
        `Failed to select radio "${normalizedValue.trim()}"` +
          (want !== normalizedValue.trim() ? ` (as "${want}")` : '') +
          ` for ${selector}` +
          `${field.labelHint ? ` ("${field.labelHint}")` : ''}`,
      );
    }
  }

  /** Collapse compound labels like "Женский (Female)" → Female / No / Unmarried. */
  private canonicalizeRadioValue(value: string): string {
    const v = value.trim().toLowerCase();
    if (
      v === 'female' ||
      /\bfemale\b/.test(v) ||
      /женск/.test(v) ||
      v === 'f' ||
      v === 'woman'
    ) {
      return 'Female';
    }
    if (
      (v === 'male' || /\bmale\b/.test(v) || /мужск/.test(v) || v === 'm' || v === 'man') &&
      !/\bfemale\b/.test(v) &&
      !/женск/.test(v)
    ) {
      return 'Male';
    }
    if (
      v === 'unmarried' ||
      v === 'single' ||
      /\bunmarried\b/.test(v) ||
      /\bsingle\b/.test(v)
    ) {
      return 'Unmarried';
    }
    if (v === 'married' || /\bmarried\b/.test(v)) {
      return 'Married';
    }
    if (v === 'yes' || v === 'y' || v === 'true' || v === 'да') {
      return 'Yes';
    }
    if (v === 'no' || v === 'n' || v === 'false' || v === 'нет') {
      return 'No';
    }
    return value.trim();
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
      const semanticOk = await this.trySemanticSelectMatch(
        page,
        field,
        value,
        candidates,
      );
      if (semanticOk) {
        return;
      }

      throw new Error(
        `Failed to select "${value}"` +
          (value !== candidates[0] ? ` (tried: ${candidates.slice(0, 5).join(' | ')})` : '') +
          ` for ${field.selector}` +
          `${field.labelHint ? ` ("${field.labelHint}")` : ''}`,
      );
    }
  }

  private async trySemanticSelectMatch(
    page: Page,
    field: FieldConfig,
    value: string,
    candidates: string[],
  ): Promise<boolean> {
    if (!field.selector || !this.semanticFieldMapper.isAvailable()) {
      return false;
    }

    const selectOptions = await page.evaluate((selector) => {
      const sel = document.querySelector(selector) as HTMLSelectElement | null;
      if (!sel) {
        return [] as Array<{ value: string; label: string }>;
      }
      const isPlaceholder = (text: string) =>
        !text ||
        /please\s*(choose|select)/i.test(text) ||
        /^-+$/.test(text) ||
        /^-choose-$/i.test(text) ||
        /^\.\.\./.test(text);

      return Array.from(sel.options)
        .map((o) => ({
          value: o.value,
          label: o.text.replace(/\s+/g, ' ').trim(),
        }))
        .filter((o) => o.value && !isPlaceholder(o.label));
    }, field.selector);

    if (selectOptions.length === 0) {
      return false;
    }

    const matched = await this.semanticFieldMapper.semanticSelectMatch({
      desiredValue: value,
      candidates,
      selectOptions,
      fieldLabel: field.labelHint ?? field.selector,
    });

    if (!matched) {
      return false;
    }

    return page.evaluate(
      ({ selector, optionValue }) => {
        const sel = document.querySelector(selector) as HTMLSelectElement | null;
        if (!sel) {
          return false;
        }
        sel.value = optionValue;
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
            jq(sel).val(optionValue).trigger('chosen:updated');
            jq(sel).val(optionValue).trigger('change');
            jq(sel).val(optionValue).trigger('liszt:updated');
          } catch {
            // ignore
          }
        }
        return sel.value === optionValue;
      },
      { selector: field.selector, optionValue: matched.value },
    );
  }

  private applyValueMap(field: FieldConfig, value: string): string {
    const trimmed = value.trim();
    if (!field.valueMap) {
      return trimmed;
    }

    if (field.valueMap[trimmed]) {
      return field.valueMap[trimmed];
    }

    // Case-insensitive / whitespace-tolerant lookup
    const lower = trimmed.toLowerCase();
    for (const [from, to] of Object.entries(field.valueMap)) {
      if (from.trim().toLowerCase() === lower) {
        return to;
      }
    }

    return trimmed;
  }

  private expandSelectCandidates(field: FieldConfig, value: string): string[] {
    const mapped = this.applyValueMap(field, value);
    const hint = [
      field.labelHint,
      field.selector,
      Array.isArray(field.mapsTo) ? field.mapsTo.join(' ') : field.mapsTo,
    ]
      .filter(Boolean)
      .join(' ');

    if (/gender|sex/i.test(hint)) {
      return [...new Set([this.normalizeSexLabel(mapped), mapped, value])];
    }

    if (/country|nationalit|nation|born|birth|region/i.test(hint)) {
      return this.expandCountryLabels(mapped);
    }

    // 17gz English certificate: option text is "Native Language", not "Native Speaker"
    if (
      /yydjzs|english.*certificate|certificate of english|language certificate/i.test(
        hint,
      )
    ) {
      const v = mapped.trim().toLowerCase();
      if (/native\s*(speaker|language|tongue)/i.test(v) || v === 'native') {
        return [...new Set(['Native Language', 'Native Speaker', mapped, value])];
      }
    }

    if (/native\s*speaker/i.test(mapped)) {
      return [...new Set(['Native Language', mapped, value])];
    }

    // Education level aliases (PKU/17gz: no "High school diploma")
    if (/educationId|education level|highest level of education/i.test(hint)) {
      return [
        ...new Set([
          mapped,
          value.trim(),
          ...this.expandEducationLabels(mapped),
          ...this.expandEducationLabels(value),
        ]),
      ];
    }

    return [...new Set([mapped, value.trim()].filter(Boolean))];
  }

  private expandEducationLabels(value: string): string[] {
    const v = value.trim().toLowerCase();
    if (
      /high\s*school|senior\s*high|secondary|диплом.*средн|средн(ее|яя).*образован/i.test(
        v,
      )
    ) {
      return ['Senior high', 'Senior High', 'High school'];
    }
    if (/bachelor|бакалавр|undergraduate/i.test(v)) {
      return ['Bachelor', "Bachelor's degree", 'Currently an Undergraduate'];
    }
    if (/master|магистр/i.test(v)) {
      return ['Master', "Master's degree", "Currently a Master's"];
    }
    if (/ph\.?\s*d|doctor|доктор|dr\.?/i.test(v)) {
      return ['Dr.', 'PhD', 'Doctorate'];
    }
    if (/vocational|колледж|техникум/i.test(v)) {
      return ['Vocational College', 'Technical secondary'];
    }
    return [];
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
    if (
      ['f', 'female', 'woman', 'ж', 'жен', 'женский'].includes(v) ||
      /\bfemale\b/.test(v) ||
      /женск/.test(v)
    ) {
      return 'Female';
    }
    if (
      ['m', 'male', 'man', 'м', 'муж', 'мужской'].includes(v) ||
      (/\bmale\b/.test(v) && !/\bfemale\b/.test(v)) ||
      (/мужск/.test(v) && !/женск/.test(v))
    ) {
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
  /**
   * Shared 17gz Step-1 gap fill (PKU / CSU / KMMC / ZZU).
   * Fills platform conditionals that schema mapping often leaves empty:
   * otherReligion, china/visa block, issue place, immigrant, restrict, gainCountryDate.
   */
  private async ensurePkuStep1RequiredGaps(
    page: Page,
    profile?: StudentProfile,
  ): Promise<void> {
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

    // Immigrant / 是否移民 — required radio on many 17gz skins
    await this.checkRadioGroupNo(page, 'applyEx.isYiMin');
    await this.checkRadioNearLabel(
      page,
      /immigrant|是否移民|Have you ever been an immigrant/i,
      'No',
    );

    // Prefer None/Atheism so otherReligion stays optional; still fill it if empty.
    await this.selectNearLabel(page, /^Religion$|宗教信仰/i, [
      'None',
      'Atheism',
      '无',
      '无宗教信仰',
    ]);

    // Visa type → No Visa (avoids requiring visaNo/expire when in China = No)
    await this.selectNearLabel(
      page,
      /Visa Type|Type of Visa|所持证件|签证种类/i,
      ['No Visa', 'No visa', '无签证'],
    );

    // Passport valid for / restrict
    await this.selectNearLabel(
      page,
      /Passport valid for|Valid for|护照有效范围|限制前往/i,
      [
        'Chinese mainland',
        'Chinese Mainland',
        'Mainland',
        '中国大陆',
        '中国内地',
      ],
    );

    const birthDate =
      profile?.personal.dateOfBirth?.trim() ||
      '2000-01-01';
    const passportExpire =
      profile?.personal.passportExpiry?.trim() || '2030-12-31';
    const nationality =
      profile?.personal.nationality?.trim() || 'N/A';

    await page.evaluate(
      ({ birthDate: birth, passportExpire: expire, nationality: nation }) => {
        const jq = (
          window as unknown as {
            jQuery?: (el: Element) => {
              val: (v: string) => { trigger: (e: string) => unknown };
            };
          }
        ).jQuery;

        const setInput = (input: HTMLInputElement | null, value: string) => {
          if (!input || !value || (input.value && input.value.trim())) {
            return;
          }
          input.value = value;
          input.setAttribute('value', value);
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
          input.dispatchEvent(new Event('blur', { bubbles: true }));
          if (typeof jq === 'function') {
            try {
              jq(input).val(value).trigger('change');
            } catch {
              // ignore
            }
          }
        };

        const setSelectByNeedles = (
          name: string,
          needles: string[],
        ): boolean => {
          const select = document.querySelector(
            `select[name="${name}"]`,
          ) as HTMLSelectElement | null;
          if (!select) {
            return false;
          }
          if (
            select.value &&
            select.value !== '0' &&
            !/please|choose|-choose-/i.test(
              select.options[select.selectedIndex]?.text || '',
            )
          ) {
            return true;
          }
          const match = [...select.options].find((opt) => {
            const t = (opt.textContent || '').trim().toLowerCase();
            return needles.some((n) => t === n || t.includes(n));
          });
          if (!match?.value) {
            return false;
          }
          select.value = match.value;
          select.dispatchEvent(new Event('input', { bubbles: true }));
          select.dispatchEvent(new Event('change', { bubbles: true }));
          if (typeof jq === 'function') {
            try {
              jq(select).val(match.value).trigger('chosen:updated');
              jq(select).val(match.value).trigger('change');
            } catch {
              // ignore
            }
          }
          return select.value === match.value;
        };

        // Religion stuck on Other → flip to None
        const religion = document.querySelector(
          'select[name="apply.religionId"]',
        ) as HTMLSelectElement | null;
        if (religion) {
          const cur = (
            religion.options[religion.selectedIndex]?.text || ''
          ).trim();
          if (!cur || /other|其他|please|choose/i.test(cur)) {
            setSelectByNeedles('apply.religionId', [
              'none',
              'atheism',
              '无',
            ]);
          }
        }

        setInput(
          document.querySelector(
            'input[name="apply.otherReligion"]',
          ) as HTMLInputElement,
          'None',
        );
        setInput(
          document.querySelector(
            'input[name="applyEx.chinaPlaceOnApply"]',
          ) as HTMLInputElement,
          'N/A',
        );
        setInput(
          document.querySelector(
            'input[name="apply.visaNo"]',
          ) as HTMLInputElement,
          'N/A',
        );
        setInput(
          document.querySelector(
            'input[name="apply.visaExpire"]',
          ) as HTMLInputElement,
          expire,
        );
        setInput(
          document.querySelector(
            'input[name="otherIssuePlace"]',
          ) as HTMLInputElement,
          nation,
        );
        setInput(
          document.querySelector(
            'input[name="apply.gainCountryDate"]',
          ) as HTMLInputElement,
          birth,
        );

        setSelectByNeedles('apply.visaId', ['no visa', '无签证']);
        setSelectByNeedles('apply.restrict', [
          'chinese mainland',
          'mainland',
          '中国大陆',
          '中国内地',
        ]);
      },
      {
        birthDate,
        passportExpire,
        nationality,
      },
    );

    // Re-assert No after any change handlers that may flip conditionals back
    await this.checkRadioGroupNo(page, 'apply.isOversea');
    await this.checkRadioGroupNo(page, 'applyEx.inChinaOnApply');
    await this.checkRadioGroupNo(page, 'applyEx.isYiMin');

    await this.dismissFormOverlays(page);
  }

  private is17gzPortal(university: {
    id: string;
    formUrl?: string;
  }): boolean {
    return (
      university.id === 'pku' ||
      university.id === 'csu' ||
      university.id === 'kmmc' ||
      university.id === 'zhengzhou-university' ||
      /(?:^|\.)17gz\.org|kmmc\.cn/i.test(university.formUrl || '')
    );
  }

  /**
   * Step 5: homePhone (not only Mobile), isSame=Same, contact+receiver backups.
   * Address/city/zip enriched via Google Geocoding when key is set.
   */
  private async ensurePkuStep5RequiredGaps(
    page: Page,
    profile: StudentProfile,
  ): Promise<void> {
    await this.wizardNavigator.waitForProcessingDone(page, 60_000);
    await this.dismissFormOverlays(page);
    await this.closeDatePickers(page);

    const fullName =
      [profile.personal.surname, profile.personal.givenName]
        .filter(Boolean)
        .join(' ')
        .trim() || 'Applicant';
    const phone =
      profile.personal.phone?.trim() ||
      profile.guarantor?.phone?.trim() ||
      '13800000000';
    const nationality =
      profile.personal.nationality?.trim() || 'Russian Federation';
    const rawAddress =
      profile.personal.permanentAddress?.trim() ||
      profile.guarantor?.homeAddress?.trim() ||
      'N/A';

    const geo = await this.geocoding.resolve(rawAddress, {
      city: profile.personal.cityOfBirth?.trim(),
      zip: profile.personal.postCode?.trim(),
      country: nationality,
    });

    // Prefer structured street; keep profile text if geocode returned only city-level.
    const address =
      (geo.streetAddress && geo.streetAddress !== geo.city
        ? geo.streetAddress
        : rawAddress) || rawAddress;
    const city =
      geo.city && !/^n\/?a$/i.test(geo.city) ? geo.city : profile.personal.cityOfBirth?.trim() || 'N/A';
    const zip = geo.zip || profile.personal.postCode?.trim() || '000000';
    const country = geo.country || nationality;

    // Permanent + contact phones / address / zip
    const fills: Array<[string, string]> = [
      ['apply.homePhone', phone],
      ['apply.homeMobile', phone],
      ['apply.homeAddress', address],
      ['apply.homeCity', city],
      ['apply.homeZip', zip],
      ['apply.contactPhone', phone],
      ['apply.contactAddress', address],
      ['apply.contactZip', zip],
      ['apply.receiverName', fullName],
      ['apply.receiverMobile', phone],
      ['apply.receiverCity', city],
      ['apply.receiverAddress', address],
      ['apply.receiverZip', zip],
    ];

    await page.evaluate((rows) => {
      const jq = (
        window as unknown as {
          jQuery?: (el: Element) => {
            val: (v?: string) => { trigger: (e: string) => unknown };
          };
        }
      ).jQuery;
      for (const [name, value] of rows) {
        const el = document.querySelector(
          `input[name="${name}"]`,
        ) as HTMLInputElement | null;
        if (!el || !value) {
          continue;
        }
        el.value = value;
        el.setAttribute('value', value);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        if (typeof jq === 'function') {
          try {
            jq(el).val(value).trigger('change');
          } catch {
            // ignore
          }
        }
      }
    }, fills);

    for (const [name, value] of fills) {
      const empty = await page.evaluate((n) => {
        const el = document.querySelector(
          `input[name="${n}"]`,
        ) as HTMLInputElement | null;
        return !el || !el.value?.trim();
      }, name);
      if (empty) {
        await this.setInputValueJs(page, `input[name="${name}"]`, value);
      }
    }

    // Country selects
    for (const [sel, label] of [
      ['select[name="apply.homeCountryId"]', country],
      ['select[name="apply.receiverCountryId"]', country],
    ] as const) {
      if ((await page.locator(sel).count()) === 0) {
        continue;
      }
      await this.fillSelectControl(
        page,
        {
          selector: sel,
          type: 'select',
          required: false,
          mapsTo: 'personal.nationality',
          labelHint: 'Country',
        },
        page.locator(sel).first(),
        label,
      ).catch(() => undefined);
    }

    // isSame → "Same as the Permanent address" (hides contact requireds)
    await page.evaluate(() => {
      const radios = [
        ...document.querySelectorAll('input[name="apply.isSame"]'),
      ] as HTMLInputElement[];
      const labelOf = (radio: HTMLInputElement) => {
        const wrap = radio.closest('label');
        if (wrap?.textContent) {
          return wrap.textContent;
        }
        return radio.parentElement?.textContent || '';
      };
      const same = radios.find((r) =>
        /same as|permanent address/i.test(labelOf(r)),
      );
      const target =
        same ||
        radios.find((r) => r.value === '1') ||
        radios[0];
      if (!target) {
        return;
      }
      for (const r of radios) {
        r.checked = false;
      }
      target.checked = true;
      target.click();
      target.dispatchEvent(new Event('change', { bubbles: true }));
    });

    // Keep Collect-in-person selected, but receiver* still required on PKU — already filled.
    await page.evaluate(() => {
      const radios = [
        ...document.querySelectorAll('input[name="apply.receiverType"]'),
      ] as HTMLInputElement[];
      const labelOf = (radio: HTMLInputElement) => {
        const wrap = radio.closest('label');
        if (wrap?.textContent) {
          return wrap.textContent;
        }
        return radio.parentElement?.textContent || '';
      };
      const inPerson = radios.find((r) =>
        /collect.*in person|in person/i.test(labelOf(r)),
      );
      if (!inPerson) {
        return;
      }
      for (const r of radios) {
        r.checked = false;
      }
      inPerson.checked = true;
      inPerson.click();
      inPerson.dispatchEvent(new Event('change', { bubbles: true }));
    });

    await this.closeDatePickers(page);
    await this.dismissFormOverlays(page);
  }

  /**
   * Step 4: criminal record = No; fill both Family rows (duplicate fm.* names);
   * financial supporter + emergency zip. Missing duty/workplace → "unemployed".
   */
  private async ensurePkuStep4RequiredGaps(
    page: Page,
    profile: StudentProfile,
  ): Promise<void> {
    await this.wizardNavigator.waitForProcessingDone(page, 60_000);
    await this.dismissFormOverlays(page);
    await this.closeDatePickers(page);

    // Criminal record → No (value=0 on 17gz)
    await page.evaluate(() => {
      const no = document.querySelector(
        'input[name="applyEx.hasCriminalRecord"][value="0"]',
      ) as HTMLInputElement | null;
      const yes = document.querySelector(
        'input[name="applyEx.hasCriminalRecord"][value="1"]',
      ) as HTMLInputElement | null;
      if (no) {
        if (yes) {
          yes.checked = false;
        }
        no.checked = true;
        no.click();
        no.dispatchEvent(new Event('input', { bubbles: true }));
        no.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    const fullName =
      [profile.personal.surname, profile.personal.givenName]
        .filter(Boolean)
        .join(' ')
        .trim() || 'Applicant';
    const phone =
      profile.personal.phone?.trim() ||
      profile.guarantor?.phone?.trim() ||
      '13800000000';
    const email =
      profile.personal.email?.trim() ||
      profile.guarantor?.email?.trim() ||
      'applicant@example.com';
    const nationality =
      profile.personal.nationality?.trim() || 'Russian Federation';
    const address =
      profile.personal.permanentAddress?.trim() ||
      profile.guarantor?.homeAddress?.trim() ||
      'N/A';
    const zip = profile.personal.postCode?.trim() || '000000';

    const familySlots = [0, 1].map((i) => {
      const fm = profile.familyMembers?.[i];
      const fallbackName =
        i === 0
          ? profile.guarantor?.name?.trim() || fullName
          : profile.emergencyContact?.name?.trim() ||
            profile.guarantor?.name?.trim() ||
            fullName;
      const fallbackPhone =
        i === 0
          ? profile.guarantor?.phone?.trim() || phone
          : profile.emergencyContact?.phone?.trim() ||
            profile.guarantor?.phone?.trim() ||
            phone;
      const fallbackEmail =
        i === 0
          ? profile.guarantor?.email?.trim() || email
          : profile.emergencyContact?.email?.trim() ||
            profile.guarantor?.email?.trim() ||
            email;
      const fallbackCompany =
        i === 0
          ? profile.guarantor?.company?.trim()
          : profile.emergencyContact?.company?.trim() ||
            profile.guarantor?.company?.trim();
      const fallbackPosition =
        i === 0
          ? profile.guarantor?.position?.trim()
          : profile.emergencyContact?.company
            ? undefined
            : profile.guarantor?.position?.trim();

      const relationshipRaw =
        fm?.relationship?.trim() ||
        (i === 0
          ? profile.guarantor?.relationship?.trim()
          : profile.emergencyContact?.relationship?.trim()) ||
        (i === 0 ? 'Father' : 'Mother');

      return {
        relative: this.normalizeFamilyRelationship(relationshipRaw),
        name: fm?.fullName?.trim() || fallbackName,
        phone: fm?.phone?.trim() || fallbackPhone,
        email: fm?.email?.trim() || fallbackEmail,
        duty: fm?.position?.trim() || fallbackPosition || 'unemployed',
        workPlace: fm?.company?.trim() || fallbackCompany || 'unemployed',
        nationality: fm?.nationality?.trim() || nationality,
        bornedDate: this.familyBirthDateFromAge(fm?.age),
      };
    });

    await page.evaluate((slots) => {
      const jq = (
        window as unknown as {
          jQuery?: (el: Element) => {
            val: (v?: string) => { trigger: (e: string) => unknown };
          };
        }
      ).jQuery;

      const setInput = (name: string, index: number, value: string) => {
        const els = [
          ...document.querySelectorAll(`input[name="${name}"]`),
        ] as HTMLInputElement[];
        const el = els[index];
        if (!el || !value) {
          return;
        }
        el.focus();
        el.value = value;
        el.setAttribute('value', value);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.dispatchEvent(new Event('blur', { bubbles: true }));
        if (typeof jq === 'function') {
          try {
            jq(el).val(value).trigger('input');
            jq(el).val(value).trigger('change');
          } catch {
            // ignore
          }
        }
      };

      const setSelectByLabel = (name: string, index: number, label: string) => {
        const sels = [
          ...document.querySelectorAll(`select[name="${name}"]`),
        ] as HTMLSelectElement[];
        const sel = sels[index];
        if (!sel || !label) {
          return;
        }
        const want = label.trim().toLowerCase();
        const opt = Array.from(sel.options).find((o) => {
          const t = o.text.replace(/\s+/g, ' ').trim().toLowerCase();
          return t === want || t.includes(want) || want.includes(t);
        });
        if (!opt?.value) {
          return;
        }
        sel.value = opt.value;
        sel.dispatchEvent(new Event('input', { bubbles: true }));
        sel.dispatchEvent(new Event('change', { bubbles: true }));
        if (typeof jq === 'function') {
          try {
            jq(sel).val(opt.value).trigger('chosen:updated');
            jq(sel).val(opt.value).trigger('change');
          } catch {
            // ignore
          }
        }
      };

      for (let i = 0; i < slots.length; i += 1) {
        const s = slots[i];
        setSelectByLabel('fm.relativeId', i, s.relative);
        setSelectByLabel('fm.countryId', i, s.nationality);
        setInput('fm.name', i, s.name);
        setInput('fm.phone', i, s.phone);
        setInput('fm.email', i, s.email);
        setInput('fm.duty', i, s.duty);
        setInput('fm.workPlace', i, s.workPlace);
        if (s.bornedDate) {
          setInput('fm.bornedDate', i, s.bornedDate);
        }
      }
    }, familySlots);

    const selfWork =
      profile.personal.currentInstitution?.trim() ||
      profile.workExperience?.[0]?.company?.trim() ||
      profile.education?.[0]?.institution?.trim() ||
      'unemployed';

    const singleFills: Array<[string, string]> = [
      ['apply.selfSupporter', fullName],
      ['apply.selfphone', phone],
      ['apply.selfwork', selfWork],
      [
        'apply.ssrelative',
        profile.guarantor?.relationship?.trim() || 'Self',
      ],
      ['apply.selfaddress', address],
      ['apply.selfemail', email],
      [
        'apply.emergencyName',
        profile.emergencyContact?.name?.trim() ||
          profile.guarantor?.name?.trim() ||
          fullName,
      ],
      [
        'apply.emergencyMobile',
        profile.emergencyContact?.phone?.trim() ||
          profile.guarantor?.phone?.trim() ||
          phone,
      ],
      [
        'apply.emergencyPhone',
        profile.emergencyContact?.phone?.trim() ||
          profile.guarantor?.phone?.trim() ||
          phone,
      ],
      [
        'apply.emergencyEmail',
        profile.emergencyContact?.email?.trim() ||
          profile.guarantor?.email?.trim() ||
          email,
      ],
      [
        'apply.emergencyAddress',
        profile.emergencyContact?.homeAddress?.trim() ||
          profile.guarantor?.homeAddress?.trim() ||
          address,
      ],
      ['apply.emergencyZip', zip],
    ];

    await page.evaluate((rows) => {
      const jq = (
        window as unknown as {
          jQuery?: (el: Element) => {
            val: (v?: string) => { trigger: (e: string) => unknown };
          };
        }
      ).jQuery;
      for (const [name, value] of rows) {
        const el = document.querySelector(
          `input[name="${name}"], textarea[name="${name}"]`,
        ) as HTMLInputElement | null;
        if (!el || !value) {
          continue;
        }
        // Don't wipe a longer already-filled value (OCR / prior fill).
        if (el.value?.trim() && el.value.trim().length >= value.trim().length) {
          continue;
        }
        el.value = value;
        el.setAttribute('value', value);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        if (typeof jq === 'function') {
          try {
            jq(el).val(value).trigger('change');
          } catch {
            // ignore
          }
        }
      }
    }, singleFills);

    // Force-empty requireds that skip-if-filled left blank
    for (const [name, value] of singleFills) {
      const empty = await page.evaluate((n) => {
        const el = document.querySelector(
          `input[name="${n}"]`,
        ) as HTMLInputElement | null;
        return !el || !el.value?.trim();
      }, name);
      if (empty) {
        await this.setInputValueJs(page, `input[name="${name}"]`, value);
      }
    }

    await this.closeDatePickers(page);
    await this.dismissFormOverlays(page);
  }

  private normalizeFamilyRelationship(raw: string): string {
    const v = raw.trim().toLowerCase();
    if (/father|папа|отец|dad/.test(v)) {
      return 'Father';
    }
    if (/mother|мама|мать|mom/.test(v)) {
      return 'Mother';
    }
    if (/spouse|husband|wife|супруг|муж|жена/.test(v)) {
      return 'Spouse';
    }
    if (/brother|брат/.test(v)) {
      return 'Brother';
    }
    if (/sister|сестра/.test(v)) {
      return 'Sister';
    }
    if (/uncle|дядя/.test(v)) {
      return 'Uncle';
    }
    if (/child|сын|дочь|дети/.test(v)) {
      return 'Children';
    }
    // Already a valid 17gz option?
    const known = [
      'Father',
      'Mother',
      'Spouse',
      'Uncle',
      'Brother',
      'Sister',
      'Others',
      'Children',
    ];
    const hit = known.find((k) => k.toLowerCase() === v);
    return hit || 'Others';
  }

  private familyBirthDateFromAge(age?: number): string | undefined {
    if (age === undefined || age === null || Number.isNaN(age) || age < 1) {
      return undefined;
    }
    const year = new Date().getFullYear() - Math.floor(age);
    return `${year}-01-01`;
  }

  /**
   * Step 3: education rows + China/work history = No.
   * CSU (and some 17gz skins) require ALL pre-rendered education blocks
   * (Delete just warns) — mirror the same school into every row.
   */
  private async ensurePkuStep3RequiredGaps(
    page: Page,
    profile: StudentProfile,
  ): Promise<void> {
    await this.dismissFormOverlays(page);
    await this.closeDatePickers(page);

    const edu = profile.education?.[0];
    const school =
      edu?.institution?.trim() ||
      profile.personal.currentInstitution?.trim() ||
      'High School';
    const major = edu?.major?.trim() || 'General Studies';
    const start = edu?.periodStart?.trim() || '2018-09-01';
    const end = edu?.periodEnd?.trim() || '2022-06-30';
    const nationality =
      profile.personal.nationality?.trim() || 'Russian Federation';
    const degreeNeedles = [
      edu?.degree?.trim() || '',
      'Senior high',
      'High school',
      'Bachelor',
      '高中',
      '本科',
    ].filter(Boolean);

    await page.evaluate(
      ({ school, major, start, end, degreeNeedles, nationality }) => {
        const jq = (
          window as unknown as {
            jQuery?: (el: Element) => {
              val: (v: string) => { trigger: (e: string) => unknown };
            };
          }
        ).jQuery;

        const setInput = (input: HTMLInputElement, value: string) => {
          if (!value) {
            return;
          }
          input.value = value;
          input.setAttribute('value', value);
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
          input.dispatchEvent(new Event('blur', { bubbles: true }));
          if (typeof jq === 'function') {
            try {
              jq(input).val(value).trigger('change');
            } catch {
              // ignore
            }
          }
        };

        const setSelect = (
          select: HTMLSelectElement,
          needles: string[],
          force = false,
        ) => {
          if (needles.length === 0) {
            return;
          }
          const cur = (select.options[select.selectedIndex]?.text || '')
            .trim()
            .toLowerCase();
          if (
            !force &&
            cur &&
            !/please|choose|-choose-|^$/.test(cur)
          ) {
            return;
          }
          const lowered = needles.map((n) => n.toLowerCase());
          const match = [...select.options].find((opt) => {
            const t = (opt.textContent || '').trim().toLowerCase();
            return lowered.some(
              (n) => n && (t === n || t.includes(n) || n.includes(t)),
            );
          });
          if (!match?.value) {
            return;
          }
          select.value = match.value;
          select.dispatchEvent(new Event('change', { bubbles: true }));
          if (typeof jq === 'function') {
            try {
              jq(select).val(match.value).trigger('chosen:updated');
              jq(select).val(match.value).trigger('change');
            } catch {
              // ignore
            }
          }
        };

        const setAllInputs = (name: string, value: string) => {
          for (const el of document.querySelectorAll(
            `input[name="${name}"]`,
          )) {
            setInput(el as HTMLInputElement, value);
          }
        };

        const setAllSelects = (
          name: string,
          needles: string[],
          force = true,
        ) => {
          for (const el of document.querySelectorAll(
            `select[name="${name}"]`,
          )) {
            setSelect(el as HTMLSelectElement, needles, force);
          }
        };

        // Every No.1 / No.2 / No.3 block — same school (Delete is blocked on CSU)
        setAllInputs('sh.startDate', start);
        setAllInputs('sh.endDate', end);
        setAllInputs('sh.studyPlace', school);
        setAllInputs('sh.stuhisMajor', major);
        setAllSelects('sh.educationId', degreeNeedles, true);
        setAllSelects(
          'sh.countryId',
          [nationality, 'russian', 'russia', '俄罗斯'],
          true,
        );

        // China study / work history → No (fire real click for onclick toggles)
        const checkNo = (name: string) => {
          const no = document.querySelector(
            `input[type="radio"][name="${name}"][value="0"]`,
          ) as HTMLInputElement | null;
          const yes = document.querySelector(
            `input[type="radio"][name="${name}"][value="1"]`,
          ) as HTMLInputElement | null;
          if (!no) {
            return;
          }
          if (yes) {
            yes.checked = false;
          }
          no.checked = true;
          const label = no.closest('label');
          if (label) {
            label.click();
          } else {
            no.click();
          }
          no.dispatchEvent(new Event('change', { bubbles: true }));
        };

        checkNo('applyEx.haveStudiedInChina');
        checkNo('applyEx.haveWorkHistory');
        checkNo('haveWorkHistory');
      },
      { school, major, start, end, degreeNeedles, nationality },
    );

    // Playwright backup for China = No
    await this.checkRadioGroupNo(page, 'applyEx.haveStudiedInChina');
    await this.checkRadioGroupNo(page, 'applyEx.haveWorkHistory');
    await this.checkRadioGroupNo(page, 'haveWorkHistory');
    await this.checkRadioNearLabel(
      page,
      /studied online or offline|studied in China|在中国.*学习/i,
      'No',
    );

    await this.closeDatePickers(page);
    await this.dismissFormOverlays(page);
  }

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
    const rec2Name = profile.emergencyContact?.name?.trim() || rec1Name;
    const rec2Phone = profile.emergencyContact?.phone?.trim() || rec1Phone;
    const rec2Email = profile.emergencyContact?.email?.trim() || rec1Email;
    const rec2Relation =
      profile.emergencyContact?.relationship?.trim() ||
      profile.guarantor?.relationship?.trim() ||
      'Father';
    const rec2Work =
      profile.emergencyContact?.company?.trim() ||
      profile.guarantor?.company?.trim() ||
      'N/A';

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
      ['apply.guarSecEnname', rec2Name],
      ['apply.guarSecRelative', rec2Relation],
      ['apply.guarSecWork', rec2Work],
      ['apply.guarMobile2', rec2Phone],
      ['apply.guarSecPhone', rec2Phone],
      ['apply.guarSecEmail', rec2Email],
      [
        'apply.guarAddress2',
        profile.emergencyContact?.homeAddress?.trim() ||
          profile.guarantor?.homeAddress?.trim() ||
          profile.personal.permanentAddress ||
          'N/A',
      ],
    ];

    // Force-write via JS + jQuery (skip-if-filled was leaving Rec#2 empty on prod).
    const writeResult = await page.evaluate((rows) => {
      const report: Record<string, string> = {};
      const jq = (
        window as unknown as {
          jQuery?: (el: Element) => {
            val: (v?: string) => {
              trigger: (e: string) => unknown;
              length?: number;
            };
          };
        }
      ).jQuery;

      for (const [name, value] of rows) {
        const el = document.querySelector(
          `input[name="${name}"]`,
        ) as HTMLInputElement | null;
        if (!el) {
          report[name] = 'MISSING';
          continue;
        }
        el.focus();
        el.value = value;
        el.setAttribute('value', value);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.dispatchEvent(new Event('blur', { bubbles: true }));
        if (typeof jq === 'function') {
          try {
            jq(el).val(value).trigger('input');
            jq(el).val(value).trigger('change');
            jq(el).val(value).trigger('blur');
          } catch {
            // ignore
          }
        }
        report[name] = el.value?.trim() ? 'OK' : 'EMPTY_AFTER_SET';
      }
      return report;
    }, fills);

    // Language proficiency selects (undergrad Step2 — always present on 17gz)
    await page.evaluate(() => {
      const jq = (
        window as unknown as {
          jQuery?: (el: Element) => {
            val: (v: string) => { trigger: (e: string) => unknown };
          };
        }
      ).jQuery;

      const setSelect = (name: string, needles: string[]) => {
        const select = document.querySelector(
          `select[name="${name}"]`,
        ) as HTMLSelectElement | null;
        if (!select) {
          return;
        }
        const cur = (select.options[select.selectedIndex]?.text || '')
          .trim()
          .toLowerCase();
        if (cur && !/please|choose|-choose-|^$/.test(cur)) {
          return;
        }
        const match = [...select.options].find((opt) => {
          const t = (opt.textContent || '').trim().toLowerCase();
          return needles.some((n) => t === n || t.includes(n));
        });
        if (!match?.value) {
          return;
        }
        select.value = match.value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        if (typeof jq === 'function') {
          try {
            jq(select).val(match.value).trigger('chosen:updated');
            jq(select).val(match.value).trigger('change');
          } catch {
            // ignore
          }
        }
      };

      setSelect('apply.languageSkillId', ['none', '无', 'poor']);
      setSelect('apply.hskId', ['none', '无']);
      setSelect('apply.hskOralId', ['none', '无', 'primary']);
      setSelect('apply.englishLanguageSkillId', [
        'good',
        'excellent',
        'fair',
        'none',
      ]);
      setSelect('apply.yydjzs', [
        'native language',
        'native speaker',
        'none',
        'other',
      ]);
    });

    // Playwright fill backup for anything still empty / missing from evaluate quirks
    for (const [name, value] of fills) {
      if (writeResult[name] === 'OK') {
        continue;
      }
      const loc = page.locator(`input[name="${name}"]`).first();
      if ((await loc.count()) === 0) {
        continue;
      }
      await loc.scrollIntoViewIfNeeded().catch(() => undefined);
      await loc
        .fill(value, { force: true, timeout: 5_000 })
        .catch(async () => {
          await this.setInputValueJs(page, `input[name="${name}"]`, value);
        });
    }

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

  /** Hard-fail before Next if present Rec#2 / cert date fields still empty. */
  private async assertPkuStep2CriticalFilled(
    page: Page,
    profile: StudentProfile,
  ): Promise<void> {
    // Only assert nodes that exist — undergrad skins omit Rec#2 / research fields.
    const critical = [
      'apply.yydjzsScore',
      'apply.yydjzsIssueDate',
      'apply.guarantorEnname',
      'apply.guarRelation',
      'apply.guarWorkplace',
      'apply.guarPhone',
      'apply.guarEmail',
      'apply.guarSecEnname',
      'apply.guarSecRelative',
      'apply.guarSecWork',
      'apply.guarSecPhone',
      'apply.guarSecEmail',
    ];

    const empty = await page.evaluate((names) => {
      return names.filter((name) => {
        const el = document.querySelector(
          `input[name="${name}"]`,
        ) as HTMLInputElement | null;
        if (!el) {
          return false;
        }
        const style = getComputedStyle(el);
        if (
          style.display === 'none' ||
          style.visibility === 'hidden' ||
          el.offsetParent === null
        ) {
          return false;
        }
        return !el.value?.trim();
      });
    }, critical);

    if (empty.length === 0) {
      return;
    }

    await this.ensurePkuStep2RequiredGaps(page, profile);

    const stillEmpty = await page.evaluate((names) => {
      const present = [
        ...document.querySelectorAll('input[name^="apply.guar"]'),
      ].map((el) => (el as HTMLInputElement).name);
      return {
        empty: names.filter((name) => {
          const el = document.querySelector(
            `input[name="${name}"]`,
          ) as HTMLInputElement | null;
          if (!el) {
            return false;
          }
          const style = getComputedStyle(el);
          if (
            style.display === 'none' ||
            style.visibility === 'hidden' ||
            el.offsetParent === null
          ) {
            return false;
          }
          return !el.value?.trim();
        }),
        presentGuar: present.slice(0, 40),
      };
    }, critical);

    if (stillEmpty.empty.length > 0) {
      throw new Error(
        `17gz Step2 critical fields still empty after force-fill: [${stillEmpty.empty.join(', ')}]. ` +
          `Present apply.guar* names: [${stillEmpty.presentGuar.join(', ')}]`,
      );
    }
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
