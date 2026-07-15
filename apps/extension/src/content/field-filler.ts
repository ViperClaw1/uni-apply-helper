import {
  getFieldValue,
  toBoolean,
  type FieldConfig,
  type StudentProfile,
} from '@uni-apply/shared';
import type { FieldFillResult } from '../shared/messages';
import { findFieldElement, humanDelay } from './form-detector';

export async function fillFields(
  fields: FieldConfig[],
  profile: StudentProfile,
  motivationLetter?: string,
): Promise<FieldFillResult[]> {
  const results: FieldFillResult[] = [];

  for (const field of fields) {
    if (field.type === 'file') {
      continue;
    }

    const el = findFieldElement(field);

    if (!el) {
      results.push({ selector: field.selector, status: 'missing', label: field.mapsTo ?? field.type });
      continue;
    }

    const value = getFieldValue(profile, field, motivationLetter);

    if (value === undefined || value === null || value === '') {
      results.push({
        selector: field.selector,
        status: field.required ? 'missing' : 'skipped',
        label: field.mapsTo ?? field.type,
      });
      continue;
    }

    await humanDelay();
    fillElement(el as HTMLElement, field, value);
    results.push({ selector: field.selector, status: 'filled', label: field.mapsTo ?? field.type });
  }

  return results;
}

function fillElement(element: HTMLElement, field: FieldConfig, value: unknown) {
  const normalizedValue = String(value);

  if (element instanceof HTMLSelectElement) {
    const option =
      [...element.options].find((item) => item.text.trim() === normalizedValue) ??
      [...element.options].find((item) => item.value === normalizedValue);

    if (option) {
      element.value = option.value;
      element.dispatchEvent(new Event('change', { bubbles: true }));
    }

    return;
  }

  if (element instanceof HTMLInputElement) {
    if (field.type === 'radio') {
      const radio = document.querySelector<HTMLInputElement>(
        `${field.selector}[value="${CSS.escape(normalizedValue)}"]`,
      );

      if (radio) {
        radio.checked = true;
        radio.dispatchEvent(new Event('change', { bubbles: true }));
      }

      return;
    }

    if (field.type === 'checkbox') {
      element.checked = toBoolean(value);
      element.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }

    if (field.type === 'file') {
      return;
    }
  }

  if (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement
  ) {
    element.focus();
    element.value = normalizedValue;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    element.blur();
  }
}
