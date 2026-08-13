export type UniversityCredentials = {
    username: string;
    password: string;
};
export declare function getUniversityCredentials(universityId: string): UniversityCredentials | undefined;
