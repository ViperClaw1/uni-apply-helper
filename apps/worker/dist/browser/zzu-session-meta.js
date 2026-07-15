"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadZzuSessionMeta = loadZzuSessionMeta;
exports.getZzuContextOptions = getZzuContextOptions;
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const META_FILE = 'zzu-session-meta.json';
function loadZzuSessionMeta(configService) {
    const metaPath = configService.get('ZZU_SESSION_META_PATH') ??
        (0, node_path_1.resolve)(process.cwd(), META_FILE);
    if (!(0, node_fs_1.existsSync)(metaPath)) {
        return {};
    }
    return JSON.parse((0, node_fs_1.readFileSync)(metaPath, 'utf-8'));
}
function getZzuContextOptions(meta) {
    const options = {
        locale: 'en-US',
        timezoneId: 'Asia/Shanghai',
        extraHTTPHeaders: {
            'Accept-Language': 'en-US,en;q=0.9',
        },
    };
    if (meta.userAgent) {
        options.userAgent = meta.userAgent;
    }
    return options;
}
//# sourceMappingURL=zzu-session-meta.js.map