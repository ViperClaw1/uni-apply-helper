import { Injectable } from '@nestjs/common';
import { set } from 'lodash';
import { NotificationsService } from '../notifications/notifications.service';
import { StudentsService } from '../students/students.service';

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

  async processFormSubmission(raw: Record<string, unknown>) {
    const normalized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(raw)) {
      const path = FIELD_MAP[key];

      if (path) {
        set(normalized, path, this.normalizeValue(value));
      }
    }

    const student = await this.studentsService.createFromNormalized(normalized);

    await this.notificationsService.notifyNewStudent(student);

    return student;
  }

  private normalizeValue(value: unknown) {
    if (Array.isArray(value)) {
      return value.length === 1 ? value[0] : value;
    }

    return value;
  }
}
