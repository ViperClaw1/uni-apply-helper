"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SESSION_COOKIE_NAME = void 0;
exports.parseCookie = parseCookie;
exports.SESSION_COOKIE_NAME = 'session';
function parseCookie(header, name) {
    if (!header) {
        return undefined;
    }
    for (const part of header.split('; ')) {
        const separatorIndex = part.indexOf('=');
        if (separatorIndex === -1) {
            continue;
        }
        if (part.slice(0, separatorIndex) === name) {
            return decodeURIComponent(part.slice(separatorIndex + 1));
        }
    }
    return undefined;
}
//# sourceMappingURL=cookie.util.js.map