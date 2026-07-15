import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BrowserService } from './browser/browser.service.js';
import { OpenFormStep } from './steps/open-form.step.js';
import { ValidateSchemaStep } from './steps/validate-schema.step.js';
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
import { PrismaModule } from './prisma/prisma.module.js';
import { ScreenshotService } from './screenshot/screenshot.service.js';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule],
  providers: [
    BrowserService,
    ScreenshotService,
    FieldMapper,
    FileAttacher,
    WizardNavigator,
    WizardFieldGroups,
    FormFiller,
    OpenFormStep,
    ValidateSchemaStep,
    FillFieldsStep,
    FillWizardStep,
    AttachFilesStep,
    SubmitFormStep,
    LogResultStep,
    NotificationsService,
    Processor,
  ],
})
export class AppModule {}
