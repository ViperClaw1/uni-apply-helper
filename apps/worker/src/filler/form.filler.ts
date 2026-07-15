import { Injectable } from '@nestjs/common';
import type { FieldConfig, StudentProfile, UniversitySchema } from '@uni-apply/shared';
import type { Page } from 'playwright';
import { FieldMapper } from './field.mapper.js';
import { FileAttacher } from './file.attacher.js';
import { WizardFieldGroups } from './wizard-field-groups.js';
import { WizardNavigator } from './wizard.navigator.js';

@Injectable()
export class FormFiller {
  constructor(
    private readonly fieldMapper: FieldMapper,
    private readonly fileAttacher: FileAttacher,
    private readonly wizardNavigator: WizardNavigator,
    private readonly wizardFieldGroups: WizardFieldGroups,
  ) {}

  async fillFields(
    page: Page,
    profile: StudentProfile,
    fields: FieldConfig[],
    motivationLetterContent?: string,
  ): Promise<void> {
    await this.fillFieldBatch(page, profile, fields, motivationLetterContent);
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
    const wizard = university.wizard;
    if (!wizard) {
      throw new Error(`University "${university.id}" has no wizard config`);
    }

    await this.wizardNavigator.forEachStep(page, wizard, async (step) => {
      const fields = this.wizardFieldGroups.fieldsForStep(university, step);
      await this.validateFields(page, fields);
      await this.fillFieldBatch(
        page,
        profile,
        fields.filter((field) => field.type !== 'file'),
        motivationLetterContent,
      );

      const fileFields = fields.filter((field) => field.type === 'file');
      if (fileFields.length > 0) {
        await this.fileAttacher.attachFiles(page, profile, fileFields);
      }
    });

    await this.wizardNavigator.clickSubmit(page, wizard.submitButtonSelector);
  }

  private async validateFields(page: Page, fields: FieldConfig[]): Promise<void> {
    const missingSelectors: string[] = [];

    for (const field of fields) {
      const count = await page.locator(field.selector).count();
      if (count === 0) {
        missingSelectors.push(field.selector);
      }
    }

    if (missingSelectors.length > 0) {
      throw new Error(`Missing selectors: ${missingSelectors.join(', ')}`);
    }
  }

  private async fillFieldBatch(
    page: Page,
    profile: StudentProfile,
    fields: FieldConfig[],
    motivationLetterContent?: string,
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

      await this.fillField(page, field, value);
    }
  }

  private async fillField(page: Page, field: FieldConfig, value: unknown) {
    const locator = page.locator(field.selector);
    const normalizedValue = String(value);

    switch (field.type) {
      case 'select':
        await locator.selectOption({ label: normalizedValue }).catch(async () => {
          await locator.selectOption(normalizedValue);
        });
        break;
      case 'radio':
        await page
          .locator(`${field.selector}[value="${normalizedValue}"]`)
          .check();
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
