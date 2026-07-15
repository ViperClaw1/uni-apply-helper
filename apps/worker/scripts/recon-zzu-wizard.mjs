import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  closeZzuBrowserSession,
  createZzuBrowserSession,
  loadZzuSession,
} from './zzu-browser.mjs';
import { navigateToZzuWizard } from './zzu-navigation.mjs';
import {
  advancePreWizardScreen,
  detectPreWizardScreen,
  getPreWizardSignature,
  isMainWizard,
  isProgramSelectionEmpty,
} from './zzu-pre-wizard.mjs';
import {
  clickSaveAndNext,
  detectActiveWizardStep,
  dismissBlockingDialogs,
  getStepSignature,
  waitForUiReady,
} from './wizard-step-utils.mjs';
import { fillMinimalVisibleFields } from './zzu-recon-fill.mjs';

async function collectFields(page) {
  return page.evaluate(() => {
    const fields = [];
    for (const el of document.querySelectorAll('input, select, textarea')) {
      const tag = el.tagName.toLowerCase();
      const type = el.getAttribute('type') ?? tag;
      const name = el.getAttribute('name');
      if (type === 'hidden' || type === 'submit' || type === 'button') continue;
      fields.push({
        tag,
        type,
        name,
        id: el.getAttribute('id'),
        label: '',
        selector: name ? `[name="${name}"]` : null,
      });
    }
    return fields;
  });
}

async function collectUploadDocuments(page) {
  return page.evaluate(() => {
    const docs = [];

    for (const list of document.querySelectorAll('.attach-item-list')) {
      const attachTypeName = list.getAttribute('attachTypeName');
      if (!attachTypeName) continue;

      const tr = list.closest('tr');
      const labelCell = tr?.querySelector('td');
      const raw = labelCell?.textContent?.replace(/\s+/g, ' ').trim() ?? attachTypeName;

      docs.push({
        attachTypeId: list.getAttribute('attachTypeId'),
        attachTypeName,
        label: raw.replace(/^\*\s*/, '').slice(0, 200),
        fileCountLimit: list.getAttribute('fileCountLimit') ?? '',
        required: raw.startsWith('*') || /^1-/.test(list.getAttribute('fileCountLimit') ?? ''),
        selector: `[attachTypeId="${list.getAttribute('attachTypeId')}"]`,
      });
    }

    return docs;
  });
}

function isTerminalStep(stepNumber) {
  return stepNumber === 6 || stepNumber === 7;
}

const PRE_WIZARD_LABELS = {
  application_notes: 'Application Notes',
  program_type: 'Program Type Selection',
  program_selection: 'Program Selection',
};

(async () => {
  const session = await createZzuBrowserSession(loadZzuSession(), {
    preferStorageState: true,
  });
  const { page } = session;

  await navigateToZzuWizard(page, undefined, {
    replayMode: true,
    advancePreWizard: false,
  });
  await waitForUiReady(page);

  const steps = [];
  const seen = new Set();
  let lastSignature = null;
  let stallCount = 0;

  for (let attempt = 0; attempt < 20 && steps.length < 12; attempt += 1) {
    await dismissBlockingDialogs(page);

    const preWizard = await detectPreWizardScreen(page);
    const active = await detectActiveWizardStep(page);
    const fields = await collectFields(page);
    const signature = preWizard
      ? await getPreWizardSignature(page, preWizard)
      : await getStepSignature(page, collectFields);
    const uploadDocuments =
      active?.number === 6 ? await collectUploadDocuments(page) : undefined;

    if (!seen.has(signature)) {
      seen.add(signature);
      steps.push({
        index: steps.length + 1,
        attempt,
        phase: preWizard ? 'pre-wizard' : 'wizard',
        preWizardScreen: preWizard,
        preWizardLabel: preWizard ? PRE_WIZARD_LABELS[preWizard] : undefined,
        stepMatch: active,
        signature,
        url: page.url(),
        fields,
        fileInputs: fields.filter((f) => f.type === 'file'),
        uploadDocuments,
      });

      const label = preWizard
        ? PRE_WIZARD_LABELS[preWizard]
        : `step ${active?.number} ${active?.title}`;

      console.log(
        `Collected #${steps.length}: ${label} — ${fields.length} fields${uploadDocuments ? `, ${uploadDocuments.length} doc types` : ''}`,
      );
    }

    if (preWizard === 'program_selection' && (await isProgramSelectionEmpty(page))) {
      console.log('Program selection list empty — terminal for recon');
      break;
    }

    if (isTerminalStep(active?.number)) {
      console.log(`Terminal step ${active.number} — skip save loop`);
      break;
    }

    let advanced = false;

    if (preWizard) {
      advanced = await advancePreWizardScreen(page, preWizard);
      console.log(`  pre-wizard advance (${preWizard}): ${advanced}`);
    } else if (await isMainWizard(page)) {
      await fillMinimalVisibleFields(page);
      advanced = await clickSaveAndNext(page, collectFields);
      console.log(`  wizard save attempt ${attempt + 1}: ${advanced}`);
    } else {
      console.log('  unknown screen, stopping');
      break;
    }

    if (!advanced) {
      await dismissBlockingDialogs(page);

      if (signature === lastSignature) {
        stallCount += 1;
        if (stallCount >= 2) {
          console.log(`Stuck on ${preWizard ?? `step ${active?.number}`}, stopping`);
          break;
        }
      } else {
        stallCount = 1;
      }
    } else {
      stallCount = 0;
    }

    lastSignature = signature;
  }

  writeFileSync(resolve(process.cwd(), 'zzu-wizard-recon.json'), JSON.stringify({ steps }, null, 2));
  console.log(`Done: ${steps.length} unique step signatures`);

  await closeZzuBrowserSession(session);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
