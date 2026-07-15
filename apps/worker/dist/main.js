"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const app_module_js_1 = require("./app.module.js");
const assert_railway_service_js_1 = require("./assert-railway-service.js");
async function bootstrap() {
    (0, assert_railway_service_js_1.assertWorkerRuntime)();
    const logger = new common_1.Logger('WorkerBootstrap');
    const app = await core_1.NestFactory.createApplicationContext(app_module_js_1.AppModule, {
        logger: ['error', 'warn', 'log'],
    });
    await app.init();
    logger.log('apps/worker started — BullMQ consumer for application.process');
}
bootstrap();
//# sourceMappingURL=main.js.map