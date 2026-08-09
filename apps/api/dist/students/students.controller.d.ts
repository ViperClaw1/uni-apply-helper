import type { RequestWithAccount } from '../auth/session-auth.guard.js';
import { StudentsService } from './students.service';
export declare class StudentsController {
    private readonly studentsService;
    constructor(studentsService: StudentsService);
    getMyProfile(req: RequestWithAccount): Promise<{
        student: import("@uni-apply/shared").StudentProfile | null;
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
    }): Promise<import("@uni-apply/shared").StudentProfile>;
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
    }): Promise<import("@uni-apply/shared").StudentProfile>;
    saveMyGuarantor(req: RequestWithAccount, body: {
        name?: string;
        relationship?: string;
        phone?: string;
        email?: string;
        homeAddress?: string;
    }): Promise<import("@uni-apply/shared").StudentProfile>;
    saveMyEmergencyContact(req: RequestWithAccount, body: {
        name?: string;
        relationship?: string;
        phone?: string;
        email?: string;
    }): Promise<import("@uni-apply/shared").StudentProfile>;
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
    }): Promise<import("@uni-apply/shared").StudentProfile>;
    findAll(): Promise<({
        applicationTargets: {
            id: string;
            universityId: string | null;
            universityRaw: string;
            degree: string | null;
            major: string | null;
            duration: string | null;
            fundingSource: string | null;
            studentId: string;
        }[];
    } & {
        id: string;
        email: string;
        createdAt: Date;
        accountId: string | null;
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
        desiredField: string | null;
    })[]>;
    findOne(id: string): Promise<{
        id: string;
        email: string;
        createdAt: Date;
        accountId: string | null;
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
        desiredField: string | null;
    }>;
    remove(id: string): Promise<void>;
    getFullProfile(id: string): Promise<import("@uni-apply/shared").StudentProfile>;
    setApplicationTargets(id: string, body: {
        formUrls?: string[];
    }): Promise<import("@uni-apply/shared").StudentProfile>;
    resolveApplicationTarget(id: string, body: {
        universityRaw: string;
        universityId: string;
    }): Promise<import("@uni-apply/shared").StudentProfile>;
}
