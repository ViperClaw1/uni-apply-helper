import { NavigationRegistry } from '../browser/navigation/navigation-registry.service.js';
import type { ApplicationPipelineStep, ApplicationStepContext } from './step-context.js';
export declare class OpenFormStep implements ApplicationPipelineStep {
    private readonly navigationRegistry;
    readonly name = "open_form";
    constructor(navigationRegistry: NavigationRegistry);
    execute(context: ApplicationStepContext): Promise<void>;
}
