"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const express_1 = require("express");
const ws_1 = require("ws");
const app_module_1 = require("./app.module");
const assert_railway_service_1 = require("./assert-railway-service");
const relogin_viewer_service_js_1 = require("./relogin-viewer/relogin-viewer.service.js");
async function bootstrap() {
    (0, assert_railway_service_1.assertApiRailwayService)();
    const app = await core_1.NestFactory.create(app_module_1.AppModule, { bodyParser: false });
    const dashboardOrigins = process.env.DASHBOARD_ORIGIN?.split(',');
    app.enableCors({
        origin: dashboardOrigins ?? true,
        credentials: false,
    });
    app.use((0, express_1.json)({ limit: '10mb' }));
    app.use((0, express_1.urlencoded)({ extended: true, limit: '10mb' }));
    await app.init();
    const reloginViewerService = app.get(relogin_viewer_service_js_1.ReloginViewerService);
    const wss = new ws_1.WebSocketServer({ noServer: true });
    const httpServer = app.getHttpServer();
    httpServer.on('upgrade', (request, socket, head) => {
        const url = new URL(request.url ?? '', 'http://internal');
        if (url.pathname !== '/ws/relogin-viewer') {
            return;
        }
        if (dashboardOrigins &&
            !dashboardOrigins.includes(request.headers.origin ?? '')) {
            socket.destroy();
            return;
        }
        const ticket = url.searchParams.get('ticket');
        if (!ticket) {
            socket.destroy();
            return;
        }
        reloginViewerService
            .consumeTicket(ticket)
            .then((jobId) => {
            if (!jobId) {
                socket.destroy();
                return;
            }
            wss.handleUpgrade(request, socket, head, (ws) => {
                reloginViewerService.proxy(ws, jobId);
            });
        })
            .catch(() => socket.destroy());
    });
    await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
//# sourceMappingURL=main.js.map