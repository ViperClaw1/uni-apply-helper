import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export const PASSWORD_POLICY_REGEX = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
export const PASSWORD_POLICY_MESSAGE =
  'Password must be at least 8 characters and include at least one letter and one digit.';

const KEY_LENGTH = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, KEY_LENGTH).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  const candidate = scryptSync(password, salt, KEY_LENGTH);
  const expected = Buffer.from(hash, 'hex');

  return (
    candidate.length === expected.length && timingSafeEqual(candidate, expected)
  );
}

// Constant-time-ish comparison target for unknown emails, so login timing
// doesn't reveal whether an account exists.
export const DUMMY_PASSWORD_HASH = hashPassword(
  randomBytes(16).toString('hex'),
);
