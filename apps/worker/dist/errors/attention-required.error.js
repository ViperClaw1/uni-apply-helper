"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AttentionRequiredError = void 0;
class AttentionRequiredError extends Error {
    universityId;
    reason;
    constructor(message, reason, universityId) {
        super(message);
        this.name = 'AttentionRequiredError';
        this.reason = reason;
        this.universityId = universityId;
    }
}
exports.AttentionRequiredError = AttentionRequiredError;
//# sourceMappingURL=attention-required.error.js.map