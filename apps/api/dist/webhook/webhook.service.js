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
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebhookService = void 0;
const common_1 = require("@nestjs/common");
const lodash_1 = require("lodash");
const notifications_service_js_1 = require("../notifications/notifications.service.js");
const students_service_js_1 = require("../students/students.service.js");
const FIELD_MAP = {
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
};
let WebhookService = class WebhookService {
    studentsService;
    notificationsService;
    constructor(studentsService, notificationsService) {
        this.studentsService = studentsService;
        this.notificationsService = notificationsService;
    }
    async processFormSubmission(raw) {
        const payload = this.extractPayload(raw);
        const normalized = {};
        for (const [key, value] of Object.entries(payload)) {
            const path = FIELD_MAP[key];
            if (path) {
                (0, lodash_1.set)(normalized, path, this.normalizeValue(value));
            }
        }
        const student = await this.studentsService.createFromNormalized(normalized);
        await this.notificationsService.notifyNewStudent(student);
        return student;
    }
    extractPayload(raw) {
        const parsedRaw = this.parseRawBody(raw);
        if (!this.isRecord(parsedRaw)) {
            throw new common_1.BadRequestException('Expected a JSON object body.');
        }
        const candidate = parsedRaw.namedValues ?? parsedRaw.data ?? parsedRaw.payload ?? parsedRaw;
        if (!this.isRecord(candidate)) {
            throw new common_1.BadRequestException('Expected form payload as root object, namedValues, data, or payload.');
        }
        return candidate;
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
    isRecord(value) {
        return typeof value === 'object' && value !== null && !Array.isArray(value);
    }
};
exports.WebhookService = WebhookService;
exports.WebhookService = WebhookService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [students_service_js_1.StudentsService,
        notifications_service_js_1.NotificationsService])
], WebhookService);
//# sourceMappingURL=webhook.service.js.map