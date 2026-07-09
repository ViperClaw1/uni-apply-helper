import { FormFiller } from '../filler/form.filler.js';
import type { ApplicationPipelineStep, ApplicationStepContext } from './step-context.js';
export declare class AttachFilesStep implements ApplicationPipelineStep {
    private readonly formFiller;
    readonly name = "attach_files";
    constructor(formFiller: FormFiller);
    execute(context: ApplicationStepContext): Promise<void>;
}
