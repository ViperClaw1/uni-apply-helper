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
var NotificationsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationsService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const grammy_1 = require("grammy");
let NotificationsService = NotificationsService_1 = class NotificationsService {
    configService;
    logger = new common_1.Logger(NotificationsService_1.name);
    bot;
    chatId;
    constructor(configService) {
        this.configService = configService;
        const token = this.configService.get('TELEGRAM_BOT_TOKEN');
        this.chatId = this.configService.get('CONSULTANT_CHAT_ID');
        if (!token || !this.chatId) {
            this.logger.warn('Telegram notifications are disabled: TELEGRAM_BOT_TOKEN or CONSULTANT_CHAT_ID is missing.');
            return;
        }
        this.bot = new grammy_1.Bot(token);
    }
    async notifySubmitted(universityName, studentName, screenshotUrl) {
        const message = [
            '<b>Заявка отправлена</b>',
            `Студент: ${this.escapeHtml(studentName)}`,
            `Вуз: ${this.escapeHtml(universityName)}`,
        ];
        if (screenshotUrl) {
            message.push(`Скриншот: ${this.escapeHtml(screenshotUrl)}`);
        }
        await this.send(message.join('\n'));
    }
    async notifyFailed(universityName, studentName, error) {
        await this.send([
            '<b>Ошибка подачи</b>',
            `Вуз: ${this.escapeHtml(universityName)}`,
            `Студент: ${this.escapeHtml(studentName)}`,
            `Причина: ${this.escapeHtml(error)}`,
        ].join('\n'));
    }
    async notifySessionExpired(universityName, universityId) {
        await this.send([
            '<b>Сессия браузера истекла</b>',
            `Вуз: ${this.escapeHtml(universityName)}`,
            `Переавторизация: PATCH /universities/${this.escapeHtml(universityId)}/relogin`,
            'Или локально: pnpm --filter worker capture:zzu-session',
        ].join('\n'));
    }
    async notifyReloginStarted(universityName, universityId, profileDir) {
        await this.send([
            '<b>Re-login: браузер открыт</b>',
            `Вуз: ${this.escapeHtml(universityName)}`,
            profileDir
                ? `Профиль: ${this.escapeHtml(profileDir)}`
                : `Профиль: profiles/${this.escapeHtml(universityId)}`,
            'Залогинься в открывшемся окне. Сессия сохранится автоматически.',
        ].join('\n'));
    }
    async notifyReloginCompleted(universityName, universityId) {
        await this.send([
            '<b>Re-login завершён</b>',
            `Вуз: ${this.escapeHtml(universityName)}`,
            `ID: ${this.escapeHtml(universityId)}`,
            'Профиль сохранён. Можно повторить подачу заявок.',
        ].join('\n'));
    }
    async send(text) {
        if (!this.bot || !this.chatId) {
            this.logger.debug(`Skipped Telegram notification: ${text}`);
            return;
        }
        await this.bot.api.sendMessage(this.chatId, text, { parse_mode: 'HTML' });
    }
    escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }
};
exports.NotificationsService = NotificationsService;
exports.NotificationsService = NotificationsService = NotificationsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], NotificationsService);
//# sourceMappingURL=notifications.service.js.map