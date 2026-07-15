import type { FieldConfig, UniversitySchema } from '@uni-apply/shared';

export async function waitForForm(schema: UniversitySchema, timeoutMs = 30_000): Promise<void> {
  const selectors = schema.fields
    .map((field) => field.selector)
    .filter((selector) => selector.length > 0);

  if (selectors.length === 0) {
    await sleep(1000);
    return;
  }

  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (selectors.some((selector) => document.querySelector(selector))) {
      return;
    }

    await sleep(300);
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function humanDelay(minMs = 200, maxMs = 500): Promise<void> {
  const delay = minMs + Math.floor(Math.random() * (maxMs - minMs + 1));
  return sleep(delay);
}

export function findFieldElement(field: FieldConfig): Element | null {
  return document.querySelector(field.selector);
}
