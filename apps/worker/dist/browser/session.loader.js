"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadUniversityStorageState = loadUniversityStorageState;
exports.getSessionEnvKeyForUniversity = getSessionEnvKeyForUniversity;
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
function getSessionsDir() {
    return (0, node_path_1.resolve)(process.cwd(), 'browser-sessions');
}
function getSessionEnvKey(universityId) {
    return `${universityId.toUpperCase().replace(/-/g, '_')}_SESSION_STATE_B64`;
}
function loadUniversityStorageState(configService, universityId) {
    const envKey = getSessionEnvKey(universityId);
    const b64 = configService.get(envKey);
    if (b64) {
        return JSON.parse(Buffer.from(b64, 'base64').toString('utf-8'));
    }
    const sessionFile = (0, node_path_1.join)(getSessionsDir(), `${universityId}.json`);
    if ((0, node_fs_1.existsSync)(sessionFile)) {
        return JSON.parse((0, node_fs_1.readFileSync)(sessionFile, 'utf-8'));
    }
    if (universityId === 'zhengzhou-university') {
        const legacyB64 = configService.get('ZZU_SESSION_STATE_B64');
        if (legacyB64) {
            return JSON.parse(Buffer.from(legacyB64, 'base64').toString('utf-8'));
        }
        const legacyFile = (0, node_path_1.resolve)(process.cwd(), 'zzu-session.json');
        if ((0, node_fs_1.existsSync)(legacyFile)) {
            return JSON.parse((0, node_fs_1.readFileSync)(legacyFile, 'utf-8'));
        }
    }
    return undefined;
}
function getSessionEnvKeyForUniversity(universityId) {
    return getSessionEnvKey(universityId);
}
//# sourceMappingURL=session.loader.js.map