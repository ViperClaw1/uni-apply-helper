import { ScreenshotService } from '../screenshot/screenshot.service.js';
import type { ApplicationPipelineStep, ApplicationStepContext } from './step-context.js';
export declare class LogResultStep implements ApplicationPipelineStep {
    private readonly screenshotService;
    readonly name = "log_result";
    constructor(screenshotService: ScreenshotService);
    execute(context: ApplicationStepContext): Promise<void>;
}
