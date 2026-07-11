import { BadRequestException, Injectable } from '@nestjs/common';
import { set } from 'lodash';
import { NotificationsService } from '../notifications/notifications.service.js';
import { StudentsService } from '../students/students.service.js';

const FIELD_MAP: Record<string, string> = {
  'Фамилия (заглавными буквами) / Surname': 'personal.surname',
  'Имя (заглавными буквами) / Given Name': 'personal.givenName',
  'Пол / Sex': 'personal.sex',
  'Гражданство / Nationality': 'personal.nationality',
  'Город рождения / City of Birth': 'personal.cityOfBirth',
  'Дата рождения / Date of Birth': 'personal.dateOfBirth',
  'Китайское имя (если есть) / Chinese name': 'personal.chineseName',
  'Религия / Religion': 'personal.religion',
  'Номер паспорта / Passport No.': 'personal.passportNo',
  'Срок действия паспорта / Passport Expiration Time': 'personal.passportExpiry',
  'Консульство, куда подаётся виза / Consulate Applying for VISA':
    'personal.consulate',
  'Семейное положение / Marital status': 'personal.maritalStatus',
  'Электронная почта / E-Mail': 'personal.email',
  'Номер телефона / Phone Number': 'personal.phone',
  'Хобби / Hobby': 'personal.hobby',
  'Постоянный адрес проживания / Permanent Address': 'personal.permanentAddress',
  'Почтовый индекс / Post Code': 'personal.postCode',
  'Текущее место работы или учёбы / Current Employer or Institution Affiliated':
    'personal.currentInstitution',
  'Бывали ли вы в Китае? / Have you ever been to China?':
    'personal.beenToChina',
  'Учились или работали ли вы в Китае? / Have you ever studied or worked in China?':
    'personal.studiedInChina',
  'Высшее образование (степень) / Highest Degree': 'education.0.degree',
  'Учебное заведение окончания / School of Graduation':
    'education.0.institution',
  'Специальность / Major': 'education.0.major',
  'Уровень китайского языка (HSK, баллы) / Chinese language level':
    'languages.chinese',
  'Уровень английского языка / English language level': 'languages.english',
  'Учебное заведение, куда подаётся заявка / Application School':
    'applicationTargets',
  'Специальность заявки / Application Major': 'applicationMajor',
  'Степень / Degree': 'applicationDegree',
  'Срок обучения / Duration of Study': 'applicationDuration',
  'Источник финансирования / Financial resources for study':
    'applicationFunding',
};

@Injectable()
export class WebhookService {
  constructor(
    private readonly studentsService: StudentsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async processFormSubmission(raw: unknown) {
    const payload = this.extractPayload(raw);
    const normalized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(payload)) {
      const path = FIELD_MAP[key];

      if (path) {
        set(normalized, path, this.normalizeValue(value));
      }
    }

    const student = await this.studentsService.createFromNormalized(normalized);

    await this.notificationsService.notifyNewStudent(student);

    return student;
  }

  private extractPayload(raw: unknown): Record<string, unknown> {
    const parsedRaw = this.parseRawBody(raw);

    if (!this.isRecord(parsedRaw)) {
      throw new BadRequestException('Expected a JSON object body.');
    }

    const candidate =
      parsedRaw.namedValues ?? parsedRaw.data ?? parsedRaw.payload ?? parsedRaw;

    if (!this.isRecord(candidate)) {
      throw new BadRequestException(
        'Expected form payload as root object, namedValues, data, or payload.',
      );
    }

    return candidate;
  }

  private parseRawBody(raw: unknown): unknown {
    if (raw === undefined || raw === null) {
      throw new BadRequestException(
        'Request body was not parsed. Send JSON body with Content-Type: application/json.',
      );
    }

    if (typeof raw !== 'string') {
      return raw;
    }

    const trimmed = raw.trim();

    if (!trimmed) {
      throw new BadRequestException('Request body is empty.');
    }

    try {
      return JSON.parse(trimmed) as unknown;
    } catch {
      throw new BadRequestException('Expected body to be valid JSON.');
    }
  }

  private normalizeValue(value: unknown) {
    if (Array.isArray(value)) {
      return value.length === 1 ? value[0] : value;
    }

    return value;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
