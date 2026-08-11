import { ApplicationsService } from './applications.service';

function makeService(
  overrides: {
    prisma?: any;
    studentsService?: any;
    universitiesService?: any;
  } = {},
) {
  const prisma = overrides.prisma ?? {};
  const studentsService = overrides.studentsService ?? {};
  const universitiesService = overrides.universitiesService ?? {};

  return new ApplicationsService(
    prisma,
    studentsService,
    universitiesService,
    {} as any,
    {} as any,
  );
}

function baseProfile(
  applicationTargets: Array<{ universityRaw: string; universityId?: string }>,
  documents: Record<string, string> = {},
) {
  return { id: 'student-1', documents, applicationTargets };
}

describe('ApplicationsService#previewReadiness', () => {
  it('marks a target ready when all required documents are present and no essay is required', async () => {
    const service = makeService({
      prisma: { application: { findMany: jest.fn().mockResolvedValue([]) } },
      studentsService: {
        getFullProfile: jest.fn().mockResolvedValue(
          baseProfile(
            [{ universityRaw: 'Peking University', universityId: 'uni-1' }],
            { passport: 'https://files/passport.pdf' },
          ),
        ),
      },
      universitiesService: {
        findOne: jest.fn().mockResolvedValue({
          id: 'uni-1',
          displayName: 'Peking University',
          requiredDocuments: ['passport'],
          requiresEssay: false,
        }),
      },
    });

    const result = await service.previewReadiness('student-1');

    expect(result).toEqual([
      {
        universityId: 'uni-1',
        universityRaw: 'Peking University',
        status: 'ready',
        missingDocuments: [],
        blockedReason: undefined,
      },
    ]);
  });

  it('marks a target blocked and lists what is missing', async () => {
    const service = makeService({
      prisma: { application: { findMany: jest.fn().mockResolvedValue([]) } },
      studentsService: {
        getFullProfile: jest.fn().mockResolvedValue(
          baseProfile(
            [{ universityRaw: 'Nanjing University', universityId: 'uni-2' }],
            {},
          ),
        ),
      },
      universitiesService: {
        findOne: jest.fn().mockResolvedValue({
          id: 'uni-2',
          displayName: 'Nanjing University',
          requiredDocuments: ['passport', 'transcript'],
          requiresEssay: false,
        }),
      },
    });

    const result = await service.previewReadiness('student-1');

    expect(result).toEqual([
      {
        universityId: 'uni-2',
        universityRaw: 'Nanjing University',
        status: 'blocked',
        missingDocuments: ['passport', 'transcript'],
        blockedReason: 'Missing requirements: passport, transcript',
      },
    ]);
  });

  it('marks an already-submitted target as submitted without re-checking requirements', async () => {
    const findOne = jest.fn();
    const service = makeService({
      prisma: {
        application: {
          findMany: jest.fn().mockResolvedValue([{ universityId: 'uni-3' }]),
        },
      },
      studentsService: {
        getFullProfile: jest.fn().mockResolvedValue(
          baseProfile(
            [{ universityRaw: 'Sichuan University', universityId: 'uni-3' }],
            {},
          ),
        ),
      },
      universitiesService: { findOne },
    });

    const result = await service.previewReadiness('student-1');

    expect(result).toEqual([
      {
        universityId: 'uni-3',
        universityRaw: 'Sichuan University',
        status: 'submitted',
        missingDocuments: [],
      },
    ]);
    expect(findOne).not.toHaveBeenCalled();
  });

  it('marks an unresolved target (no universityId match) as unresolved', async () => {
    const service = makeService({
      prisma: { application: { findMany: jest.fn().mockResolvedValue([]) } },
      studentsService: {
        getFullProfile: jest.fn().mockResolvedValue(
          baseProfile([{ universityRaw: 'Some Unknown School' }], {}),
        ),
      },
      universitiesService: {
        resolve: jest.fn().mockResolvedValue({
          rawName: 'Some Unknown School',
          university: null,
          candidates: [],
        }),
      },
    });

    const result = await service.previewReadiness('student-1');

    expect(result).toEqual([
      {
        universityRaw: 'Some Unknown School',
        status: 'unresolved',
        missingDocuments: [],
        blockedReason: 'University link not resolved yet.',
      },
    ]);
  });
});
