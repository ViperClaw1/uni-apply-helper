import { PreWizardNavigator } from '../browser/pre-wizard.navigator.js';
import type { ApplicationPipelineStep, ApplicationStepContext } from './step-context.js';
export declare class OpenFormStep implements ApplicationPipelineStep {
    private readonly preWizardNavigator;
    readonly name = "open_form";
    constructor(preWizardNavigator: PreWizardNavigator);
    execute(context: ApplicationStepContext): Promise<void>;
}
