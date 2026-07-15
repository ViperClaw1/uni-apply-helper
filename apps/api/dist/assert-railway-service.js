"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertApiRailwayService = assertApiRailwayService;
function assertApiRailwayService() {
    if (process.env.RAILWAY_SERVICE_NAME !== 'worker') {
        return;
    }
    throw new Error([
        'Railway service "worker" is starting apps/api (HTTP server).',
        'Fix: Settings → Build → Dockerfile Path = apps/worker/Dockerfile',
        'Or Config-as-code path = apps/worker/railway.toml',
    ].join(' '));
}
//# sourceMappingURL=assert-railway-service.js.map