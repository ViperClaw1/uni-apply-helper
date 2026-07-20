"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveProfileDir = resolveProfileDir;
exports.getProfilesRoot = getProfilesRoot;
const node_path_1 = require("node:path");
function resolveProfileDir(configService, universityId) {
    const profilesRoot = configService.get('BROWSER_PROFILES_DIR');
    if (profilesRoot) {
        return (0, node_path_1.join)(profilesRoot, universityId);
    }
    const legacyProfileDir = configService.get('ZZU_PROFILE_DIR');
    const useLegacyProfile = configService.get('ZZU_USE_PROFILE') === '1' || Boolean(legacyProfileDir);
    if (useLegacyProfile && universityId === 'zhengzhou-university') {
        return legacyProfileDir ?? (0, node_path_1.join)(process.cwd(), 'zzu-browser-profile');
    }
    return undefined;
}
function getProfilesRoot(configService) {
    return (configService.get('BROWSER_PROFILES_DIR') ??
        (0, node_path_1.join)(process.cwd(), 'profiles'));
}
//# sourceMappingURL=profile-path.js.map