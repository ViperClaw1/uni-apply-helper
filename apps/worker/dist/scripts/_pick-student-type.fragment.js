"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
async function pickStudentTypeRadio(page, studentType) {
    await dismissBlockingDialogs(page);
    const hints = studentTypeHintList(studentType);
    const hint = hints[0] ?? 'Undergraduate Student';
    const visibleRadios = page.locator('input[type="radio"][name="projectTypeId"]:visible');
    const count = await visibleRadios.count();
    if (count === 0) {
        return false;
    }
    const visibleChecked = () => page
        .locator('input[type="radio"][name="projectTypeId"]:visible:checked')
        .count();
    for (const textHint of hints) {
        const textLoc = page.getByText(textHint, { exact: true }).first();
        if ((await textLoc.count()) === 0) {
            continue;
        }
        if (!(await textLoc.isVisible().catch(() => false))) {
            continue;
        }
        await textLoc.click({ force: true }).catch(() => undefined);
        if ((await visibleChecked()) > 0) {
            return true;
        }
    }
    for (const textHint of hints) {
        const escaped = textHint.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const label = page
            .locator('label')
            .filter({ hasText: new RegExp(`^\\s*${escaped}\\s*$`, 'i') })
            .first();
        if ((await label.count()) === 0) {
            continue;
        }
        await label.click({ force: true }).catch(() => undefined);
        if ((await visibleChecked()) > 0) {
            return true;
        }
    }
    const index = await page.evaluate((hintList) => {
        const isVisible = (el) => {
            const style = getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden') {
                return false;
            }
            const rect = el.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
        };
        const list = [
            ...document.querySelectorAll('input[type="radio"][name="projectTypeId"]'),
        ];
        const visible = list.filter(isVisible);
        const labelOf = (radio) => {
            const wrap = radio.closest('label')?.textContent?.trim();
            if (wrap) {
                return wrap;
            }
            if (radio.id) {
                const forLabel = document.querySelector(`label[for="${radio.id.replace(/"/g, '\\"')}"]`);
                if (forLabel?.textContent?.trim()) {
                    return forLabel.textContent.trim();
                }
            }
            let node = radio.nextSibling;
            while (node) {
                if (node.nodeType === Node.TEXT_NODE) {
                    const text = (node.textContent ?? '').replace(/\s+/g, ' ').trim();
                    if (text) {
                        return text;
                    }
                }
                else if (node.nodeType === Node.ELEMENT_NODE) {
                    const el = node;
                    if (el.tagName === 'LABEL' || el.tagName === 'SPAN') {
                        const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
                        if (text) {
                            return text;
                        }
                    }
                    if (el.tagName === 'BR' || el.tagName === 'INPUT') {
                        break;
                    }
                }
                node = node.nextSibling;
            }
            return '';
        };
        for (let i = 0; i < visible.length; i += 1) {
            const text = labelOf(visible[i]).toLowerCase();
            if (hintList.some((h) => text.includes(String(h).toLowerCase()))) {
                return i;
            }
        }
        for (let i = 0; i < visible.length; i += 1) {
            if (/undergraduate|本科/.test(labelOf(visible[i]).toLowerCase())) {
                return i;
            }
        }
        return Math.min(2, Math.max(0, visible.length - 1));
    }, hints);
    const target = visibleRadios.nth(index);
    const box = await target.boundingBox().catch(() => null);
    if (box) {
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        if ((await visibleChecked()) > 0) {
            return true;
        }
    }
    await target.click({ force: true }).catch(() => undefined);
    if ((await visibleChecked()) > 0) {
        return true;
    }
    await target.check({ force: true }).catch(() => undefined);
    if ((await visibleChecked()) > 0) {
        return true;
    }
    {
        const near = page.getByText(hint, { exact: false }).first();
        const textBox = await near.boundingBox().catch(() => null);
        if (textBox) {
            await page.mouse.click(textBox.x + Math.min(12, textBox.width / 2), textBox.y + textBox.height / 2);
            if ((await visibleChecked()) > 0) {
                return true;
            }
        }
    }
    const forced = await page.evaluate(({ idx, needle }) => {
        const isVisible = (el) => {
            const style = getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden') {
                return false;
            }
            const rect = el.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
        };
        const visible = [
            ...document.querySelectorAll('input[type="radio"][name="projectTypeId"]'),
        ].filter(isVisible);
        const targetRadio = visible[idx] ??
            visible.find((radio) => {
                const text = (radio.closest('label')?.textContent ??
                    radio.nextSibling?.textContent ??
                    '').toLowerCase();
                return text.includes(needle.toLowerCase());
            }) ??
            visible[2] ??
            visible[0];
        if (!targetRadio) {
            return { ok: false, html: '' };
        }
        targetRadio.disabled = false;
        for (const radio of visible) {
            radio.checked = false;
            radio.removeAttribute('checked');
        }
        targetRadio.checked = true;
        targetRadio.setAttribute('checked', 'checked');
        targetRadio.dispatchEvent(new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window,
        }));
        targetRadio.dispatchEvent(new Event('input', { bubbles: true }));
        targetRadio.dispatchEvent(new Event('change', { bubbles: true }));
        const parentHtml = (targetRadio.closest('label') ?? targetRadio.parentElement)?.outerHTML?.slice(0, 300);
        return {
            ok: targetRadio.checked,
            html: parentHtml ?? targetRadio.outerHTML,
        };
    }, { idx: index, needle: hint });
    if (forced.ok && (await visibleChecked()) > 0) {
        return true;
    }
    console.warn(`[pickStudentTypeRadio] failed hint="${hint}" index=${index} force=${JSON.stringify(forced)}`);
    return (await visibleChecked()) > 0;
}
//# sourceMappingURL=_pick-student-type.fragment.js.map