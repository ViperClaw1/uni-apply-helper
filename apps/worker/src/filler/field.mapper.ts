import { Injectable } from '@nestjs/common';
import type { FieldConfig, StudentProfile } from '@uni-apply/shared';
import { mapsToPaths } from '@uni-apply/shared';
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

    // PKU Step 2: research area / study duration / supervisor
    if (
      field.selector?.includes('fieldEnglish') ||
      field.selector?.includes('fieldName') ||
      /area of research/i.test(field.labelHint || '')
    ) {
      return this.resolveResearchArea(profile);
    }

    if (field.selector?.includes('studyStartDate')) {
      return '2026-09-01';
    }
    if (field.selector?.includes('studyEndDate')) {
      return '2027-06-30';
    }

    // Native Language cert still requires score + issue date on PKU.
    if (field.selector?.includes('yydjzsScore')) {
      return 'N/A';
    }
    if (field.selector?.includes('yydjzsIssueDate')) {
      return '2020-01-01';
    }

    // PKU Recommender #2 — resolve from emergencyContact → guarantor regardless of mapsTo shape
    if (/guarSecEnname/i.test(field.selector || '')) {
      return (
        profile.emergencyContact?.name?.trim() ||
        profile.guarantor?.name?.trim() ||
        [profile.personal.surname, profile.personal.givenName]
          .filter(Boolean)
          .join(' ')
          .trim() ||
        'Recommender'
      );
    }
    if (/guarSecRelative/i.test(field.selector || '')) {
      return (
        profile.emergencyContact?.relationship?.trim() ||
        profile.guarantor?.relationship?.trim() ||
        'Father'
      );
    }
    if (/guarSecWork/i.test(field.selector || '')) {
      return (
        profile.emergencyContact?.company?.trim() ||
        profile.guarantor?.company?.trim() ||
        'N/A'
      );
    }
    if (/guarSecPhone|guarMobile2/i.test(field.selector || '')) {
      return (
        profile.emergencyContact?.phone?.trim() ||
        profile.guarantor?.phone?.trim() ||
        profile.personal.phone ||
        '13800000000'
      );
    }
    if (/guarSecEmail/i.test(field.selector || '')) {
      return (
        profile.emergencyContact?.email?.trim() ||
        profile.guarantor?.email?.trim() ||
        profile.personal.email ||
        'recommender@example.com'
      );
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

    const paths = mapsToPaths(field.mapsTo);
    if (paths.length === 0) {
      return this.getUnmappedDefault(field);
    }

    for (const path of paths) {
      const value = this.resolvePathValue(profile, field, path);
      if (value !== undefined && value !== null && value !== '') {
        return value;
      }
    }

    // Soft defaults after the whole fallback chain is empty.
    if (
      this.pathsInclude(paths, 'guarantor.relationship') ||
      this.pathsInclude(paths, 'emergencyContact.relationship') ||
      /guarRelation|guarSecRelative/i.test(field.selector || '')
    ) {
      return field.selector?.includes('Sec') ? 'Father' : 'Mother';
    }
    if (
      this.pathsInclude(paths, 'guarantor.company') ||
      this.pathsInclude(paths, 'emergencyContact.company') ||
      /guarWorkplace|guarSecWork/i.test(field.selector || '')
    ) {
      return 'N/A';
    }
    if (
      this.pathsInclude(paths, 'guarantor.nationality') ||
      this.pathsInclude(paths, 'emergencyContact.nationality') ||
      /guarCountryId/i.test(field.selector || '')
    ) {
      return profile.personal.nationality || 'Russian Federation';
    }
    if (
      (this.pathsInclude(paths, 'guarantor.name') ||
        this.pathsInclude(paths, 'emergencyContact.name') ||
        /guarantorEnname|guarSecEnname/i.test(field.selector || '')) &&
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
      (this.pathsInclude(paths, 'guarantor.phone') ||
        this.pathsInclude(paths, 'emergencyContact.phone') ||
        /guarPhone|guarMobile|guarSecPhone|guarMobile2/i.test(
          field.selector || '',
        )) &&
      field.required
    ) {
      return profile.personal.phone || '13800000000';
    }
    if (
      (this.pathsInclude(paths, 'guarantor.email') ||
        this.pathsInclude(paths, 'emergencyContact.email') ||
        /guarEmail|guarSecEmail/i.test(field.selector || '')) &&
      field.required
    ) {
      return profile.personal.email || 'recommender@example.com';
    }

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

    return this.getUnmappedDefault(field);
  }

  private resolvePathValue(
    profile: StudentProfile,
    field: FieldConfig,
    path: string,
  ): unknown {
    if (path === 'personal.fullName') {
      const full = [profile.personal.surname, profile.personal.givenName]
        .filter(Boolean)
        .join(' ')
        .trim();
      if (full) {
        return full;
      }
      return undefined;
    }

    if (path === 'personal.sex') {
      const sex = get(profile, 'personal.sex');
      if (sex !== undefined && sex !== null && sex !== '') {
        return this.normalizeSex(String(sex));
      }
      return undefined;
    }

    if (path === 'personal.maritalStatus') {
      const marital = get(profile, 'personal.maritalStatus');
      if (marital !== undefined && marital !== null && marital !== '') {
        return this.normalizeMaritalStatus(String(marital));
      }
      return field.required ? 'Unmarried' : undefined;
    }

    if (path === 'personal.studiedInChina' || path === 'personal.beenToChina') {
      return this.normalizeYesNo(get(profile, path), 'No');
    }

    if (path === 'emergencyContact.name' && field.required) {
      const name = get(profile, path);
      if (name) {
        return name;
      }
      // Fall through to next mapsTo path / soft default
      return undefined;
    }

    if (
      (path === 'emergencyContact.phone' || path === 'guarantor.phone') &&
      field.required
    ) {
      const phone = get(profile, path);
      if (phone) {
        return phone;
      }
      return undefined;
    }

    const mapped = get(profile, path);
    if (mapped !== undefined && mapped !== null && mapped !== '') {
      return mapped;
    }

    return undefined;
  }

  private pathsInclude(paths: string[], path: string): boolean {
    return paths.includes(path);
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
    // Handles "Женский (Female)", "Female", "f", etc.
    if (
      ['f', 'female', 'woman', 'ж', 'жен', 'женский'].includes(v) ||
      v.startsWith('fem') ||
      /\bfemale\b/.test(v) ||
      /женск/.test(v)
    ) {
      return 'Female';
    }
    if (
      ['m', 'male', 'man', 'м', 'муж', 'мужской'].includes(v) ||
      (v.startsWith('mal') && !v.startsWith('mar')) ||
      (/\bmale\b/.test(v) && !/\bfemale\b/.test(v)) ||
      (/мужск/.test(v) && !/женск/.test(v))
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
