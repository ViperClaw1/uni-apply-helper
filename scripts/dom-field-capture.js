/**
 * Paste into browser DevTools console on each wizard step (or single-page form).
 * Copy the printed JSON into a file, repeat per step, merge into captures[] array.
 */
(function captureDomFields() {
  function escapeAttr(value) {
    return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }

  function getLabel(el) {
    const id = el.getAttribute('id');

    if (id) {
      const byFor = document.querySelector(`label[for="${CSS.escape(id)}"]`);

      if (byFor?.textContent) {
        return byFor.textContent.replace(/\s+/g, ' ').trim();
      }
    }

    const parentLabel = el.closest('label');

    if (parentLabel?.textContent) {
      return parentLabel.textContent.replace(/\s+/g, ' ').trim().slice(0, 200);
    }

    const cell = el.closest('td, th, .form-group, .el-form-item');

    if (cell) {
      const labelEl = cell.querySelector('label, .el-form-item__label, th');

      if (labelEl?.textContent) {
        return labelEl.textContent.replace(/\s+/g, ' ').trim().slice(0, 200);
      }
    }

    return (
      el.getAttribute('placeholder') ||
      el.getAttribute('aria-label') ||
      el.getAttribute('name') ||
      ''
    );
  }

  function buildSelector(el) {
    const name = el.getAttribute('name');
    const tag = el.tagName.toLowerCase();
    const type = el.getAttribute('type');

    if (name) {
      if (tag === 'input' && type === 'radio') {
        return `input[type="radio"][name="${escapeAttr(name)}"]`;
      }

      if (tag === 'input' && type === 'checkbox') {
        return `input[type="checkbox"][name="${escapeAttr(name)}"]`;
      }

      return `${tag}[name="${escapeAttr(name)}"]`;
    }

    const id = el.getAttribute('id');

    if (id) {
      return `#${CSS.escape(id)}`;
    }

    return null;
  }

  function detectWizardStep() {
    const processHead = document.querySelector('.el-step__head.is-process');

    if (processHead) {
      const cell = processHead.closest('td') ?? processHead.closest('.el-step');
      const title =
        cell?.querySelector('.el-step__description, .el-step__title')?.textContent?.trim() ??
        null;
      const num = title?.match(/(\d+)/)?.[1];

      return {
        wizardStep: num ? Number(num) : undefined,
        wizardStepTitle: title,
      };
    }

    return { wizardStep: undefined, wizardStepTitle: undefined };
  }

  const wizard = detectWizardStep();
  const fields = [];

  for (const el of document.querySelectorAll('input, select, textarea')) {
    const tag = el.tagName.toLowerCase();
    const inputType = el.getAttribute('type') ?? tag;
    const name = el.getAttribute('name');

    if (inputType === 'hidden' || inputType === 'submit' || inputType === 'button') {
      continue;
    }

    const selector = buildSelector(el);

    if (!selector) {
      continue;
    }

    const field = {
      tag,
      inputType,
      name,
      id: el.getAttribute('id'),
      label: getLabel(el),
      placeholder: el.getAttribute('placeholder'),
      required: el.hasAttribute('required') || el.getAttribute('aria-required') === 'true',
      selector,
    };

    if (tag === 'select') {
      field.options = [...el.options]
        .map((option) => option.text.trim())
        .filter(Boolean)
        .slice(0, 20);
    }

    fields.push(field);
  }

  const fileInputs = [];

  for (const list of document.querySelectorAll('.attach-item-list, input[type="file"]')) {
    if (list.matches('input[type="file"]')) {
      const name = list.getAttribute('name');
      fileInputs.push({
        label: getLabel(list) || name || 'file',
        selector: name ? `input[type="file"][name="${escapeAttr(name)}"]` : 'input[type="file"]',
        required: list.hasAttribute('required'),
      });
      continue;
    }

    const attachTypeName = list.getAttribute('attachTypeName');
    const attachTypeId = list.getAttribute('attachTypeId');
    const tr = list.closest('tr');
    const raw = tr?.querySelector('td')?.textContent?.replace(/\s+/g, ' ').trim() ?? attachTypeName;

    fileInputs.push({
      label: raw?.replace(/^\*\s*/, '').slice(0, 200) ?? 'document',
      selector: attachTypeId
        ? `[attachTypeId="${attachTypeId}"]`
        : `[attachTypeName="${attachTypeName}"]`,
      attachTypeName: attachTypeName ?? undefined,
      required: raw?.startsWith('*') ?? false,
    });
  }

  const nextButton =
    document.querySelector('input[value="Save and Next"], input[value="Next"], button[type="button"]');
  const submitButton = document.querySelector(
    'input[value="Submit"], button[type="submit"], input[type="submit"]',
  );

  const capture = {
    url: window.location.href,
    capturedAt: new Date().toISOString(),
    ...wizard,
    fields,
    fileInputs: fileInputs.length > 0 ? fileInputs : undefined,
    navigation: {
      nextButtonSelector: nextButton
        ? nextButton.matches('input')
          ? `input[value="${nextButton.getAttribute('value')}"]`
          : 'button[type="button"]'
        : undefined,
      submitButtonSelector: submitButton
        ? submitButton.matches('input')
          ? `input[value="${submitButton.getAttribute('value')}"]`
          : 'button[type="submit"]'
        : undefined,
      activeStepNumber: wizard.wizardStep,
    },
  };

  const json = JSON.stringify(capture, null, 2);
  console.log(json);

  try {
    void navigator.clipboard.writeText(json);
    console.log('Copied capture JSON to clipboard.');
  } catch {
    console.log('Copy JSON manually from console output above.');
  }

  return capture;
})();
