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
const browser_service_1 = require("./browser/browser.service");
const open_form_step_1 = require("./steps/open-form.step");
const validate_schema_step_1 = require("./steps/validate-schema.step");
const fill_fields_step_1 = require("./steps/fill-fields.step");
const attach_files_step_1 = require("./steps/attach-files.step");
const submit_form_step_1 = require("./steps/submit-form.step");
const log_result_step_1 = require("./steps/log-result.step");
const field_mapper_1 = require("./filler/field.mapper");
const file_attacher_1 = require("./filler/file.attacher");
const form_filler_1 = require("./filler/form.filler");
const submit_handler_1 = require("./filler/submit.handler");
const notifications_service_1 = require("./notifications/notifications.service");
const processor_1 = require("./processor");
const prisma_module_1 = require("./prisma/prisma.module");
const screenshot_service_1 = require("./screenshot/screenshot.service");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [config_1.ConfigModule.forRoot({ isGlobal: true }), prisma_module_1.PrismaModule],
        providers: [
            browser_service_1.BrowserService,
            screenshot_service_1.ScreenshotService,
            field_mapper_1.FieldMapper,
            file_attacher_1.FileAttacher,
            form_filler_1.FormFiller,
            submit_handler_1.SubmitHandler,
            open_form_step_1.OpenFormStep,
            validate_schema_step_1.ValidateSchemaStep,
            fill_fields_step_1.FillFieldsStep,
            attach_files_step_1.AttachFilesStep,
            submit_form_step_1.SubmitFormStep,
            log_result_step_1.LogResultStep,
            notifications_service_1.NotificationsService,
            processor_1.Processor,
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map