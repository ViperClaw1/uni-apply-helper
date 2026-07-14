export type LetterType = "motivation_letter" | "essay";

export type MotivationLetter = {
  id: string;
  studentId: string;
  universityId: string;
  type: string;
  content: string;
  approvedByConsultant: boolean;
  approvedAt?: string;
  generatedAt: string;
};

export type GenerateLetterInput = {
  studentId: string;
  universityId: string;
  type?: LetterType;
  prompt?: string;
};
