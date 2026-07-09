export interface StudentProfile {
  id: string;
  personal: {
    surname: string;
    givenName: string;
    sex?: string;
    nationality?: string;
    cityOfBirth?: string;
    dateOfBirth?: string;
    chineseName?: string;
    religion?: string;
    passportNo?: string;
    passportExpiry?: string;
    consulate?: string;
    maritalStatus?: string;
    email: string;
    phone?: string;
    hobby?: string;
    permanentAddress?: string;
    postCode?: string;
    currentInstitution?: string;
    beenToChina?: boolean;
    studiedInChina?: boolean;
  };
  education: Array<{
    degree: string;
    institution: string;
    major?: string;
    periodStart?: string;
    periodEnd?: string;
  }>;
  workExperience: Array<{
    company: string;
    position?: string;
    periodStart?: string;
    periodEnd?: string;
  }>;
  languages: Array<{
    language: string;
    certificate?: string;
    score?: string;
    level?: string;
  }>;
  familyMembers: Array<{
    fullName: string;
    relationship: string;
    nationality?: string;
    age?: number;
    company?: string;
    position?: string;
    phone?: string;
    email?: string;
  }>;
  guarantor?: {
    name: string;
    relationship: string;
    nationality?: string;
    company?: string;
    position?: string;
    homeAddress?: string;
    phone?: string;
    email?: string;
  };
  emergencyContact?: {
    name: string;
    relationship: string;
    nationality?: string;
    company?: string;
    homeAddress?: string;
    phone?: string;
    email?: string;
  };
  documents: Record<string, string>;
  applicationTargets: Array<{
    universityRaw: string;
    universityId?: string;
    degree?: string;
    major?: string;
    duration?: string;
    fundingSource?: string;
  }>;
}
