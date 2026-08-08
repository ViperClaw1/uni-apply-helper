"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DUMMY_PASSWORD_HASH = exports.PASSWORD_POLICY_MESSAGE = exports.PASSWORD_POLICY_REGEX = void 0;
exports.hashPassword = hashPassword;
exports.verifyPassword = verifyPassword;
const node_crypto_1 = require("node:crypto");
exports.PASSWORD_POLICY_REGEX = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
exports.PASSWORD_POLICY_MESSAGE = 'Password must be at least 8 characters and include at least one letter and one digit.';
const KEY_LENGTH = 64;
function hashPassword(password) {
    const salt = (0, node_crypto_1.randomBytes)(16).toString('hex');
    const hash = (0, node_crypto_1.scryptSync)(password, salt, KEY_LENGTH).toString('hex');
    return `${salt}:${hash}`;
}
function verifyPassword(password, stored) {
    const [salt, hash] = stored.split(':');
    const candidate = (0, node_crypto_1.scryptSync)(password, salt, KEY_LENGTH);
    const expected = Buffer.from(hash, 'hex');
    return (candidate.length === expected.length && (0, node_crypto_1.timingSafeEqual)(candidate, expected));
}
exports.DUMMY_PASSWORD_HASH = hashPassword((0, node_crypto_1.randomBytes)(16).toString('hex'));
//# sourceMappingURL=password.util.js.map