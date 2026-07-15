"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadZzuStorageState = loadZzuStorageState;
exports.isLoginRedirect = isLoginRedirect;
exports.isLoginPage = isLoginPage;
exports.isCsrfBlocked = isCsrfBlocked;
exports.isZzuFormUrl = isZzuFormUrl;
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
function loadZzuStorageState(configService) {
    const b64 = configService.get('ZZU_SESSION_STATE_B64');
    if (b64) {
        return JSON.parse(Buffer.from(b64, 'base64').toString('utf-8'));
    }
    const filePath = (0, node_path_1.resolve)(process.cwd(), 'zzu-session.json');
    if ((0, node_fs_1.existsSync)(filePath)) {
        return JSON.parse((0, node_fs_1.readFileSync)(filePath, 'utf-8'));
    }
    return undefined;
}
function isLoginRedirect(url) {
    return /\/member\/login\.do|\/login\.do/i.test(url);
}
async function isLoginPage(page) {
    if (isLoginRedirect(page.url())) {
        return true;
    }
    const signInHeading = await page.getByText('Account Sign In').count();
    if (signInHeading > 0) {
        return true;
    }
    const loginForm = await page
        .locator("form[action*='login'], input[name='username'], input[name='password']")
        .count();
    return loginForm >= 2;
}
async function isCsrfBlocked(page) {
    const body = await page.locator('body').innerText();
    return /CSRF attack protection|security department/i.test(body);
}
function isZzuFormUrl(formUrl) {
    return /zzu\.17gz\.org/i.test(formUrl);
}
//# sourceMappingURL=zzu-session.loader.js.map