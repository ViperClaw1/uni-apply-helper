"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var WebhookService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebhookService = void 0;
const common_1 = require("@nestjs/common");
const lodash_1 = require("lodash");
const notifications_service_js_1 = require("../notifications/notifications.service.js");
const students_service_js_1 = require("../students/students.service.js");
const FIELD_MAP = {
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
    'Консульство, куда подаётся виза / Consulate Applying for VISA': 'personal.consulate',
    'Семейное положение / Marital status': 'personal.maritalStatus',
    'Электронная почта / E-Mail': 'personal.email',
    'Номер телефона / Phone Number': 'personal.phone',
    'Хобби / Hobby': 'personal.hobby',
    'Постоянный адрес проживания / Permanent Address': 'personal.permanentAddress',
    'Почтовый индекс / Post Code': 'personal.postCode',
    'Текущее место работы или учёбы / Current Employer or Institution Affiliated': 'personal.currentInstitution',
    'Бывали ли вы в Китае? / Have you ever been to China?': 'personal.beenToChina',
    'Учились или работали ли вы в Китае? / Have you ever studied or worked in China?': 'personal.studiedInChina',
    'Высшее образование (степень) / Highest Degree': 'education.0.degree',
    'Учебное заведение окончания / School of Graduation': 'education.0.institution',
    'Специальность / Major': 'education.0.major',
    'Уровень китайского языка (HSK, баллы) / Chinese language level': 'languages.chinese',
    'Уровень английского языка / English language level': 'languages.english',
    'Учебное заведение, куда подаётся заявка / Application School': 'applicationTargets',
    'Специальность заявки / Application Major': 'applicationMajor',
    'Степень / Degree': 'applicationDegree',
    'Срок обучения / Duration of Study': 'applicationDuration',
    'Источник финансирования / Financial resources for study': 'applicationFunding',
    'Имя гаранта / Guarantor Name': 'guarantor.name',
    'Телефон гаранта / Guarantor Phone': 'guarantor.phone',
    'Email гаранта / Guarantor Email': 'guarantor.email',
    'Адрес гаранта / Guarantor Address': 'guarantor.homeAddress',
    'Отношение к гаранту / Relationship': 'guarantor.relationship',
    'Имя контакта / Emergency Name': 'emergencyContact.name',
    'Телефон контакта / Emergency Phone': 'emergencyContact.phone',
    'Email контакта / Emergency Email': 'emergencyContact.email',
    'Отношение / Relationship': 'emergencyContact.relationship',
    'Год начала обучения / Study Period Start': 'education.0.periodStart',
    'Год окончания / Study Period End': 'education.0.periodEnd',
};
const FORM_VALUES_PATHS = [
    undefined,
    'personal.surname',
    'personal.givenName',
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
    'personal.studiedInChina',
    'education.0.degree',
    'education.0.institution',
    'education.0.major',
    'education.0.periodStart',
    'education.0.periodEnd',
    'guarantor.name',
    'guarantor.phone',
    'guarantor.email',
    'guarantor.homeAddress',
    'guarantor.relationship',
    'emergencyContact.name',
    'emergencyContact.phone',
    'emergencyContact.email',
    'emergencyContact.relationship',
    'languages.chinese',
    'languages.english',
    'applicationTargets',
    'applicationMajor',
    'applicationDegree',
    'applicationDuration',
    'applicationFunding',
];
let WebhookService = WebhookService_1 = class WebhookService {
    studentsService;
    notificationsService;
    logger = new common_1.Logger(WebhookService_1.name);
    constructor(studentsService, notificationsService) {
        this.studentsService = studentsService;
        this.notificationsService = notificationsService;
    }
    async processFormSubmission(raw) {
        const parsedRaw = this.parseRawBody(raw);
        const payload = this.extractPayload(parsedRaw);
        const values = this.extractValues(parsedRaw, payload);
        const normalized = {};
        this.logger.log(`Google Form payload keys: ${Object.keys(payload).join(', ') || '(none)'}`);
        for (const [key, value] of Object.entries(payload)) {
            const path = FIELD_MAP[key] ?? this.resolveFieldPath(key);
            if (path) {
                (0, lodash_1.set)(normalized, path, this.normalizeValue(value));
            }
            else {
                this.logger.debug(`Skipped unmapped Google Form field: "${key}"`);
            }
        }
        if (this.isEmptyNormalized(normalized) && values.length > 0) {
            this.applyValuesFallback(normalized, values);
        }
        this.logger.log(`Google Form normalized preview: ${JSON.stringify(this.toNormalizedPreview(normalized))}`);
        const student = await this.studentsService.createFromNormalized(normalized);
        await this.notificationsService.notifyNewStudent(student);
        return student;
    }
    extractPayload(parsedRaw) {
        if (!this.isRecord(parsedRaw)) {
            throw new common_1.BadRequestException('Expected a JSON object body.');
        }
        const candidates = [parsedRaw.namedValues, parsedRaw.data, parsedRaw.payload];
        const candidate = candidates.find((value) => this.isNonEmptyRecord(value)) ?? parsedRaw;
        if (!this.isRecord(candidate)) {
            throw new common_1.BadRequestException('Expected form payload as root object, namedValues, data, or payload.');
        }
        return candidate;
    }
    extractValues(parsedRaw, payload) {
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
    parseRawBody(raw) {
        if (raw === undefined || raw === null) {
            throw new common_1.BadRequestException('Request body was not parsed. Send JSON body with Content-Type: application/json.');
        }
        if (typeof raw !== 'string') {
            return raw;
        }
        const trimmed = raw.trim();
        if (!trimmed) {
            throw new common_1.BadRequestException('Request body is empty.');
        }
        try {
            return JSON.parse(trimmed);
        }
        catch {
            throw new common_1.BadRequestException('Expected body to be valid JSON.');
        }
    }
    normalizeValue(value) {
        if (Array.isArray(value)) {
            return value.length === 1 ? value[0] : value;
        }
        return value;
    }
    applyValuesFallback(normalized, values) {
        const pathOffset = this.looksLikeTimestamp(values[0]) ? 0 : 1;
        for (const [index, value] of values.entries()) {
            const path = FORM_VALUES_PATHS[index + pathOffset];
            const normalizedValue = this.normalizeValue(value);
            if (path && normalizedValue !== '') {
                (0, lodash_1.set)(normalized, path, normalizedValue);
            }
        }
    }
    isEmptyNormalized(normalized) {
        return Object.keys(normalized).length === 0;
    }
    toNormalizedPreview(normalized) {
        const personal = this.isRecord(normalized.personal) ? normalized.personal : {};
        return {
            surname: personal.surname,
            givenName: personal.givenName,
            email: personal.email,
            applicationTargets: normalized.applicationTargets,
        };
    }
    looksLikeTimestamp(value) {
        if (value instanceof Date) {
            return true;
        }
        if (typeof value !== 'string') {
            return false;
        }
        return !Number.isNaN(new Date(value).getTime());
    }
    resolveFieldPath(key) {
        const normalizedKey = this.normalizeKey(key);
        if (this.hasAny(normalizedKey, ['surname', 'фамилия'])) {
            return 'personal.surname';
        }
        if (this.hasAny(normalizedKey, ['given name', 'имя'])) {
            return 'personal.givenName';
        }
        if (this.hasAny(normalizedKey, ['sex', 'пол'])) {
            return 'personal.sex';
        }
        if (this.hasAny(normalizedKey, ['nationality', 'гражданство'])) {
            return 'personal.nationality';
        }
        if (this.hasAny(normalizedKey, ['city of birth', 'город рождения'])) {
            return 'personal.cityOfBirth';
        }
        if (this.hasAny(normalizedKey, ['date of birth', 'дата рождения'])) {
            return 'personal.dateOfBirth';
        }
        if (this.hasAny(normalizedKey, ['chinese name', 'китайское имя'])) {
            return 'personal.chineseName';
        }
        if (this.hasAny(normalizedKey, ['religion', 'религия'])) {
            return 'personal.religion';
        }
        if (this.hasAny(normalizedKey, ['passport no', 'номер паспорта'])) {
            return 'personal.passportNo';
        }
        if (this.hasAny(normalizedKey, [
            'passport expiration',
            'passport expiry',
            'срок действия паспорта',
        ])) {
            return 'personal.passportExpiry';
        }
        if (this.hasAny(normalizedKey, ['consulate', 'консульство'])) {
            return 'personal.consulate';
        }
        if (this.hasAny(normalizedKey, ['marital status', 'семейное положение'])) {
            return 'personal.maritalStatus';
        }
        if (this.hasAny(normalizedKey, ['e mail', 'email', 'электронная почта'])) {
            return 'personal.email';
        }
        if (this.hasAny(normalizedKey, ['phone number', 'phone', 'номер телефона'])) {
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
        if (this.hasAny(normalizedKey, [
            'current employer',
            'current institution',
            'текущее место работы',
            'текущее место учебы',
            'текущее место учёбы',
        ])) {
            return 'personal.currentInstitution';
        }
        if (this.hasAny(normalizedKey, ['ever been to china', 'бывали ли вы в китае'])) {
            return 'personal.beenToChina';
        }
        if (this.hasAny(normalizedKey, [
            'ever studied or worked in china',
            'учились или работали ли вы в китае',
        ])) {
            return 'personal.studiedInChina';
        }
        if (this.hasAny(normalizedKey, ['highest degree', 'высшее образование'])) {
            return 'education.0.degree';
        }
        if (this.hasAny(normalizedKey, [
            'school of graduation',
            'учебное заведение окончания',
        ])) {
            return 'education.0.institution';
        }
        if (this.hasAny(normalizedKey, ['major', 'специальность заявки'])) {
            return this.hasAny(normalizedKey, ['application', 'заявки'])
                ? 'applicationMajor'
                : 'education.0.major';
        }
        if (this.hasAny(normalizedKey, [
            'study period start',
            'год начала обучения',
            'period start',
        ])) {
            return 'education.0.periodStart';
        }
        if (this.hasAny(normalizedKey, [
            'study period end',
            'год окончания',
            'period end',
        ])) {
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
        if (this.hasAny(normalizedKey, ['emergency relationship', 'отношение']) &&
            this.hasAny(normalizedKey, ['emergency', 'контакт', 'экстрен'])) {
            return 'emergencyContact.relationship';
        }
        if (this.hasAny(normalizedKey, ['chinese language', 'китайского языка'])) {
            return 'languages.chinese';
        }
        if (this.hasAny(normalizedKey, ['english language', 'английского языка'])) {
            return 'languages.english';
        }
        if (this.hasAny(normalizedKey, [
            'application school',
            'application university',
            'куда подается заявка',
            'куда подаётся заявка',
        ])) {
            return 'applicationTargets';
        }
        if (this.hasAny(normalizedKey, ['degree', 'степень'])) {
            return 'applicationDegree';
        }
        if (this.hasAny(normalizedKey, ['duration of study', 'срок обучения'])) {
            return 'applicationDuration';
        }
        if (this.hasAny(normalizedKey, [
            'financial resources',
            'funding',
            'источник финансирования',
        ])) {
            return 'applicationFunding';
        }
        return undefined;
    }
    normalizeKey(key) {
        return key
            .toLowerCase()
            .replace(/ё/g, 'е')
            .replace(/[^a-zа-я0-9]+/g, ' ')
            .trim()
            .replace(/\s+/g, ' ');
    }
    hasAny(value, needles) {
        return needles.some((needle) => value.includes(this.normalizeKey(needle)));
    }
    isRecord(value) {
        return typeof value === 'object' && value !== null && !Array.isArray(value);
    }
    isNonEmptyRecord(value) {
        return this.isRecord(value) && Object.keys(value).length > 0;
    }
};
exports.WebhookService = WebhookService;
exports.WebhookService = WebhookService = WebhookService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [students_service_js_1.StudentsService,
        notifications_service_js_1.NotificationsService])
], WebhookService);
//# sourceMappingURL=webhook.service.js.map