import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Bot } from 'grammy';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly bot?: Bot;
  private readonly chatId?: string;

  constructor(private readonly configService: ConfigService) {
    const token = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    this.chatId = this.configService.get<string>('CONSULTANT_CHAT_ID');

    if (!token || !this.chatId) {
      this.logger.warn(
        'Telegram notifications are disabled: TELEGRAM_BOT_TOKEN or CONSULTANT_CHAT_ID is missing.',
      );
      return;
    }

    this.bot = new Bot(token);
  }

  async notifyNewStudent(student: {
    givenName?: string;
    surname?: string;
    email?: string;
  }) {
    await this.send(
      [
        '<b>Новый студент</b>',
        `${this.escapeHtml(student.givenName)} ${this.escapeHtml(student.surname)}`.trim(),
        this.escapeHtml(student.email),
      ].join('\n'),
    );
  }

  async notifyBatchCreated(batch: { total: number; blocked: number }, profile: any) {
    const name = `${profile.personal.givenName} ${profile.personal.surname}`;

    await this.send(
      [
        '<b>Батч запущен</b>',
        `Студент: ${this.escapeHtml(name)}`,
        `Всего вузов: ${batch.total}`,
        `Заблокировано: ${batch.blocked}`,
      ].join('\n'),
    );
  }

  async notifySubmitted(
    universityName: string,
    studentName: string,
    screenshotUrl?: string,
  ) {
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

  async notifyFailed(universityName: string, studentName: string, error: string) {
    await this.send(
      [
        '<b>Ошибка подачи</b>',
        `Вуз: ${this.escapeHtml(universityName)}`,
        `Студент: ${this.escapeHtml(studentName)}`,
        `Причина: ${this.escapeHtml(error)}`,
      ].join('\n'),
    );
  }

  async notifyBlocked(
    studentName: string,
    universityName: string,
    missing: string[],
  ) {
    await this.send(
      [
        '<b>Заблокировано</b>',
        `Студент: ${this.escapeHtml(studentName)}`,
        `Вуз: ${this.escapeHtml(universityName)}`,
        `Отсутствует: ${this.escapeHtml(missing.join(', '))}`,
      ].join('\n'),
    );
  }

  async notifyUnresolved(studentName: string, rawNames: string[]) {
    await this.send(
      [
        '<b>Не удалось определить вуз</b>',
        `Студент: ${this.escapeHtml(studentName)}`,
        `Названия: ${this.escapeHtml(rawNames.join(', '))}`,
      ].join('\n'),
    );
  }

  private async send(text: string) {
    if (!this.bot || !this.chatId) {
      this.logger.debug(`Skipped Telegram notification: ${text}`);
      return;
    }

    await this.bot.api.sendMessage(this.chatId, text, { parse_mode: 'HTML' });
  }

  private escapeHtml(value: unknown) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}
