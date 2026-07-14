"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertProductionDatabaseUrl = assertProductionDatabaseUrl;
function assertProductionDatabaseUrl(connectionString) {
    if (process.env.NODE_ENV !== 'production') {
        return;
    }
    if (/(localhost|127\.0\.0\.1)/.test(connectionString)) {
        throw new Error('DATABASE_URL points to localhost in production. Attach Railway Postgres and reference its DATABASE_URL on this service.');
    }
}
