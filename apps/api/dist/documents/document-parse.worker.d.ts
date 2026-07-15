import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ParserService } from './parser.service.js';
export declare class DocumentParseWorker implements OnModuleInit, OnModuleDestroy {
    private readonly parserService;
    private readonly logger;
    private worker?;
    constructor(parserService: ParserService);
    onModuleInit(): void;
    onModuleDestroy(): Promise<void>;
    private process;
    private getRedisConnection;
}
