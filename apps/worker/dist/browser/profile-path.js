"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveProfileDir = resolveProfileDir;
exports.getProfilesRoot = getProfilesRoot;
const node_path_1 = require("node:path");
function getUniversityProfileEnvKey(universityId) {
    return `BROWSER_PROFILE_DIR_${universityId.toUpperCase().replace(/-/g, '_')}`;
}
function resolveProfileDir(configService, universityId) {
    const overrideDir = configService.get(getUniversityProfileEnvKey(universityId));
    if (overrideDir) {
        return overrideDir;
    }
    const profilesRoot = configService.get('BROWSER_PROFILES_DIR');
    if (profilesRoot) {
        return (0, node_path_1.join)(profilesRoot, universityId);
    }
    if (universityId === 'shandong-university') {
        const sduProfileDir = configService.get('SDU_PROFILE_DIR');
        const useSduProfile = configService.get('SDU_USE_PROFILE') === '1' || Boolean(sduProfileDir);
        if (useSduProfile) {
            return sduProfileDir ?? (0, node_path_1.join)(process.cwd(), 'profiles', 'shandong-university');
        }
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