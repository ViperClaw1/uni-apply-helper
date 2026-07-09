import type { ApplicationPipelineStep, ApplicationStepContext } from './step-context.js';
export declare class OpenFormStep implements ApplicationPipelineStep {
    readonly name = "open_form";
    execute(context: ApplicationStepContext): Promise<void>;
}
