import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ActionExecutor } from './agent/act/action.executor.js';
import { SemanticFieldMapper } from './agent/dom/semantic-field.mapper.js';
import { FormAgent } from './agent/form.agent.js';
import { GeminiClient } from './agent/gemini/gemini.client.js';
import { PageObserver } from './agent/observe/page.observer.js';
import { AgentPlanner } from './agent/think/agent.planner.js';
import { BrowserService } from './browser/browser.service.js';
import { PreWizardNavigator } from './browser/pre-wizard.navigator.js';
import { OpenFormStep } from './steps/open-form.step.js';
import { FillFieldsStep } from './steps/fill-fields.step.js';
import { FillWizardStep } from './steps/fill-wizard.step.js';
import { AttachFilesStep } from './steps/attach-files.step.js';
import { SubmitFormStep } from './steps/submit-form.step.js';
import { LogResultStep } from './steps/log-result.step.js';
import { FieldMapper } from './filler/field.mapper.js';
import { FileAttacher } from './filler/file.attacher.js';
import { FormFiller } from './filler/form.filler.js';
import { WizardFieldGroups } from './filler/wizard-field-groups.js';
import { WizardNavigator } from './filler/wizard.navigator.js';
import { NotificationsService } from './notifications/notifications.service.js';
import { Processor } from './processor.js';
import { ReloginProcessor } from './relogin/relogin.processor.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { ScreenshotService } from './screenshot/screenshot.service.js';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule],
  providers: [
    BrowserService,
    PreWizardNavigator,
    ScreenshotService,
    GeminiClient,
    PageObserver,
    AgentPlanner,
    ActionExecutor,
    SemanticFieldMapper,
    FormAgent,
    FieldMapper,
    FileAttacher,
    WizardNavigator,
    WizardFieldGroups,
    FormFiller,
    OpenFormStep,
    FillFieldsStep,
    FillWizardStep,
    AttachFilesStep,
    SubmitFormStep,
    LogResultStep,
    NotificationsService,
    Processor,
    ReloginProcessor,
  ],
})
export class AppModule {}
