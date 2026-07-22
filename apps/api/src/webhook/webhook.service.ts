import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { set } from 'lodash';
import { NotificationsService } from '../notifications/notifications.service.js';
import { StudentsService } from '../students/students.service.js';

const FIELD_MAP: Record<string, string> = {
  // Section 1: Basic data
  'Имя (заглавными буквами) / Given Name': 'personal.givenName',
  'Фамилия (заглавными буквами) / Surname': 'personal.surname',
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

  // Section 2: Education
  'Учились или работали ли вы в Китае? / Have you ever studied or worked in China?':
    'personal.studiedInChina',
  'Высшее образование (степень) / Highest Degree': 'education.0.degree',
  'Учебное заведение окончания / School of Graduation':
    'education.0.institution',
  'Специальность / Major': 'education.0.major',
  'Уровень китайского языка (HSK, баллы) / Chinese language level':
    'languages.chinese',
  'Уровень английского языка / English language level': 'languages.english',
  'Специальность заявки / Application Major': 'applicationMajor',
  'Степень / Degree': 'applicationDegree',
  'Год начала обучения / Study Period Start': 'education.0.periodStart',
  'Год окончания / Study Period End': 'education.0.periodEnd',
  'Источник финансирования / Financial resources for study':
    'applicationFunding',

  // Section 3: Guarantor
  'Имя гаранта / Guarantor Name': 'guarantor.name',
  'Телефон гаранта / Guarantor Phone': 'guarantor.phone',
  'Email гаранта / Guarantor Email': 'guarantor.email',
  'Адрес гаранта / Guarantor Address': 'guarantor.homeAddress',
  'Отношение к гаранту / Relationship': 'guarantor.relationship',

  // Section 4: Emergency contact
  'Имя контакта / Emergency Name': 'emergencyContact.name',
  'Телефон контакта / Emergency Phone': 'emergencyContact.phone',
  'Email контакта / Emergency Email': 'emergencyContact.email',
  'Отношение / Relationship': 'emergencyContact.relationship',

  // Section 5: Relatives
  "Полное имя отца / Father's full name": 'family.father.fullName',
  "Национальность отца / Father's nationality": 'family.father.nationality',
  "Номер телефона отца / Father's phone number": 'family.father.phone',
  "Email отца / Father's email": 'family.father.email',
  "Место работы отца / Father's work place": 'family.father.company',
  "Должность отца / Father's job": 'family.father.position',
  "Полное имя матери / Mother's full name": 'family.mother.fullName',
  "Национальность матери / Mother's nationality": 'family.mother.nationality',
  "Номер телефона матери / Mother's phone number": 'family.mother.phone',
  "Email матери / Mother's email": 'family.mother.email',
  "Место работы матери / Mother's work place": 'family.mother.company',
  "Должность матери / Mother's job": 'family.mother.position',
};

