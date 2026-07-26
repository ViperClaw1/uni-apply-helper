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

    // Virtual path — CUCAS recipient / display name fields.
    if (field.mapsTo === 'personal.fullName') {
      const full = [profile.personal.surname, profile.personal.givenName]
        .filter(Boolean)
        .join(' ')
        .trim();
      if (full) {
        return full;
      }
    }

    if (field.mapsTo === 'personal.sex') {
      const sex = get(profile, 'personal.sex');
      if (sex !== undefined && sex !== null && sex !== '') {
        return this.normalizeSex(String(sex));
      }
    }

    if (field.mapsTo === 'personal.maritalStatus') {
      const marital = get(profile, 'personal.maritalStatus');
      if (marital !== undefined && marital !== null && marital !== '') {
        return this.normalizeMaritalStatus(String(marital));
      }
      // PKU requires marital status — default Unmarried when profile empty
      return 'Unmarried';
    }

    const mapped = get(profile, field.mapsTo);
    if (mapped !== undefined && mapped !== null && mapped !== '') {
      return mapped;
    }

    // Institution of highest diploma — fall back to education history.
    if (
      field.selector?.includes('lastSchool') ||
      /institution of highest/i.test(field.labelHint || '')
    ) {
      const fromEducation = profile.education?.[0]?.institution?.trim();
      if (fromEducation) {
        return fromEducation;
      }
      return 'Higher Education Institution';
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

  private normalizeSex(value: string): string {
    const v = value.trim().toLowerCase();
    if (
      ['f', 'female', 'woman', 'ж', 'жен', 'женский'].includes(v) ||
      v.startsWith('fem')
    ) {
      return 'Female';
    }
    if (
      ['m', 'male', 'man', 'м', 'муж', 'мужской'].includes(v) ||
      v.startsWith('mal')
    ) {
      return 'Male';
    }
    return value;
  }

  private normalizeMaritalStatus(value: string): string {
    const v = value.trim().toLowerCase();
    if (
      ['unmarried', 'single', 'холост', 'не замужем', 'незамужем', 'single'].includes(
        v,
      ) ||
      v.includes('unmar') ||
      v.includes('single')
    ) {
      return 'Unmarried';
    }
    if (
      ['married', 'женат', 'замужем'].includes(v) ||
      v.includes('marri')
    ) {
      return 'Married';
    }
    return value;
  }
}

