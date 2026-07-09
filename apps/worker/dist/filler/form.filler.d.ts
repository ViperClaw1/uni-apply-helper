import type { FieldConfig, StudentProfile } from '@uni-apply/shared';
import type { Page } from 'playwright';
import { FieldMapper } from './field.mapper.js';
import { FileAttacher } from './file.attacher.js';
import { SubmitHandler } from './submit.handler.js';
export declare class FormFiller {
    private readonly fieldMapper;
    private readonly fileAttacher;
    private readonly submitHandler;
    constructor(fieldMapper: FieldMapper, fileAttacher: FileAttacher, submitHandler: SubmitHandler);
    fillFields(page: Page, profile: StudentProfile, fields: FieldConfig[], motivationLetterContent?: string): Promise<void>;
    attachFiles(page: Page, profile: StudentProfile, fields: FieldConfig[]): Promise<void>;
    submit(page: Page): Promise<void>;
    private fillField;
    private toBoolean;
}
