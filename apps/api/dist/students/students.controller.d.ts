import { StudentsService } from './students.service';
export declare class StudentsController {
    private readonly studentsService;
    constructor(studentsService: StudentsService);
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
