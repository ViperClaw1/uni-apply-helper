import { StudentsService } from './students.service';
export declare class StudentsController {
    private readonly studentsService;
    constructor(studentsService: StudentsService);
    findAll(): Promise<({
        applicationTargets: {
            universityRaw: string;
            universityId: string | null;
            degree: string | null;
            major: string | null;
            duration: string | null;
            fundingSource: string | null;
            id: string;
            studentId: string;
        }[];
    } & {
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
    })[]>;
    findOne(id: string): Promise<{
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
    getFullProfile(id: string): Promise<import("@uni-apply/shared").StudentProfile>;
}
