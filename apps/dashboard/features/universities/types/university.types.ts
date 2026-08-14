export type UniversitySummary = {
  id: string;
  displayName: string;
  formUrl: string;
  requiresEssay: boolean;
  requiredDocuments: string[];
  aliases: string[];
};

export type UniversityDetail = UniversitySummary;
