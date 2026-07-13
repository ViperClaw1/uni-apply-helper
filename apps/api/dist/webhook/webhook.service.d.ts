import { NotificationsService } from '../notifications/notifications.service.js';
import { StudentsService } from '../students/students.service.js';
export declare class WebhookService {
    private readonly studentsService;
    private readonly notificationsService;
    private readonly logger;
    constructor(studentsService: StudentsService, notificationsService: NotificationsService);
    processFormSubmission(raw: unknown): Promise<{
        email: string;
        id: string;
        surname: string;
        givenName: string;
        sex: string | null;
        nationality: string | null;
        cityOfBirth: string | null;
        dateOfBirth: Date | null;
        chineseName: string | null;
        religion: string | null;
        passportNo: string | null;
        passportExpiry: Date | null;
        consulate: string | null;
        maritalStatus: string | null;
        phone: string | null;
        hobby: string | null;
        permanentAddress: string | null;
        postCode: string | null;
        currentInstitution: string | null;
        beenToChina: boolean;
        studiedInChina: boolean;
        createdAt: Date;
    }>;
    private extractPayload;
    private parseRawBody;
    private normalizeValue;
    private resolveFieldPath;
    private normalizeKey;
    private hasAny;
    private isRecord;
}
