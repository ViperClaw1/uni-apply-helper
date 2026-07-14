export type UniversityMatchEntry = {
    id: string;
    displayName: string;
    aliases: string[];
};
export type UniversityMatchCandidate = {
    id: string;
    displayName: string;
    score: number;
};
export declare function normalizeUniversityName(value: string): string;
export declare function matchUniversityName(rawName: string, entries: UniversityMatchEntry[]): {
    universityId: string | null;
    candidates: UniversityMatchCandidate[];
};
