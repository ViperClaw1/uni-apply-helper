import { NotificationsService } from '../notifications/notifications.service.js';
import { StudentsService } from '../students/students.service.js';
export declare class WebhookService {
    private readonly studentsService;
    private readonly notificationsService;
    private readonly logger;
    constructor(studentsService: StudentsService, notificationsService: NotificationsService);
    processFormSubmission(raw: unknown): Promise<any>;
    private extractPayload;
    private extractValues;
    private parseRawBody;
    private normalizeValue;
    private applyValuesFallback;
    private isEmptyNormalized;
    private toNormalizedPreview;
    private looksLikeTimestamp;
    private resolveFieldPath;
    private resolveRelativePath;
    private normalizeKey;
    private isStudyPeriodKey;
    private isHigherEducationPeriodKey;
    private isSchoolEducationPeriodKey;
    private hasAny;
    private isRecord;
    private isNonEmptyRecord;
}
