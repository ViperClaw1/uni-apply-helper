import type { UniversitySchema } from '@uni-apply/shared';

export type UniversitySummary = Pick<
  UniversitySchema,
  'id' | 'displayName' | 'formUrl' | 'requiresEssay'
> & {
  aliases: string[];
};

export type UniversitySchemaResponse = UniversitySchema & {
  aliases: string[];
  versionHash?: string;
  lastValidatedAt?: string;
};

export type UniversityMatchCandidate = {
  id: string;
  displayName: string;
  score: number;
};

export type ResolvedUniversity = {
  rawName: string;
  university: UniversitySchemaResponse | null;
  candidates?: UniversityMatchCandidate[];
};

export type CreateUniversityAliasInput = {
  alias: string;
  universityId: string;
};

export type UniversitySchemaFile = UniversitySchema & {
  aliases?: string[];
  versionHash?: string;
  lastValidatedAt?: string;
};

export type SeedUniversitySchemasResult = {
  schemas: number;
  aliases: number;
};

/** Derived from BrowserSession — 'login_required' means no session has ever been captured. */
export type UniversitySessionStatus =
  'active' | 'expired' | 'login_required' | 'attention_required' | 'checking';

export type UniversitySessionSummary = {
  universityId: string;
  displayName: string;
  status: UniversitySessionStatus;
  lastCheckedAt?: string;
  /** Total applications submitted/in-flight for this university — helps prioritize which session to renew first. */
  applications: number;
};
