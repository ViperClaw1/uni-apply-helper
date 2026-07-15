import { FormFiller } from '../filler/form.filler.js';
import type { ApplicationPipelineStep, ApplicationStepContext } from './step-context.js';
export declare class FillWizardStep implements ApplicationPipelineStep {
    private readonly formFiller;
    readonly name = "fill_wizard";
    constructor(formFiller: FormFiller);
    execute(context: ApplicationStepContext): Promise<void>;
}
