"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertSessionValid = assertSessionValid;
exports.isLoginPage = isLoginPage;
exports.getLoginUrl = getLoginUrl;
const attention_required_error_js_1 = require("../errors/attention-required.error.js");
const session_expired_error_js_1 = require("../errors/session-expired.error.js");
const attention_detector_js_1 = require("./attention-detector.js");
const zzu_session_loader_js_1 = require("./zzu-session.loader.js");
const DEFAULT_LOGIN_PATTERN = /\/member\/login\.do|\/login\.do|\/student\/login(?:\/|$|\?)|\/signin|\/auth\/login/i;
async function assertSessionValid(page, university) {
    const session = university.session;
    const url = page.url();
    const attentionReason = await (0, attention_detector_js_1.detectAttentionRequired)(page, session?.attentionIndicators);
    if (attentionReason) {
        throw new attention_required_error_js_1.AttentionRequiredError(`Automation blocked by ${(0, attention_detector_js_1.describeAttentionReason)(attentionReason)} for ${university.displayName}`, attentionReason, university.id);
    }
    if (session?.loginUrlPattern) {
        const pattern = new RegExp(session.loginUrlPattern, 'i');
        if (pattern.test(url)) {
            throw new session_expired_error_js_1.SessionExpiredError(`Redirected to login page — session expired for ${university.displayName}`, university.id);
        }
    }
    else if (DEFAULT_LOGIN_PATTERN.test(url)) {
        throw new session_expired_error_js_1.SessionExpiredError(`Redirected to login page — session expired for ${university.displayName}`, university.id);
    }
    if (await isLoginPage(page)) {
        throw new session_expired_error_js_1.SessionExpiredError(`Login form detected — session expired for ${university.displayName}`, university.id);
    }
    if (await (0, zzu_session_loader_js_1.isCsrfBlocked)(page)) {
        throw new session_expired_error_js_1.SessionExpiredError(`CSRF protection triggered — re-login required for ${university.displayName}`, university.id);
    }
    if (session?.expiredIndicators?.length && looksLikeAuthUrl(url)) {
        const body = await page.locator('body').innerText();
        for (const indicator of session.expiredIndicators) {
            if (body.includes(indicator)) {
                throw new session_expired_error_js_1.SessionExpiredError(`Session expired (${indicator}) — re-login required for ${university.displayName}`, university.id);
            }
        }
    }
}
function looksLikeAuthUrl(url) {
    return /\/login|\/signin|\/sign-in|\/register|\/auth\//i.test(url);
}
async function isLoginPage(page) {
    const url = page.url();
    let pathname = url;
    try {
        pathname = new URL(url).pathname;
    }
    catch {
    }
    if (/\/member\/login\.do$|\/login\.do$|\/student\/login\/?$|\/signin\/?$|\/sign-in\/?$|\/auth\/login/i.test(pathname)) {
        return true;
    }
    if ((await page.getByText('Account Sign In', { exact: true }).count()) > 0) {
        return true;
    }
    const cucasLogin = await page
        .locator('#login_submit, form#myform[action*="do_login"]')
        .count();
    if (cucasLogin > 0 &&
        (await page.locator('input[name="password"]').count()) > 0) {
        return true;
    }
    const username = await page.locator("input[name='username']").count();
    const password = await page
        .locator("input[name='password'], input[type='password']")
        .count();
    return username > 0 && password > 0;
}
function getLoginUrl(formUrl, session) {
    if (session?.loginUrlPattern || (0, zzu_session_loader_js_1.isZzuFormUrl)(formUrl)) {
        if (/chiwest\.cn|cucas\.cn|apply\.sdu\.edu\.cn/i.test(formUrl)) {
            return `${new URL(formUrl).origin}/en/student/login`;
        }
        return `${new URL(formUrl).origin}/member/login.do`;
    }
    return formUrl;
}
//# sourceMappingURL=session.validator.js.map