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

    // PKU: Current Employer (apply.workplace). Bachelor grads often have none.
    if (
      field.selector?.includes('workplace') ||
      field.selector?.includes('careerName')
    ) {
      const fromProfile =
        get(profile, 'personal.currentInstitution') ||
        profile.education?.[0]?.institution?.trim();
      if (
        fromProfile &&
        !/^currently not studying$/i.test(String(fromProfile)) &&
        !/high school graduate/i.test(String(fromProfile))
      ) {
        return fromProfile;
      }
      return 'High school graduate, no employer';
    }

    // PKU Step 2: research area / study duration / supervisor / recommender gaps
    if (
      field.selector?.includes('fieldEnglish') ||
      field.selector?.includes('fieldName') ||
      /area of research/i.test(field.labelHint || '')
    ) {
      const area = this.resolveResearchArea(profile);
      return area;
    }

    if (field.selector?.includes('studyStartDate')) {
      return '2026-09-01';
    }
    if (field.selector?.includes('studyEndDate')) {
      return '2027-06-30';
    }

    if (
      field.selector?.includes('advisorEn') ||
      (/supervisor/i.test(field.labelHint || '') &&
        /english/i.test(field.labelHint || ''))
    ) {
      return 'To be assigned';
    }
    if (
      field.selector?.includes('advisorConnect') ||
      (/supervisor/i.test(field.labelHint || '') &&
        /contact/i.test(field.labelHint || ''))
    ) {
      return 'N/A';
    }
    if (
      field.selector?.includes('advisor') ||
      /supervisor chinese/i.test(field.labelHint || '')
    ) {
      return '待定';
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

    if (
      field.mapsTo === 'personal.studiedInChina' ||
      field.mapsTo === 'personal.beenToChina'
    ) {
      const raw = get(profile, field.mapsTo);
      return this.normalizeYesNo(raw, 'No');
    }

    // Emergency contact required on PKU step 4 — never leave blank.
    if (field.mapsTo === 'emergencyContact.name' && field.required) {
      const name = get(profile, field.mapsTo);
      if (name) {
        return name;
      }
      return (
        [profile.personal.surname, profile.personal.givenName]
          .filter(Boolean)
          .join(' ')
          .trim() || 'Emergency Contact'
      );
    }

    if (
      (field.mapsTo === 'emergencyContact.phone' ||
        field.selector?.includes('emergencyMobile') ||
        field.selector?.includes('emergencyPhone')) &&
      field.required
    ) {
      const phone =
        get(profile, 'emergencyContact.phone') || profile.personal.phone;
      if (phone) {
        return phone;
      }
      return '13800000000';
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

    // PKU Recommender (guarantor*) — required relationship / org / nationality
    if (
      field.mapsTo === 'guarantor.relationship' ||
      field.selector?.includes('guarRelation')
    ) {
      return 'Mother';
    }
    if (
      field.mapsTo === 'guarantor.company' ||
      field.selector?.includes('guarWorkplace')
    ) {
      return 'N/A';
    }
    if (
      field.mapsTo === 'guarantor.nationality' ||
      field.selector?.includes('guarCountryId')
    ) {
      return profile.personal.nationality || 'Russian Federation';
    }
    if (
      (field.mapsTo === 'guarantor.name' ||
        field.selector?.includes('guarantorEnname')) &&
      field.required
    ) {
      return (
        [profile.personal.surname, profile.personal.givenName]
          .filter(Boolean)
          .join(' ')
          .trim() || 'Recommender'
      );
    }
    if (
      (field.mapsTo === 'guarantor.phone' ||
        field.selector?.includes('guarPhone') ||
        field.selector?.includes('guarMobile')) &&
      field.required
    ) {
      return profile.personal.phone || '13800000000';
    }
    if (
      (field.mapsTo === 'guarantor.email' ||
        field.selector?.includes('guarEmail')) &&
      field.required
    ) {
      return profile.personal.email || 'recommender@example.com';
    }

    // Profile gap — fall back to schema options (CUCAS static defaults).
    return this.getUnmappedDefault(field);
  }

  private resolveResearchArea(profile: StudentProfile): string {
    const fromTarget = profile.applicationTargets?.[0]?.major?.trim();
    if (fromTarget) {
      return fromTarget;
    }
    const fromEducation = profile.education?.[0]?.major?.trim();
    if (fromEducation) {
      return fromEducation;
    }
    return 'Molecular Medicine';
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
      ['unmarried', 'single', 'холост', 'не замужем', 'незамужем'].includes(
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

  private normalizeYesNo(value: unknown, fallback: 'Yes' | 'No'): string {
    if (value === undefined || value === null || value === '') {
      return fallback;
    }
    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }
    const v = String(value).trim().toLowerCase();
    if (['1', 'true', 'yes', 'y', 'да'].includes(v)) {
      return 'Yes';
    }
    if (['0', 'false', 'no', 'n', 'нет'].includes(v)) {
      return 'No';
    }
    return fallback;
  }
}

