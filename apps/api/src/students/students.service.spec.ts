import { BadRequestException } from '@nestjs/common';
import { StudentsService } from './students.service';

function makeService(prisma: any = {}) {
  const universitiesService = {} as any;
  return new StudentsService(prisma, universitiesService);
}

describe('StudentsService#create', () => {
  function makeCreateService(create = jest.fn()) {
    return makeService({ student: { create } });
  }

  it('creates a student with trimmed required fields', async () => {
    const create = jest.fn().mockResolvedValue({ id: 's1' });
    const service = makeCreateService(create);

    await service.create({
      surname: '  Doe ',
      givenName: ' Jane ',
      email: ' jane@example.com ',
      phone: ' +123 ',
    });

    expect(create).toHaveBeenCalledWith({
      data: {
        surname: 'Doe',
        givenName: 'Jane',
        email: 'jane@example.com',
        phone: '+123',
      },
    });
  });

  it.each([
    { surname: '', givenName: 'Jane', email: 'jane@example.com' },
    { surname: 'Doe', givenName: '', email: 'jane@example.com' },
    { surname: 'Doe', givenName: 'Jane', email: '' },
  ])('rejects when a required field is missing (%p)', async (input) => {
    const service = makeCreateService();

    await expect(service.create(input)).rejects.toThrow(BadRequestException);
  });
});

describe('StudentsService id-scoped profile updates', () => {
  it('updateProfile updates the existing student by id, not accountId', async () => {
    const update = jest.fn().mockResolvedValue({ id: 's1', onboardingStep: 5 });
    const service = makeService({ student: { update } });
    jest.spyOn(service, 'getFullProfile').mockResolvedValue({} as any);

    await service.updateProfile('s1', {
      surname: 'Doe',
      givenName: 'Jane',
      email: 'jane@example.com',
    });

    expect(update).toHaveBeenCalledWith({
      where: { id: 's1' },
      data: expect.objectContaining({ surname: 'Doe', givenName: 'Jane' }),
    });
  });

  it('updateProfile rejects when a required field is missing', async () => {
    const service = makeService({ student: { update: jest.fn() } });

    await expect(
      service.updateProfile('s1', { surname: '', givenName: 'Jane', email: 'jane@example.com' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('updateGuarantor resolves the student by id (not accountId) and upserts', async () => {
    const findUniqueOrThrow = jest
      .fn()
      .mockResolvedValue({ id: 's1', onboardingStep: 5 });
    const upsert = jest.fn().mockResolvedValue({});
    const service = makeService({
      student: { findUniqueOrThrow },
      guarantor: { upsert },
    });
    jest.spyOn(service, 'getFullProfile').mockResolvedValue({} as any);

    await service.updateGuarantor('s1', { name: 'Bob', relationship: 'Father' });

    expect(findUniqueOrThrow).toHaveBeenCalledWith({ where: { id: 's1' } });
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { studentId: 's1' },
        create: expect.objectContaining({ name: 'Bob', studentId: 's1' }),
      }),
    );
  });

  it('updateGuarantor rejects when name is missing', async () => {
    const service = makeService({
      student: { findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 's1', onboardingStep: 1 }) },
    });

    await expect(service.updateGuarantor('s1', {})).rejects.toThrow(BadRequestException);
  });
});
