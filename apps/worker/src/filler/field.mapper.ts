import { Injectable } from '@nestjs/common';
import type { FieldConfig, StudentProfile } from '@uni-apply/shared';
import get from 'lodash/get.js';

@Injectable()
export class FieldMapper {
  getValue(
    profile: StudentProfile,
    field: FieldConfig,
    motivationLetterContent?: string,
  ): unknown {
    if (field.type === 'essay' && !field.mapsTo) {
      return motivationLetterContent;
    }

    if (!field.mapsTo) {
      return this.getUnmappedDefault(field);
    }

    const mapped = get(profile, field.mapsTo);
    if (mapped !== undefined && mapped !== null && mapped !== '') {
      return mapped;
    }

    // Profile gap — fall back to schema options (CUCAS static defaults).
    return this.getUnmappedDefault(field);
  }

  /**
   * Required form controls without a profile mapping (CUCAS declaration,
   * passport type, study dates, occupation, …).
   */
  private getUnmappedDefault(field: FieldConfig): unknown {
    if (field.type === 'checkbox') {
      return true;
    }

    if (field.type === 'file') {
      return undefined;
    }

    const fromOptions = this.firstRealOption(field.options);
    if (fromOptions !== undefined) {
      return fromOptions;
    }

    return undefined;
  }

  private firstRealOption(options?: string[]): string | undefined {
    if (!options?.length) {
      return undefined;
    }

    return options.find(
      (option) =>
        option.trim().length > 0 &&
        !/^\.\.\.?please select/i.test(option) &&
        !/^please select/i.test(option) &&
        !/^-+select-*$/i.test(option),
    );
  }
}

