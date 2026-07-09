import { FormFiller } from '../filler/form.filler.js';
import type { ApplicationPipelineStep, ApplicationStepContext } from './step-context.js';
export declare class SubmitFormStep implements ApplicationPipelineStep {
    private readonly formFiller;
    readonly name = "submit_form";
    constructor(formFiller: FormFiller);
    execute(context: ApplicationStepContext): Promise<void>;
}
