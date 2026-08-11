export type UniversitySessionStatus =
  | "active"
  | "expired"
  | "login_required"
  | "attention_required"
  | "checking";

export type UniversitySession = {
  universityId: string;
  displayName: string;
  status: UniversitySessionStatus;
  lastCheckedAt?: string;
  applications: number;
};
