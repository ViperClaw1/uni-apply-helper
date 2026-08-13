"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectAttentionRequired = detectAttentionRequired;
exports.describeAttentionReason = describeAttentionReason;
const CAPTCHA_SELECTOR = [
    'iframe[src*="recaptcha" i]:visible',
    'iframe[title*="recaptcha" i]:visible',
    '.g-recaptcha:visible',
    '#recaptcha:visible',
    'iframe[src*="hcaptcha" i]:visible',
    '.h-captcha:visible',
    'iframe[src*="turnstile" i]:visible',
    '[class*="captcha" i]:visible',
    'input[name*="captcha" i]:visible',
    'img[src*="captcha" i]:visible',
    'img[alt*="captcha" i]:visible',
].join(', ');
const TWO_FACTOR_SELECTOR = [
    'input[autocomplete="one-time-code"]:visible',
    'input[name*="otp" i]:visible',
    'input[name*="verifycode" i]:visible',
    'input[name*="verificationcode" i]:visible',
    'input[placeholder*="verification code" i]:visible',
    'input[placeholder*="one-time" i]:visible',
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