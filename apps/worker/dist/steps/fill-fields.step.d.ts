import { FormFiller } from '../filler/form.filler.js';
import type { ApplicationPipelineStep, ApplicationStepContext } from './step-context.js';
export declare class FillFieldsStep implements ApplicationPipelineStep {
    private readonly formFiller;
    readonly name = "fill_fields";
    constructor(formFiller: FormFiller);
    execute(context: ApplicationStepContext): Promise<void>;
}
