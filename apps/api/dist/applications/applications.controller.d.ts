import { ApplicationsService } from './applications.service.js';
import type { CreateApplicationBatchInput, SubmitApplicationInput, UpdateApplicationInput } from './types/application-api.types.js';
export declare class ApplicationsController {
    private readonly applicationsService;
    constructor(applicationsService: ApplicationsService);
    createBatch(body: CreateApplicationBatchInput): Promise<import("./types/application-api.types.js").ApplicationBatchResponse>;
    createBatchForStudent(studentId: string): Promise<import("./types/application-api.types.js").ApplicationBatchResponse>;
    findByStudent(studentId: string): Promise<import("./types/application-api.types.js").ApplicationBatchResponse[]>;
    findBatch(id: string): Promise<import("./types/application-api.types.js").ApplicationBatchResponse>;
    findActive(url: string, studentId: string): Promise<import("./types/application-api.types.js").ActiveApplicationResponse>;
    findApplication(id: string): Promise<import("./types/application-api.types.js").ApplicationResponse>;
    submitApplication(id: string, body: SubmitApplicationInput): Promise<import("./types/application-api.types.js").ApplicationResponse>;
    updateApplication(id: string, body: UpdateApplicationInput): Promise<import("./types/application-api.types.js").ApplicationResponse>;
    addStep(id: string, body: {
        stepName: string;
        status: string;
        errorMessage?: string;
    }): Promise<import("./types/application-api.types.js").ApplicationStepResponse>;
}
