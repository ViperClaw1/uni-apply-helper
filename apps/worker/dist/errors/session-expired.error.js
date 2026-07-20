"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionExpiredError = void 0;
class SessionExpiredError extends Error {
    universityId;
    constructor(message = 'Browser session expired — re-login required', universityId) {
        super(message);
        this.name = 'SessionExpiredError';
        this.universityId = universityId;
    }
}
exports.SessionExpiredError = SessionExpiredError;
//# sourceMappingURL=session-expired.error.js.map