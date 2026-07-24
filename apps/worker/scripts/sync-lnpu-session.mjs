import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd(), '../..');
const fresh = resolve(root, 'data/captures/lnpu/session.json');
const sessionsDir = resolve(process.cwd(), 'browser-sessions');
mkdirSync(sessionsDir, { recursive: true });

const sessionFile = resolve(sessionsDir, 'lnpu.json');
const b64File = resolve(sessionsDir, 'lnpu.json.b64');
const captureB64 = resolve(root, 'data/captures/lnpu/session.json.b64');

copyFileSync(fresh, sessionFile);
const b64 = Buffer.from(readFileSync(sessionFile)).toString('base64');
writeFileSync(b64File, b64, 'utf-8');
writeFileSync(captureB64, b64, 'utf-8');

const session = JSON.parse(readFileSync(sessionFile, 'utf-8'));
const leftMin = Math.round((session.cookies[0].expires - Date.now() / 1000) / 60);
console.log('synced fresh session → browser-sessions/lnpu.json(.b64)');
console.log('cookie', session.cookies[0].value.slice(0, 16), `left ~${leftMin} min`);
