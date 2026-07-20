"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertSessionValid = assertSessionValid;
exports.getLoginUrl = getLoginUrl;
const session_expired_error_js_1 = require("../errors/session-expired.error.js");
const zzu_session_loader_js_1 = require("./zzu-session.loader.js");
const DEFAULT_LOGIN_PATTERN = /\/member\/login\.do|\/login\.do|\/signin|\/auth\/login/i;
async function assertSessionValid(page, university) {
    const session = university.session;
    if (session?.loginUrlPattern) {
        const pattern = new RegExp(session.loginUrlPattern, 'i');
        if (pattern.test(page.url())) {
            throw new session_expired_error_js_1.SessionExpiredError(`Redirected to login page — session expired for ${university.displayName}`, university.id);
        }
    }
    else if (DEFAULT_LOGIN_PATTERN.test(page.url())) {
        throw new session_expired_error_js_1.SessionExpiredError(`Redirected to login page — session expired for ${university.displayName}`, university.id);
    }
    if (await (0, zzu_session_loader_js_1.isLoginPage)(page)) {
        throw new session_expired_error_js_1.SessionExpiredError(`Login form detected — session expired for ${university.displayName}`, university.id);
    }
    if (await (0, zzu_session_loader_js_1.isCsrfBlocked)(page)) {
        throw new session_expired_error_js_1.SessionExpiredError(`CSRF protection triggered — re-login required for ${university.displayName}`, university.id);
    }
    if (session?.expiredIndicators?.length) {
        const body = await page.locator('body').innerText();
        for (const indicator of session.expiredIndicators) {
            if (body.includes(indicator)) {
                throw new session_expired_error_js_1.SessionExpiredError(`Session expired (${indicator}) — re-login required for ${university.displayName}`, university.id);
            }
        }
    }
}
function getLoginUrl(formUrl, session) {
    if (session?.loginUrlPattern) {
        const base = new URL(formUrl);
        return `${base.origin}/member/login.do`;
    }
    if (/zzu\.17gz\.org/i.test(formUrl)) {
        return 'https://zzu.17gz.org/member/login.do';
    }
    return formUrl;
}
//# sourceMappingURL=session.validator.js.map