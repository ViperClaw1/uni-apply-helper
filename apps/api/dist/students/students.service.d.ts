import { StudentProfile } from '@uni-apply/shared';
import { PrismaService } from '../prisma/prisma.service';
import { UniversitiesService } from '../universities/universities.service.js';
type FamilyRelativeInput = {
    fullName?: string;
    nationality?: string;
    company?: string;
    position?: string;
    phone?: string;
    email?: string;
};
type EducationLevelInput = {
    degree?: string;
    institution?: string;
    major?: string;
    periodStartYear?: number;
    periodEndYear?: number;
};
export declare class StudentsService {
    private readonly prisma;
    private readonly universitiesService;
    constructor(prisma: PrismaService, universitiesService: UniversitiesService);
    createFromNormalized(data: Record<string, any>): Promise<any>;
    getFullProfile(studentId: string): Promise<StudentProfile>;
    findAll(): Promise<any>;
    findOne(id: string): Promise<any>;
    findByAccountId(accountId: string): Promise<StudentProfile | null>;
    upsertMyProfile(accountId: string, input: {
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
    upsertMyEducation(accountId: string, input: {
        school?: EducationLevelInput;
        higher?: EducationLevelInput;
        chineseLevel?: string;
        englishLevel?: string;
    }): Promise<StudentProfile>;
    upsertMyGuarantor(accountId: string, input: {
        name?: string;
        relationship?: string;
        phone?: string;
        email?: string;
        homeAddress?: string;
    }): Promise<StudentProfile>;
    upsertMyEmergencyContact(accountId: string, input: {
        name?: string;
        relationship?: string;
        phone?: string;
        email?: string;
    }): Promise<StudentProfile>;
    upsertMyFamily(accountId: string, input: {
        father?: FamilyRelativeInput;
        mother?: FamilyRelativeInput;
    }): Promise<StudentProfile>;
    private requireStudentByAccountId;
    private advanceOnboardingStep;
    private hasEducationData;
    private toEducationCreateData;
    private toFamilyMemberCreateData;
    private yearToDate;
    remove(id: string): Promise<void>;
    setApplicationTargetsByFormUrls(studentId: string, input: {
        formUrls?: string[];
    }): Promise<StudentProfile>;
    resolveApplicationTarget(studentId: string, input: {
        universityRaw: string;
        universityId: string;
    }): Promise<StudentProfile>;
    private buildEducationCreates;
    private educationRank;
    private hasContactData;
    private toContactCreateData;
    private parseFamilyMembers;
    private parseTargets;
    private toArray;
    private toBoolean;
    private toDate;
}
export {};
