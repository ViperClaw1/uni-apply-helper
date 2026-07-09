import { NotificationsService } from '../notifications/notifications.service';
import { StudentsService } from '../students/students.service';
export declare class WebhookService {
    private readonly studentsService;
    private readonly notificationsService;
    constructor(studentsService: StudentsService, notificationsService: NotificationsService);
    processFormSubmission(raw: Record<string, unknown>): Promise<{
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
        email: string;
        phone: string | null;
        hobby: string | null;
        permanentAddress: string | null;
        postCode: string | null;
        currentInstitution: string | null;
        beenToChina: boolean;
        studiedInChina: boolean;
        createdAt: Date;
    }>;
    private normalizeValue;
}
