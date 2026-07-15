"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionExpiredError = void 0;
class SessionExpiredError extends Error {
    constructor(message = 'ZZU session expired — update zzu-session.json manually') {
        super(message);
        this.name = 'SessionExpiredError';
    }
}
exports.SessionExpiredError = SessionExpiredError;
//# sourceMappingURL=session-expired.error.js.map