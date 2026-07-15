import type { FieldConfig, StudentProfile, UniversitySchema } from '@uni-apply/shared';
import type { Page } from 'playwright';
import { FieldMapper } from './field.mapper.js';
import { FileAttacher } from './file.attacher.js';
import { WizardFieldGroups } from './wizard-field-groups.js';
import { WizardNavigator } from './wizard.navigator.js';
export declare class FormFiller {
    private readonly fieldMapper;
    private readonly fileAttacher;
    private readonly wizardNavigator;
    private readonly wizardFieldGroups;
    constructor(fieldMapper: FieldMapper, fileAttacher: FileAttacher, wizardNavigator: WizardNavigator, wizardFieldGroups: WizardFieldGroups);
    fillFields(page: Page, profile: StudentProfile, fields: FieldConfig[], motivationLetterContent?: string): Promise<void>;
    attachFiles(page: Page, profile: StudentProfile, fields: FieldConfig[]): Promise<void>;
    submit(page: Page): Promise<void>;
    processWizard(page: Page, profile: StudentProfile, university: UniversitySchema, motivationLetterContent?: string): Promise<void>;
    private validateFields;
    private fillFieldBatch;
    private fillField;
    private toBoolean;
}
