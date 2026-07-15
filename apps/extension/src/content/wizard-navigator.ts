import { fieldsForStep, type UniversitySchema, type WizardConfig } from '@uni-apply/shared';
import { sleep } from './form-detector';

export async function dismissBlockingDialogs(): Promise<void> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const okButton = document.querySelector<HTMLElement>(
      '.messager-button .okButton, .messager-button input[value="Ok"], .messager-button input[value="OK"], .el-message-box__btns button, .el-dialog__footer button',
    );

    if (!okButton) {
      break;
    }

    okButton.click();
    await sleep(400);
  }
}

export async function clickNext(wizard: WizardConfig): Promise<boolean> {
  await dismissBlockingDialogs();

  const button =
    document.querySelector<HTMLElement>(wizard.nextButtonSelector) ??
    document.querySelector<HTMLInputElement>('input[value="Save and Next"]') ??
    document.querySelector<HTMLInputElement>('input[value="Next"]');

  if (!button) {
    return false;
  }

  const onclick = button.getAttribute('onclick');

  if (onclick) {
    try {
      const handler = new Function('btn', onclick.replace(/\bthis\b/g, 'btn'));
      handler(button);
    } catch {
      button.click();
    }
  } else {
    button.click();
  }

  await sleep(800);
  await dismissBlockingDialogs();
  return true;
}

export async function forEachWizardStep(
  schema: UniversitySchema,
  onStep: (step: number) => Promise<void>,
): Promise<void> {
  const wizard = schema.wizard;

  if (!wizard) {
    throw new Error('Wizard config is missing');
  }

  for (let step = 1; step <= wizard.totalSteps; step += 1) {
    await onStep(step);

    if (step < wizard.totalSteps) {
      const advanced = await clickNext(wizard);

      if (!advanced) {
        throw new Error(`Failed to advance from wizard step ${step}`);
      }

      await waitForStepFields(schema, step + 1);
    }
  }
}

async function waitForStepFields(schema: UniversitySchema, step: number): Promise<void> {
  const fields = fieldsForStep(schema, step);
  const deadline = Date.now() + 20_000;

  while (Date.now() < deadline) {
    if (fields.some((field) => document.querySelector(field.selector))) {
      return;
    }

    await sleep(300);
  }
}

export function getSubmitButtonSelector(schema: UniversitySchema): string | null {
  return schema.wizard?.submitButtonSelector ?? null;
}
