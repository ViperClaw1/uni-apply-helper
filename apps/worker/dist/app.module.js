"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const browser_service_js_1 = require("./browser/browser.service.js");
const open_form_step_js_1 = require("./steps/open-form.step.js");
const validate_schema_step_js_1 = require("./steps/validate-schema.step.js");
const fill_fields_step_js_1 = require("./steps/fill-fields.step.js");
const attach_files_step_js_1 = require("./steps/attach-files.step.js");
const submit_form_step_js_1 = require("./steps/submit-form.step.js");
const log_result_step_js_1 = require("./steps/log-result.step.js");
const field_mapper_js_1 = require("./filler/field.mapper.js");
const file_attacher_js_1 = require("./filler/file.attacher.js");
const form_filler_js_1 = require("./filler/form.filler.js");
const submit_handler_js_1 = require("./filler/submit.handler.js");
const notifications_service_js_1 = require("./notifications/notifications.service.js");
const processor_js_1 = require("./processor.js");
const prisma_module_js_1 = require("./prisma/prisma.module.js");
const screenshot_service_js_1 = require("./screenshot/screenshot.service.js");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [config_1.ConfigModule.forRoot({ isGlobal: true }), prisma_module_js_1.PrismaModule],
        providers: [
            browser_service_js_1.BrowserService,
            screenshot_service_js_1.ScreenshotService,
            field_mapper_js_1.FieldMapper,
            file_attacher_js_1.FileAttacher,
            form_filler_js_1.FormFiller,
            submit_handler_js_1.SubmitHandler,
            open_form_step_js_1.OpenFormStep,
            validate_schema_step_js_1.ValidateSchemaStep,
            fill_fields_step_js_1.FillFieldsStep,
            attach_files_step_js_1.AttachFilesStep,
            submit_form_step_js_1.SubmitFormStep,
            log_result_step_js_1.LogResultStep,
            notifications_service_js_1.NotificationsService,
            processor_js_1.Processor,
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map