"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.redisClientProvider = exports.REDIS_CLIENT = void 0;
const ioredis_1 = require("ioredis");
exports.REDIS_CLIENT = Symbol('REDIS_CLIENT');
exports.redisClientProvider = {
    provide: exports.REDIS_CLIENT,
    useFactory: () => new ioredis_1.Redis(process.env.REDIS_URL ?? 'redis://localhost:6379'),
};
//# sourceMappingURL=redis-client.provider.js.map