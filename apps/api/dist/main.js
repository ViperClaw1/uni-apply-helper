"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const express_1 = require("express");
const app_module_1 = require("./app.module");
const assert_railway_service_1 = require("./assert-railway-service");
async function bootstrap() {
    (0, assert_railway_service_1.assertApiRailwayService)();
    const app = await core_1.NestFactory.create(app_module_1.AppModule, { bodyParser: false });
    app.enableCors({
        origin: process.env.DASHBOARD_ORIGIN?.split(',') ?? true,
        credentials: false,
    });
    app.use((0, express_1.json)({ limit: '10mb' }));
    app.use((0, express_1.urlencoded)({ extended: true, limit: '10mb' }));
    await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
//# sourceMappingURL=main.js.map