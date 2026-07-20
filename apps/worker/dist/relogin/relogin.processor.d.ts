import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { BrowserService } from '../browser/browser.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
export declare class ReloginProcessor implements OnModuleInit, OnModuleDestroy {
    private readonly browserService;
    private readonly prisma;
    private readonly notificationsService;
    private readonly logger;
    private worker?;
    constructor(browserService: BrowserService, prisma: PrismaService, notificationsService: NotificationsService);
    onModuleInit(): void;
    onModuleDestroy(): Promise<void>;
    private process;
}
