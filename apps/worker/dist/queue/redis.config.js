"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRedisConnection = getRedisConnection;
function getRedisConnection() {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
        return {
            host: 'localhost',
            port: 6379,
        };
    }
    const parsedUrl = new URL(redisUrl);
    return {
        host: parsedUrl.hostname,
        port: Number(parsedUrl.port || 6379),
        username: parsedUrl.username || undefined,
        password: parsedUrl.password || undefined,
        tls: parsedUrl.protocol === 'rediss:' ? {} : undefined,
    };
}
//# sourceMappingURL=redis.config.js.map