"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectAttentionRequired = detectAttentionRequired;
exports.describeAttentionReason = describeAttentionReason;
const CAPTCHA_SELECTOR = [
    'iframe[src*="recaptcha" i]',
    'iframe[title*="recaptcha" i]',
    '.g-recaptcha',
    '#recaptcha',
    'iframe[src*="hcaptcha" i]',
    '.h-captcha',
    'iframe[src*="turnstile" i]',
    '[class*="captcha" i]',
    'input[name*="captcha" i]',
    'img[src*="captcha" i]',
    'img[alt*="captcha" i]',
].join(', ');
const TWO_FACTOR_SELECTOR = [
    'input[autocomplete="one-time-code"]',
    'input[name*="otp" i]',
    'input[name*="verifycode" i]',
    'input[name*="verificationcode" i]',
    'input[placeholder*="verification code" i]',
    'input[placeholder*="one-time" i]',
].join(', ');
async function detectAttentionRequired(page, attentionIndicators) {
    if ((await page.locator(CAPTCHA_SELECTOR).count()) > 0) {
        return 'captcha';
    }
    if ((await page.locator(TWO_FACTOR_SELECTOR).count()) > 0) {
        return 'two_factor';
    }
    if (attentionIndicators?.length) {
        const body = await page.locator('body').innerText();
        if (attentionIndicators.some((indicator) => body.includes(indicator))) {
            return 'text_indicator';
        }
    }
    return null;
}
function describeAttentionReason(reason) {
    if (reason === 'captcha') {
        return 'a CAPTCHA';
    }
    if (reason === 'two_factor') {
        return 'a 2FA prompt';
    }
    return 'an unexpected verification step';
}
//# sourceMappingURL=attention-detector.js.map