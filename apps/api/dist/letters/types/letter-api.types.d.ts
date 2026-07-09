export type LetterType = 'motivation_letter' | 'essay';
export type GenerateLetterInput = {
    studentId: string;
    universityId: string;
    type?: LetterType;
    prompt?: string;
};
export type UpdateLetterInput = {
    content?: string;
    approvedByConsultant?: boolean;
};
export type LetterResponse = {
    id: string;
    studentId: string;
    universityId: string;
    type: string;
    content: string;
    approvedByConsultant: boolean;
    approvedAt?: string;
    generatedAt: string;
};
