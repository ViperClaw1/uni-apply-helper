import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { BrowserService } from '../browser/browser.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ApplicationResumeService } from '../queue/application-resume.service.js';
import { UniversitySchemaService } from '../university-schema/university-schema.service.js';
export declare class SessionHealthCheckProcessor implements OnModuleInit, OnModuleDestroy {
    private readonly browserService;
    private readonly prisma;
    private readonly universitySchemaService;
    private readonly applicationResumeService;
    private readonly logger;
    private queue?;
    private worker?;
    constructor(browserService: BrowserService, prisma: PrismaService, universitySchemaService: UniversitySchemaService, applicationResumeService: ApplicationResumeService);
    onModuleInit(): Promise<void>;
    onModuleDestroy(): Promise<void>;
    private process;
    private checkOne;
    private recordResult;
    private isNearExpiry;
    private originOf;
}
