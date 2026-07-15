import type { FieldConfig, StudentProfile } from '@uni-apply/shared';
import type { FieldFillResult } from '../shared/messages';
import type { RuntimeResponse } from '../shared/messages';
import { findFieldElement, humanDelay } from './form-detector';

export async function attachFiles(
  fields: FieldConfig[],
  profile: StudentProfile,
): Promise<FieldFillResult[]> {
  const results: FieldFillResult[] = [];

  for (const field of fields) {
    if (field.type !== 'file' || !field.documentType) {
      continue;
    }

    const el = findFieldElement(field) as HTMLInputElement | null;

    if (!el || el.type !== 'file') {
      results.push({
        selector: field.selector,
        status: 'missing',
        label: field.documentType,
      });
      continue;
    }

    const fileUrl = profile.documents[field.documentType];

    if (!fileUrl) {
      results.push({
        selector: field.selector,
        status: 'skipped',
        label: field.documentType,
      });
      continue;
    }

    const response = (await chrome.runtime.sendMessage({
      type: 'FETCH_DOCUMENT',
      url: fileUrl,
    })) as RuntimeResponse;

    if (!response.ok || !response.buffer) {
      results.push({
        selector: field.selector,
        status: 'missing',
        label: field.documentType,
      });
      continue;
    }

    await humanDelay();

    const mimeType = response.mimeType ?? 'application/octet-stream';
    const fileName = response.fileName ?? `${field.documentType}.pdf`;
    const file = new File([response.buffer], fileName, { type: mimeType });
    const dataTransfer = new DataTransfer();

    dataTransfer.items.add(file);
    el.files = dataTransfer.files;
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('input', { bubbles: true }));

    results.push({
      selector: field.selector,
      status: 'filled',
      label: field.documentType,
    });
  }

  return results;
}
