import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BrowserService } from './browser/browser.service';
import { OpenFormStep } from './steps/open-form.step';
import { ValidateSchemaStep } from './steps/validate-schema.step';
import { FillFieldsStep } from './steps/fill-fields.step';
import { AttachFilesStep } from './steps/attach-files.step';
import { SubmitFormStep } from './steps/submit-form.step';
import { LogResultStep } from './steps/log-result.step';
import { FieldMapper } from './filler/field.mapper';
import { FileAttacher } from './filler/file.attacher';
import { FormFiller } from './filler/form.filler';
import { SubmitHandler } from './filler/submit.handler';
import { NotificationsService } from './notifications/notifications.service';
import { Processor } from './processor';
import { PrismaModule } from './prisma/prisma.module';
import { ScreenshotService } from './screenshot/screenshot.service';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule],
  providers: [
    BrowserService,
    ScreenshotService,
    FieldMapper,
    FileAttacher,
    FormFiller,
    SubmitHandler,
    OpenFormStep,
    ValidateSchemaStep,
    FillFieldsStep,
    AttachFilesStep,
    SubmitFormStep,
    LogResultStep,
    NotificationsService,
    Processor,
  ],
})
export class AppModule {}
