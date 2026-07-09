import type { ApplicationPipelineStep, ApplicationStepContext } from './step-context.js';
export declare class ValidateSchemaStep implements ApplicationPipelineStep {
    readonly name = "validate_schema";
    execute(context: ApplicationStepContext): Promise<void>;
}
