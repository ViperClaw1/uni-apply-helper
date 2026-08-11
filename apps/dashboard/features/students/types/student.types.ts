export type ApplicationTarget = {
  id?: string;
  universityRaw: string;
  universityId?: string;
  formUrl?: string;
  degree?: string;
  major?: string;
  duration?: string;
  fundingSource?: string;
};

export type StudentListBatchSummary = {
  id: string;
  status: string;
  total: number;
  submitted: number;
  blocked: number;
  failed: number;
};

export type StudentListItem = {
  id: string;
  createdAt: string;
  photoUrl?: string;
  personal: {
    surname: string;
    givenName: string;
    email: string;
    phone?: string;
    nationality?: string;
    dateOfBirth?: string;
    passportNo?: string;
    permanentAddress?: string;
  };
  education: EducationEntry[];
  languages: LanguageSkill[];
  documents: { type: string }[];
  applicationTargets: ApplicationTarget[];
  latestBatch?: StudentListBatchSummary;
};

export type ContactInfo = {
  name: string;
  relationship: string;
  phone?: string;
  email?: string;
  homeAddress?: string;
};

export type EducationEntry = {
  level?: "school" | "higher";
  degree?: string;
  institution?: string;
  major?: string;
  periodStart?: string;
  periodEnd?: string;
};

export type LanguageSkill = {
  language: string;
  certificate?: string;
  score?: string;
  level?: string;
};

export type FamilyMember = {
  fullName: string;
  relationship: string;
  nationality?: string;
  age?: number;
  company?: string;
  position?: string;
  phone?: string;
  email?: string;
};

export type StudentProfile = {
  id: string;
  onboardingStep: number;
  personal: {
    surname: string;
    givenName: string;
    email: string;
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
  };
  education: EducationEntry[];
  languages: LanguageSkill[];
  familyMembers: FamilyMember[];
  guarantor?: ContactInfo;
  emergencyContact?: ContactInfo;
  documents: Record<string, string | string[]>;
  applicationTargets: ApplicationTarget[];
};
