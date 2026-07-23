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
import { WizardFieldGroups } from './wizard-field-groups.js';
import { WizardNavigator } from './wizard.navigator.js';

@Injectable()
export class FormFiller {
  constructor(
    private readonly configService: ConfigService,
    private readonly fieldMapper: FieldMapper,
    private readonly fileAttacher: FileAttacher,
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

    await this.wizardNavigator.forEachStep(page, wizard, async (step) => {
      const fields = this.wizardFieldGroups.fieldsForStep(university, step);
      await this.fillFieldBatch(
        page,
        profile,
        fields.filter((field) => field.type !== 'file'),
        motivationLetterContent,
        fillMode,
      );

      const fileFields = fields.filter((field) => field.type === 'file');
      if (fileFields.length > 0) {
        await this.fileAttacher.attachFiles(page, profile, fileFields);
      }
    });

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
        if (field.required) {
          throw new Error(`Missing required profile value: ${field.mapsTo}`);
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
      if (!locator) {
        if (field.required) {
          throw new Error(
            `Field not found: ${field.selector}${field.labelHint ? ` / "${field.labelHint}"` : ''}`,
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

    switch (field.type) {
      case 'select':
        try {
          await locator.selectOption({ label: normalizedValue });
        } catch {
          try {
            await locator.selectOption(normalizedValue);
          } catch {
            // Chosen / custom UI hides native <select>
            await page.evaluate(
              ({ selector, value }) => {
                const sel = document.querySelector(
                  selector,
                ) as HTMLSelectElement | null;
                if (!sel) {
                  return;
                }

                const opt = [...sel.options].find(
                  (option) =>
                    option.text.trim() === value ||
                    option.value === value ||
                    option.text.trim().toLowerCase().includes(value.toLowerCase()),
                );
                if (!opt) {
                  return;
                }

                sel.value = opt.value;
                const jq = (
                  window as unknown as {
                    jQuery?: (el: Element) => {
                      val: (v: string) => { trigger: (e: string) => unknown };
                    };
                  }
                ).jQuery;
                if (typeof jq === 'function') {
                  try {
                    jq(sel).val(opt.value).trigger('chosen:updated');
                    jq(sel).val(opt.value).trigger('change');
                  } catch {
                    // ignore
                  }
                }

                sel.dispatchEvent(new Event('input', { bubbles: true }));
                sel.dispatchEvent(new Event('change', { bubbles: true }));
              },
              { selector: field.selector, value: normalizedValue },
            );
          }
        }
        break;
      case 'radio':
        if (field.selector) {
          const radio = page
            .locator(`${field.selector}[value="${normalizedValue}"]`)
            .first();
          if ((await radio.count()) > 0) {
            await radio.check();
            break;
          }
        }

        await page
          .getByRole('radio', { name: normalizedValue, exact: false })
          .first()
          .check()
          .catch(() => locator.check());
        break;
      case 'checkbox':
        if (this.toBoolean(value)) {
          await locator.check();
        }
        break;
      case 'textarea':
      case 'essay':
      case 'number':
      case 'text':
        await locator.fill(normalizedValue);
        break;
      case 'file':
        break;
    }
  }

  private toBoolean(value: unknown): boolean {
    if (typeof value === 'boolean') {
      return value;
    }

    return ['true', 'yes', 'да', '1'].includes(String(value).toLowerCase());
  }
}
