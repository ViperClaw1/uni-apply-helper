/**
 * Seed university schemas from data/university-schemas/*.json into DB.
 * Usage (from apps/api): node scripts/seed-schemas.mjs
 */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@uni-apply/database');

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '../../..');

function loadEnv(path) {
  try {
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq <= 0) continue;
      const k = t.slice(0, eq).trim();
      const v = t.slice(eq + 1).trim();
      if (!process.env[k]) process.env[k] = v;
    }
  } catch {
    // optional
  }
}

loadEnv(resolve(root, 'apps/api/.env'));
loadEnv(resolve(root, '.env'));

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL required');
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const dir = resolve(root, 'data/university-schemas');
const files = readdirSync(dir).filter(
  (f) => f.endsWith('.json') && !f.endsWith('.draft.json'),
);

let aliases = 0;
for (const file of files) {
  const schema = JSON.parse(readFileSync(join(dir, file), 'utf8'));
  if (!schema.id || file.replace(/\.json$/, '') !== schema.id) {
    console.warn('skip', file, '(id mismatch or missing)');
    continue;
  }

  const versionHash = createHash('sha256')
    .update(JSON.stringify(schema))
    .digest('hex')
    .slice(0, 16);

  await prisma.universitySchema.upsert({
    where: { id: schema.id },
    update: {
      displayName: schema.displayName,
      formUrl: schema.formUrl,
      requiredDocuments: schema.requiredDocuments,
      fields: schema.fields,
      requiresEssay: schema.requiresEssay ?? false,
      essayPrompt: schema.essayPrompt ?? null,
      versionHash,
      notes: schema.notes ?? null,
    },
    create: {
      id: schema.id,
      displayName: schema.displayName,
      formUrl: schema.formUrl,
      requiredDocuments: schema.requiredDocuments,
      fields: schema.fields,
      requiresEssay: schema.requiresEssay ?? false,
      essayPrompt: schema.essayPrompt ?? null,
      versionHash,
      notes: schema.notes ?? null,
    },
  });

  for (const alias of schema.aliases ?? []) {
    await prisma.universityAlias.upsert({
      where: { alias },
      update: { universityId: schema.id },
      create: { alias, universityId: schema.id },
    });
    aliases += 1;
  }

  console.log('seeded', schema.id, schema.displayName);
}

console.log(`done: ${files.length} schemas, ${aliases} aliases`);
await prisma.$disconnect();
