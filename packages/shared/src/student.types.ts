export interface StudentProfile {
  id: string;
  /** Furthest self-service onboarding wizard step this account may access (1-6). */
  onboardingStep: number;
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
    /** Desired major / department / research area (Google Form). */
    desiredField?: string;
  };
  education: Array<{
    /** 'school' = среднее; 'higher' = высшее (при подаче в магистратуру+) */
    level?: 'school' | 'higher';
    degree?: string;
    institution?: string;
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
  /** One URL or ordered list (multi-page diploma / transcript / recommendations). */
  documents: Record<string, string | string[]>;
  applicationTargets: Array<{
    id?: string;
    universityRaw: string;
    universityId?: string;
    formUrl?: string;
    degree?: string;
    major?: string;
    duration?: string;
    fundingSource?: string;
  }>;
}
