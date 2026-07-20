import { ConfigService } from '@nestjs/config';
import type { FieldConfig, StudentProfile, UniversitySchema } from '@uni-apply/shared';
import type { Page } from 'playwright';
import { FormAgent } from '../agent/form.agent.js';
import { SemanticFieldMapper } from '../agent/dom/semantic-field.mapper.js';
import { FieldMapper } from './field.mapper.js';
import { FileAttacher } from './file.attacher.js';
import { WizardFieldGroups } from './wizard-field-groups.js';
import { WizardNavigator } from './wizard.navigator.js';
export declare class FormFiller {
    private readonly configService;
    private readonly fieldMapper;
    private readonly fileAttacher;
    private readonly wizardNavigator;
    private readonly wizardFieldGroups;
    private readonly semanticFieldMapper;
    private readonly formAgent;
    constructor(configService: ConfigService, fieldMapper: FieldMapper, fileAttacher: FileAttacher, wizardNavigator: WizardNavigator, wizardFieldGroups: WizardFieldGroups, semanticFieldMapper: SemanticFieldMapper, formAgent: FormAgent);
    fillFields(page: Page, profile: StudentProfile, fields: FieldConfig[], motivationLetterContent?: string, university?: UniversitySchema): Promise<void>;
    attachFiles(page: Page, profile: StudentProfile, fields: FieldConfig[]): Promise<void>;
    submit(page: Page): Promise<void>;
    processWizard(page: Page, profile: StudentProfile, university: UniversitySchema, motivationLetterContent?: string): Promise<void>;
    private fillFieldBatch;
    private fillField;
    private toBoolean;
}
