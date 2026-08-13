"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUniversityCredentials = getUniversityCredentials;
const common_1 = require("@nestjs/common");
const logger = new common_1.Logger('UniversityCredentials');
let cache = null;
function getUniversityCredentials(universityId) {
    if (cache === null) {
        cache = parseCredentials(process.env.UNIVERSITY_CREDENTIALS);
    }
    return cache[universityId];
}
function parseCredentials(raw) {
    if (!raw?.trim()) {
        return {};
    }
    try {
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') {
            throw new Error('not an object');
        }
        return parsed;
    }
    catch (error) {
        logger.warn(`UNIVERSITY_CREDENTIALS is set but isn't valid JSON — auto-fill disabled: ${error instanceof Error ? error.message : String(error)}`);
        return {};
    }
}
//# sourceMappingURL=university-credentials.js.map