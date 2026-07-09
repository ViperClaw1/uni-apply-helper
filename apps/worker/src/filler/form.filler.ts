import { Injectable } from '@nestjs/common';
import type { FieldConfig, StudentProfile } from '@uni-apply/shared';
import type { Page } from 'playwright';
import { FieldMapper } from './field.mapper.js';
import { FileAttacher } from './file.attacher.js';
import { SubmitHandler } from './submit.handler.js';

@Injectable()
export class FormFiller {
  constructor(
    private readonly fieldMapper: FieldMapper,
    private readonly fileAttacher: FileAttacher,
    private readonly submitHandler: SubmitHandler,
  ) {}

  async fillFields(
    page: Page,
    profile: StudentProfile,
    fields: FieldConfig[],
    motivationLetterContent?: string,
  ): Promise<void> {
    const inputFields = fields.filter((field) => field.type !== 'file');

    for (const field of inputFields) {
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

  async attachFiles(
    page: Page,
    profile: StudentProfile,
    fields: FieldConfig[],
  ): Promise<void> {
    await this.fileAttacher.attachFiles(page, profile, fields);
  }

  async submit(page: Page): Promise<void> {
    await this.submitHandler.submit(page);
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

