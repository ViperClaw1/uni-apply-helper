import { NavigationRegistry } from '../browser/navigation/navigation-registry.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ApplicationPipelineStep, ApplicationStepContext } from './step-context.js';
export declare class OpenFormStep implements ApplicationPipelineStep {
    private readonly navigationRegistry;
    private readonly prisma;
    readonly name = "open_form";
    constructor(navigationRegistry: NavigationRegistry, prisma: PrismaService);
    execute(context: ApplicationStepContext): Promise<void>;
    private recordSessionCheck;
}