/** Positional fallback for Apps Script `values[]` (index 0 = timestamp). */
const FORM_VALUES_PATHS = [
  undefined,
  // Section 1
  'personal.givenName',
  'personal.surname',
  'personal.sex',
  'personal.nationality',
  'personal.cityOfBirth',
  'personal.dateOfBirth',
  'personal.chineseName',
  'personal.religion',
  'personal.passportNo',
  'personal.passportExpiry',
  'personal.consulate',
  'personal.maritalStatus',
  'personal.email',
  'personal.phone',
  'personal.hobby',
  'personal.permanentAddress',
  'personal.postCode',
  'personal.currentInstitution',
  'personal.beenToChina',
  // Section 2
  'personal.studiedInChina',
  'education.0.degree',
  'education.0.institution',
  'education.0.major',
  'languages.chinese',
  'languages.english',
  'applicationMajor',
  'applicationDegree',
  'education.0.periodStart',
  'education.0.periodEnd',
  'applicationFunding',
  // Section 3
  'guarantor.name',
  'guarantor.phone',
  'guarantor.email',
  'guarantor.homeAddress',
  'guarantor.relationship',
  // Section 4
  'emergencyContact.name',
  'emergencyContact.phone',
  'emergencyContact.email',
  'emergencyContact.relationship',
  // Section 5
  'family.father.fullName',
  'family.father.nationality',
  'family.father.phone',
  'family.father.email',
  'family.father.company',
  'family.father.position',
  'family.mother.fullName',
  'family.mother.nationality',
  'family.mother.phone',
  'family.mother.email',
  'family.mother.company',
  'family.mother.position',
] as const;

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    private readonly studentsService: StudentsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async processFormSubmission(raw: unknown) {
    const parsedRaw = this.parseRawBody(raw);
    const payload = this.extractPayload(parsedRaw);
    const values = this.extractValues(parsedRaw, payload);
    const normalized: Record<string, unknown> = {};

    this.logger.log(
      `Google Form payload keys: ${Object.keys(payload).join(', ') || '(none)'}`,
    );

    for (const [key, value] of Object.entries(payload)) {
      const path = FIELD_MAP[key] ?? this.resolveFieldPath(key);

      if (path) {
        set(normalized, path, this.normalizeValue(value));
      } else {
        this.logger.debug(`Skipped unmapped Google Form field: "${key}"`);
      }
    }

    if (this.isEmptyNormalized(normalized) && values.length > 0) {
      this.applyValuesFallback(normalized, values);
    }

    this.logger.log(
      `Google Form normalized preview: ${JSON.stringify(this.toNormalizedPreview(normalized))}`,
    );

    const student = await this.studentsService.createFromNormalized(normalized);

    await this.notificationsService.notifyNewStudent(student);

    return student;
  }

  private extractPayload(parsedRaw: unknown): Record<string, unknown> {
    if (!this.isRecord(parsedRaw)) {
      throw new BadRequestException('Expected a JSON object body.');
    }

    const candidates = [parsedRaw.namedValues, parsedRaw.data, parsedRaw.payload];
    const candidate =
      candidates.find((value) => this.isNonEmptyRecord(value)) ?? parsedRaw;

    if (!this.isRecord(candidate)) {
      throw new BadRequestException(
        'Expected form payload as root object, namedValues, data, or payload.',
      );
    }

    return candidate;
  }

  private extractValues(
    parsedRaw: unknown,
    payload: Record<string, unknown>,
  ): unknown[] {
    const candidates = this.isRecord(parsedRaw)
      ? [parsedRaw.values, parsedRaw.data, parsedRaw.payload, payload.values]
      : [payload.values];

    for (const candidate of candidates) {
      if (Array.isArray(candidate)) {
        return candidate;
      }

      if (this.isRecord(candidate) && Array.isArray(candidate.values)) {
        return candidate.values;
      }
    }

    return [];
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

  private applyValuesFallback(
    normalized: Record<string, unknown>,
    values: unknown[],
  ) {
    const pathOffset = this.looksLikeTimestamp(values[0]) ? 0 : 1;

    for (const [index, value] of values.entries()) {
      const path = FORM_VALUES_PATHS[index + pathOffset];
      const normalizedValue = this.normalizeValue(value);

      if (path && normalizedValue !== '') {
        set(normalized, path, normalizedValue);
      }
    }
  }

  private isEmptyNormalized(normalized: Record<string, unknown>) {
    return Object.keys(normalized).length === 0;
  }

  private toNormalizedPreview(normalized: Record<string, unknown>) {
    const personal = this.isRecord(normalized.personal) ? normalized.personal : {};
    const family = this.isRecord(normalized.family) ? normalized.family : {};

    return {
      surname: personal.surname,
      givenName: personal.givenName,
      email: personal.email,
      applicationMajor: normalized.applicationMajor,
      applicationDegree: normalized.applicationDegree,
      familyFather: this.isRecord(family.father) ? family.father.fullName : undefined,
      familyMother: this.isRecord(family.mother) ? family.mother.fullName : undefined,
    };
  }

  private looksLikeTimestamp(value: unknown) {
    if (value instanceof Date) {
      return true;
    }

    if (typeof value !== 'string') {
      return false;
    }

    return !Number.isNaN(new Date(value).getTime());
  }

  private resolveFieldPath(key: string): string | undefined {
    const normalizedKey = this.normalizeKey(key);

    // Relatives first — otherwise "Father's email" hits personal.email
    const fatherPath = this.resolveRelativePath(normalizedKey, 'father', 'отца');
    if (fatherPath) {
      return fatherPath;
    }

    const motherPath = this.resolveRelativePath(normalizedKey, 'mother', 'матери');
    if (motherPath) {
      return motherPath;
    }

    if (this.hasAny(normalizedKey, ['surname', 'фамилия'])) {
      return 'personal.surname';
    }

    if (this.hasAny(normalizedKey, ['chinese name', 'китайское имя'])) {
      return 'personal.chineseName';
    }

    if (
      this.hasAny(normalizedKey, ['given name', 'имя']) &&
      !this.hasAny(normalizedKey, [
        'guarantor',
        'гаранта',
        'emergency',
        'контакта',
        'chinese',
        'китайское',
        'father',
        'mother',
        'отца',
        'матери',
      ])
    ) {
      return 'personal.givenName';
    }

    if (this.hasAny(normalizedKey, ['sex', 'пол']) &&
      !this.hasAny(normalizedKey, ['marital', 'семейное'])) {
      return 'personal.sex';
    }

    if (
      this.hasAny(normalizedKey, ['nationality', 'гражданство']) &&
      !this.hasAny(normalizedKey, ['father', 'mother', 'отца', 'матери'])
    ) {
      return 'personal.nationality';
    }

    if (this.hasAny(normalizedKey, ['city of birth', 'город рождения'])) {
      return 'personal.cityOfBirth';
    }

    if (this.hasAny(normalizedKey, ['date of birth', 'дата рождения'])) {
      return 'personal.dateOfBirth';
    }

    if (this.hasAny(normalizedKey, ['religion', 'религия'])) {
      return 'personal.religion';
    }

    if (this.hasAny(normalizedKey, ['passport no', 'номер паспорта'])) {
      return 'personal.passportNo';
    }

    if (
      this.hasAny(normalizedKey, [
        'passport expiration',
        'passport expiry',
        'срок действия паспорта',
      ])
    ) {
      return 'personal.passportExpiry';
    }

    if (this.hasAny(normalizedKey, ['consulate', 'консульство'])) {
      return 'personal.consulate';
    }

    if (this.hasAny(normalizedKey, ['marital status', 'семейное положение'])) {
      return 'personal.maritalStatus';
    }

    if (
      this.hasAny(normalizedKey, ['e mail', 'email', 'электронная почта']) &&
      !this.hasAny(normalizedKey, [
        'guarantor',
        'гаранта',
        'emergency',
        'контакта',
        'father',
        'mother',
        'отца',
        'матери',
      ])
    ) {
      return 'personal.email';
    }

    if (
      this.hasAny(normalizedKey, ['phone number', 'phone', 'номер телефона']) &&
      !this.hasAny(normalizedKey, [
        'guarantor',
        'гаранта',
        'emergency',
        'контакта',
        'father',
        'mother',
        'отца',
        'матери',
      ])
    ) {
      return 'personal.phone';
    }

    if (this.hasAny(normalizedKey, ['hobby', 'хобби'])) {
      return 'personal.hobby';
    }

    if (this.hasAny(normalizedKey, ['permanent address', 'постоянный адрес'])) {
      return 'personal.permanentAddress';
    }

    if (this.hasAny(normalizedKey, ['post code', 'почтовый индекс'])) {
      return 'personal.postCode';
    }

    if (
      this.hasAny(normalizedKey, [
        'current employer',
        'current institution',
        'текущее место работы',
        'текущее место учебы',
        'текущее место учёбы',
      ])
    ) {
      return 'personal.currentInstitution';
    }

    if (this.hasAny(normalizedKey, ['ever been to china', 'бывали ли вы в китае'])) {
      return 'personal.beenToChina';
    }

    if (
      this.hasAny(normalizedKey, [
        'ever studied or worked in china',
        'учились или работали ли вы в китае',
      ])
    ) {
      return 'personal.studiedInChina';
    }

    if (this.hasAny(normalizedKey, ['highest degree', 'высшее образование'])) {
      return 'education.0.degree';
    }

    if (
      this.hasAny(normalizedKey, [
        'school of graduation',
        'учебное заведение окончания',
      ])
    ) {
      return 'education.0.institution';
    }

    if (
      this.hasAny(normalizedKey, ['application major', 'специальность заявки'])
    ) {
      return 'applicationMajor';
    }

    if (
      this.hasAny(normalizedKey, ['major', 'специальность']) &&
      !this.hasAny(normalizedKey, ['application', 'заявки'])
    ) {
      return 'education.0.major';
    }

    if (
      this.hasAny(normalizedKey, [
        'study period start',
        'год начала обучения',
        'period start',
      ])
    ) {
      return 'education.0.periodStart';
    }

    if (
      this.hasAny(normalizedKey, [
        'study period end',
        'год окончания',
        'period end',
      ])
    ) {
      return 'education.0.periodEnd';
    }

    if (this.hasAny(normalizedKey, ['guarantor name', 'имя гаранта'])) {
      return 'guarantor.name';
    }

    if (this.hasAny(normalizedKey, ['guarantor phone', 'телефон гаранта'])) {
      return 'guarantor.phone';
    }

    if (this.hasAny(normalizedKey, ['guarantor email', 'email гаранта'])) {
      return 'guarantor.email';
    }

    if (this.hasAny(normalizedKey, ['guarantor address', 'адрес гаранта'])) {
      return 'guarantor.homeAddress';
    }

    if (this.hasAny(normalizedKey, ['guarantor relationship', 'отношение к гаранту'])) {
      return 'guarantor.relationship';
    }

    if (this.hasAny(normalizedKey, ['emergency name', 'имя контакта'])) {
      return 'emergencyContact.name';
    }

    if (this.hasAny(normalizedKey, ['emergency phone', 'телефон контакта'])) {
      return 'emergencyContact.phone';
    }

    if (this.hasAny(normalizedKey, ['emergency email', 'email контакта'])) {
      return 'emergencyContact.email';
    }

    if (
      this.hasAny(normalizedKey, ['relationship', 'отношение']) &&
      this.hasAny(normalizedKey, ['emergency', 'контакт', 'экстрен'])
    ) {
      return 'emergencyContact.relationship';
    }

    // Section 4 title is just "Отношение / Relationship"
    if (
      normalizedKey === 'отношение relationship' ||
      normalizedKey === 'relationship' ||
      normalizedKey === 'отношение'
    ) {
      return 'emergencyContact.relationship';
    }

    if (this.hasAny(normalizedKey, ['chinese language', 'китайского языка'])) {
      return 'languages.chinese';
    }

    if (this.hasAny(normalizedKey, ['english language', 'английского языка'])) {
      return 'languages.english';
    }

    if (
      this.hasAny(normalizedKey, ['degree', 'степень']) &&
      !this.hasAny(normalizedKey, ['highest', 'высшее', 'образование'])
    ) {
      return 'applicationDegree';
    }

    if (
      this.hasAny(normalizedKey, [
        'financial resources',
        'funding',
        'источник финансирования',
      ])
    ) {
      return 'applicationFunding';
    }

    return undefined;
  }

  private resolveRelativePath(
    normalizedKey: string,
    englishRole: 'father' | 'mother',
    russianRole: string,
  ): string | undefined {
    if (!this.hasAny(normalizedKey, [englishRole, russianRole])) {
      return undefined;
    }

    const prefix = `family.${englishRole}`;

    if (this.hasAny(normalizedKey, ['full name', 'полное имя', 'name', 'имя'])) {
      return `${prefix}.fullName`;
    }

    if (this.hasAny(normalizedKey, ['nationality', 'национальность'])) {
      return `${prefix}.nationality`;
    }

    if (this.hasAny(normalizedKey, ['phone', 'телефон'])) {
      return `${prefix}.phone`;
    }

    if (this.hasAny(normalizedKey, ['email', 'e mail'])) {
      return `${prefix}.email`;
    }

    if (
      this.hasAny(normalizedKey, [
        'work place',
        'workplace',
        'место работы',
        'company',
      ])
    ) {
      return `${prefix}.company`;
    }

    if (this.hasAny(normalizedKey, ['job', 'должность', 'position'])) {
      return `${prefix}.position`;
    }

    return undefined;
  }

  private normalizeKey(key: string) {
    return key
      .toLowerCase()
      .replace(/ё/g, 'е')
      .replace(/[^a-zа-я0-9]+/g, ' ')
      .trim()
      .replace(/\s+/g, ' ');
  }

  private hasAny(value: string, needles: string[]) {
    return needles.some((needle) => value.includes(this.normalizeKey(needle)));
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private isNonEmptyRecord(value: unknown): value is Record<string, unknown> {
    return this.isRecord(value) && Object.keys(value).length > 0;
  }
}
