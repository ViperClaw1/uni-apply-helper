export type UniversitySummary = {
  id: string;
  displayName: string;
  formUrl: string;
  requiresEssay: boolean;
  aliases: string[];
};

export type UniversityDetail = UniversitySummary & {
  requiredDocuments: string[];
};
