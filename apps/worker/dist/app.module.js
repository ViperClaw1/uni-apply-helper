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
const action_executor_js_1 = require("./agent/act/action.executor.js");
const semantic_field_mapper_js_1 = require("./agent/dom/semantic-field.mapper.js");
const form_agent_js_1 = require("./agent/form.agent.js");
const gemini_client_js_1 = require("./agent/gemini/gemini.client.js");
const page_observer_js_1 = require("./agent/observe/page.observer.js");
const agent_planner_js_1 = require("./agent/think/agent.planner.js");
const browser_service_js_1 = require("./browser/browser.service.js");
const generic_navigator_js_1 = require("./browser/navigation/generic.navigator.js");
const navigation_registry_service_js_1 = require("./browser/navigation/navigation-registry.service.js");
const sdu_navigator_js_1 = require("./browser/navigation/sdu.navigator.js");
const zzu_navigator_js_1 = require("./browser/navigation/zzu.navigator.js");
const pre_wizard_navigator_js_1 = require("./browser/pre-wizard.navigator.js");
const open_form_step_js_1 = require("./steps/open-form.step.js");
const fill_fields_step_js_1 = require("./steps/fill-fields.step.js");
const fill_wizard_step_js_1 = require("./steps/fill-wizard.step.js");
const attach_files_step_js_1 = require("./steps/attach-files.step.js");
const submit_form_step_js_1 = require("./steps/submit-form.step.js");
const log_result_step_js_1 = require("./steps/log-result.step.js");
const field_mapper_js_1 = require("./filler/field.mapper.js");
const file_attacher_js_1 = require("./filler/file.attacher.js");
const form_filler_js_1 = require("./filler/form.filler.js");
const wizard_field_groups_js_1 = require("./filler/wizard-field-groups.js");
const wizard_navigator_js_1 = require("./filler/wizard.navigator.js");
const notifications_service_js_1 = require("./notifications/notifications.service.js");
const processor_js_1 = require("./processor.js");
const relogin_processor_js_1 = require("./relogin/relogin.processor.js");
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
            pre_wizard_navigator_js_1.PreWizardNavigator,
            zzu_navigator_js_1.ZzuNavigator,
            sdu_navigator_js_1.SduNavigator,
            generic_navigator_js_1.GenericNavigator,
            navigation_registry_service_js_1.NavigationRegistry,
            screenshot_service_js_1.ScreenshotService,
            gemini_client_js_1.GeminiClient,
            page_observer_js_1.PageObserver,
            agent_planner_js_1.AgentPlanner,
            action_executor_js_1.ActionExecutor,
            semantic_field_mapper_js_1.SemanticFieldMapper,
            form_agent_js_1.FormAgent,
            field_mapper_js_1.FieldMapper,
            file_attacher_js_1.FileAttacher,
            wizard_navigator_js_1.WizardNavigator,
            wizard_field_groups_js_1.WizardFieldGroups,
            form_filler_js_1.FormFiller,
            open_form_step_js_1.OpenFormStep,
            fill_fields_step_js_1.FillFieldsStep,
            fill_wizard_step_js_1.FillWizardStep,
            attach_files_step_js_1.AttachFilesStep,
            submit_form_step_js_1.SubmitFormStep,
            log_result_step_js_1.LogResultStep,
            notifications_service_js_1.NotificationsService,
            processor_js_1.Processor,
            relogin_processor_js_1.ReloginProcessor,
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map