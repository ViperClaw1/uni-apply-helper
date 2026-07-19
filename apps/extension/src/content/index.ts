import { fieldsForStep, type UniversitySchema } from '@uni-apply/shared';
import type { ActiveApplicationResponse } from '../shared/api';
import type { FieldFillResult, FillSession, RuntimeResponse } from '../shared/messages';
import { attachFiles } from './file-attacher';
import { fillFields } from './field-filler';
import { waitForForm } from './form-detector';
import { interceptSubmit } from './submit-interceptor';
import { forEachWizardStep } from './wizard-navigator';

const initializedUrls = new Set<string>();

async function init() {
  const pageKey = window.location.href;

  if (initializedUrls.has(pageKey)) {
    return;
  }

  const response = (await chrome.runtime.sendMessage({
    type: 'GET_ACTIVE_APPLICATION',
    url: window.location.href,
  })) as RuntimeResponse;

  if (!response.ok || !response.application) {
    console.warn(
      '[UniApply] No active application for this URL:',
      window.location.href,
      response,
    );
    return;
  }

  initializedUrls.add(pageKey);

  const application = response.application;
  await runFill(application);
}

async function runFill(application: ActiveApplicationResponse) {
  const { profile, schema, motivationLetter } = application;

  await waitForForm(schema);

  const studentName = [profile.personal.givenName, profile.personal.surname]
    .filter(Boolean)
    .join(' ');

  let results: FieldFillResult[] = [];

  if (schema.wizard) {
    await forEachWizardStep(schema, async (step) => {
      const stepFields = fieldsForStep(schema, step);
      const textFields = stepFields.filter((field) => field.type !== 'file');
      const fileFields = stepFields.filter((field) => field.type === 'file');

      const stepResults = await fillFields(textFields, profile, motivationLetter);
      const fileResults = await attachFiles(fileFields, profile);

      results = [...results, ...stepResults, ...fileResults];

      const session: FillSession = {
        applicationId: application.applicationId,
        studentName,
        universityName: application.university.displayName,
        results,
        wizardStep: step,
        wizardTotalSteps: schema.wizard?.totalSteps,
      };

      await chrome.runtime.sendMessage({ type: 'FIELDS_FILLED', session });
    });
  } else {
    const textFields = schema.fields.filter((field) => field.type !== 'file');
    const fileFields = schema.fields.filter((field) => field.type === 'file');

    results = [
      ...(await fillFields(textFields, profile, motivationLetter)),
      ...(await attachFiles(fileFields, profile)),
    ];
  }

  const session: FillSession = {
    applicationId: application.applicationId,
    studentName,
    universityName: application.university.displayName,
    results,
    wizardTotalSteps: schema.wizard?.totalSteps,
  };

  await chrome.runtime.sendMessage({ type: 'FIELDS_FILLED', session });
  interceptSubmit(application.applicationId, schema);
}

void init();
