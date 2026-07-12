export type ApplicationTarget = {
  id?: string;
  universityRaw: string;
  universityId?: string;
  degree?: string;
  major?: string;
  duration?: string;
  fundingSource?: string;
};

export type StudentListItem = {
  id: string;
  surname: string;
  givenName: string;
  email: string;
  createdAt: string;
  applicationTargets: ApplicationTarget[];
};

export type StudentProfile = {
  id: string;
  personal: {
    surname: string;
    givenName: string;
    email: string;
    phone?: string;
    nationality?: string;
    dateOfBirth?: string;
    passportNo?: string;
  };
  documents: Record<string, string>;
  applicationTargets: ApplicationTarget[];
};
