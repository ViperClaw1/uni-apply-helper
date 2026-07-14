"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const app_module_js_1 = require("./app.module.js");
async function bootstrap() {
    const logger = new common_1.Logger('WorkerBootstrap');
    const app = await core_1.NestFactory.createApplicationContext(app_module_js_1.AppModule);
    await app.init();
    logger.log('Application worker started (apps/worker)');
}
bootstrap();
//# sourceMappingURL=main.js.map