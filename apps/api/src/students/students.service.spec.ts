import { BadRequestException } from '@nestjs/common';
import { StudentsService } from './students.service';

describe('StudentsService#create', () => {
  function makeService(create = jest.fn()) {
    const prisma = { student: { create } } as any;
    const universitiesService = {} as any;
    return new StudentsService(prisma, universitiesService);
  }

  it('creates a student with trimmed required fields', async () => {
    const create = jest.fn().mockResolvedValue({ id: 's1' });
    const service = makeService(create);

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
    const service = makeService();

    await expect(service.create(input)).rejects.toThrow(BadRequestException);
  });
});
