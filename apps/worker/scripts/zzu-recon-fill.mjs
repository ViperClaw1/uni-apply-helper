import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const PROBE_PHOTO = resolve(process.cwd(), 'probe-photo.jpg');

export async function ensureProbePhoto(page) {
  const bytes = await page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 295;
    canvas.height = 413;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#d9d9d9';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#6b6b6b';
    ctx.beginPath();
    ctx.arc(148, 130, 55, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(95, 200, 105, 130);

    const blob = await new Promise((resolveBlob) => {
      canvas.toBlob(resolveBlob, 'image/jpeg', 0.95);
    });
    if (!blob) return null;
    return [...new Uint8Array(await blob.arrayBuffer())];
  });

  if (!bytes) {
    throw new Error('Failed to generate probe photo');
  }

  writeFileSync(PROBE_PHOTO, Buffer.from(bytes));

  const photoInput = page.locator('[name="photo"]');
  if ((await photoInput.count()) === 0) {
    return;
  }

  await photoInput.setInputFiles(PROBE_PHOTO);
  await page.waitForTimeout(2500);
}

export async function fillMinimalVisibleFields(page, { uploadPhoto = true } = {}) {
  if (uploadPhoto) {
    await ensureProbePhoto(page);
  }

  await page.evaluate(() => {
    const setText = (name, value) => {
      const el = document.querySelector(`[name="${CSS.escape(name)}"]`);
      if (!el || el.type === 'file' || el.type === 'radio' || el.type === 'checkbox') return;
      el.value = value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    };

    const pickFirstSelect = (name) => {
      const el = document.querySelector(`select[name="${CSS.escape(name)}"]`);
      if (!el || el.options.length <= 1) return;
      el.selectedIndex = 1;
      el.dispatchEvent(new Event('change', { bubbles: true }));
    };

    const pickRadio = (name, value) => {
      const el = document.querySelector(`input[type="radio"][name="${CSS.escape(name)}"][value="${value}"]`);
      if (el) {
        el.checked = true;
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
    };

    setText('apply.lastName', 'Test');
    setText('apply.givenName', 'User');
    setText('apply.name', '测试');
    setText('apply.bornedDate', '2000-01-01');
    setText('apply.bornedAddress', 'Test City');
    setText('applyEx.lastSchool', 'Test University');
    setText('apply.workplace', 'Test Company');
    setText('apply.passportNo', 'AB1234567');
    setText('apply.passportExpire', '2030-01-01');

    pickRadio('apply.sex', '0');
    pickRadio('apply.marryStatus', '0');
    pickRadio('apply.isOversea', '1');
    pickRadio('applyEx.inChinaOnApply', '1');

    for (const name of [
      'apply.countryId',
      'apply.bornedCountryId',
      'apply.languageId',
      'apply.educationId',
      'apply.religionId',
      'apply.careerId',
    ]) {
      pickFirstSelect(name);
    }

    for (const el of document.querySelectorAll('input[type="text"], textarea')) {
      const name = el.getAttribute('name');
      if (!name || el.value) continue;

      if (/email/i.test(name)) {
        el.value = 'test.user@example.com';
      } else if (/mobile|phone|fax/i.test(name)) {
        el.value = '+1234567890';
      } else if (/date|expire|birth|issue/i.test(name)) {
        el.value = '2030-01-01';
      } else if (/score|hsk/i.test(name)) {
        el.value = '180';
      } else {
        el.value = 'Test';
      }

      el.dispatchEvent(new Event('change', { bubbles: true }));
    }

    for (const el of document.querySelectorAll('select')) {
      if (el.value || el.options.length <= 1) continue;
      el.selectedIndex = 1;
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }

    const radioGroups = new Set(
      [...document.querySelectorAll('input[type="radio"][name]')].map((el) => el.name),
    );
    for (const name of radioGroups) {
      if (document.querySelector(`input[type="radio"][name="${CSS.escape(name)}"]:checked`)) continue;
      const first = document.querySelector(`input[type="radio"][name="${CSS.escape(name)}"]`);
      if (first) {
        first.checked = true;
        first.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
  });
}
