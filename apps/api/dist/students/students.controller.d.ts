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
    })[]>;
    findOne(id: string): Promise<{
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
    getFullProfile(id: string): Promise<import("@uni-apply/shared").StudentProfile>;
    resolveApplicationTarget(id: string, body: {
        universityRaw: string;
        universityId: string;
    }): Promise<import("@uni-apply/shared").StudentProfile>;
}
