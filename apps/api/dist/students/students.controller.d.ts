import type { RequestWithAccount } from '../auth/session-auth.guard.js';
import { StudentsService } from './students.service';
export declare class StudentsController {
    private readonly studentsService;
    constructor(studentsService: StudentsService);
    getMyProfile(req: RequestWithAccount): Promise<{
        student: any;
    }>;
    saveMyProfile(req: RequestWithAccount, body: {
        surname?: string;
        givenName?: string;
        email?: string;
        phone?: string;
        nationality?: string;
        dateOfBirth?: string;
        passportNo?: string;
        sex?: string;
        cityOfBirth?: string;
        chineseName?: string;
        religion?: string;
        passportExpiry?: string;
        consulate?: string;
        maritalStatus?: string;
        hobby?: string;
        permanentAddress?: string;
        postCode?: string;
        currentInstitution?: string;
        beenToChina?: boolean;
        studiedInChina?: boolean;
        desiredField?: string;
    }): Promise<StudentProfile>;
    saveMyEducation(req: RequestWithAccount, body: {
        school?: {
            degree?: string;
            institution?: string;
            major?: string;
            periodStartYear?: number;
            periodEndYear?: number;
        };
        higher?: {
            degree?: string;
            institution?: string;
            major?: string;
            periodStartYear?: number;
            periodEndYear?: number;
        };
        chineseLevel?: string;
        englishLevel?: string;
    }): Promise<StudentProfile>;
    saveMyGuarantor(req: RequestWithAccount, body: {
        name?: string;
        relationship?: string;
        phone?: string;
        email?: string;
        homeAddress?: string;
    }): Promise<StudentProfile>;
    saveMyEmergencyContact(req: RequestWithAccount, body: {
        name?: string;
        relationship?: string;
        phone?: string;
        email?: string;
    }): Promise<StudentProfile>;
    saveMyFamily(req: RequestWithAccount, body: {
        father?: {
            fullName?: string;
            nationality?: string;
            phone?: string;
            email?: string;
            company?: string;
            position?: string;
        };
        mother?: {
            fullName?: string;
            nationality?: string;
            phone?: string;
            email?: string;
            company?: string;
            position?: string;
        };
    }): Promise<StudentProfile>;
    findAll(): Promise<any>;
    findOne(id: string): Promise<any>;
    remove(id: string): Promise<void>;
    getFullProfile(id: string): Promise<StudentProfile>;
    setApplicationTargets(id: string, body: {
        formUrls?: string[];
    }): Promise<StudentProfile>;
    resolveApplicationTarget(id: string, body: {
        universityRaw: string;
        universityId: string;
    }): Promise<StudentProfile>;
}
