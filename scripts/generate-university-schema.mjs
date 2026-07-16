#!/usr/bin/env node
/**
 * Generate university schema draft from DOM captures via Gemini.
 *
 * Usage:
 *   node scripts/generate-university-schema.mjs \
 *     --capture data/captures/zzu-step1.json \
 *     --capture data/captures/zzu-step2.json \
 *     --id zhengzhou-university \
 *     --display-name "Zhengzhou University" \
 *     --form-url "https://zzu.17gz.org/apply/index.do" \
 *     --out data/university-schemas/zhengzhou-university.draft.json
 *
 * Or call running API:
 *   node scripts/generate-university-schema.mjs --api http://localhost:3000 ...
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function loadEnvFile(path) {
  try {
    const raw = readFileSync(path, 'utf8');

    for (const line of raw.split('\n')) {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }

      const eq = trimmed.indexOf('=');

      if (eq <= 0) {
        continue;
      }

      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();

      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    // optional
  }
}

loadEnvFile(resolve(rootDir, 'apps/api/.env'));

function parseArgs(argv) {
  const args = {
    captures: [],
    aliases: [],
    api: process.env.API_URL ?? null,
    out: null,
    notes: null,
    id: null,
    displayName: null,
    formUrl: null,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];

    switch (arg) {
      case '--capture':
        args.captures.push(resolve(argv[++i]));
        break;
      case '--alias':
        args.aliases.push(argv[++i]);
        break;
      case '--api':
        args.api = argv[++i];
        break;
      case '--out':
        args.out = resolve(argv[++i]);
        break;
      case '--notes':
        args.notes = argv[++i];
        break;
      case '--id':
        args.id = argv[++i];
        break;
      case '--display-name':
        args.displayName = argv[++i];
        break;
      case '--form-url':
        args.formUrl = argv[++i];
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!args.id || !args.displayName || !args.formUrl) {
    throw new Error('--id, --display-name and --form-url are required.');
  }

  if (args.captures.length === 0) {
    throw new Error('At least one --capture file is required.');
  }

  return args;
}

async function generateViaApi(apiBaseUrl, payload) {
  const response = await fetch(`${apiBaseUrl.replace(/\/$/, '')}/universities/schemas/generate-draft`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API ${response.status}: ${text}`);
  }

  return response.json();
}

async function generateViaGemini(payload) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY missing. Set in apps/api/.env or use --api http://localhost:3000');
  }

  const model =
    process.env.GEMINI_SCHEMA_MODEL ||
    process.env.GEMINI_LETTER_MODEL ||
    'gemini-3.5-flash';

  let GoogleGenAI;

  try {
    ({ GoogleGenAI } = await import('@google/genai'));
  } catch {
    const geminiPath = resolve(rootDir, 'apps/api/node_modules/@google/genai/dist/index.mjs');
    ({ GoogleGenAI } = await import(geminiPath));
  }

  const gemini = new GoogleGenAI({ apiKey });

  const prompt = buildPrompt(payload);
  const response = await gemini.models.generateContent({
    model,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
  });

  const raw = (response.text ?? '').trim();
  const jsonText = extractJson(raw);
  const schema = JSON.parse(jsonText);

  return {
    schema: {
      ...schema,
      id: payload.id,
      displayName: payload.displayName,
      formUrl: payload.formUrl,
      aliases: payload.aliases?.length ? payload.aliases : [payload.displayName],
    },
    warnings: ['Generated via CLI — review before committing.'],
    model,
  };
}

function buildPrompt(input) {
  return [
    'Return ONLY JSON for a university autofill schema. No markdown.',
    `id=${input.id}, displayName=${input.displayName}, formUrl=${input.formUrl}`,
    'captures:',
    JSON.stringify(input.captures, null, 2),
  ].join('\n');
}

function extractJson(raw) {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);

  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');

  if (start >= 0 && end > start) {
    return raw.slice(start, end + 1);
  }

  return raw;
}

const args = parseArgs(process.argv);
const captures = args.captures.map((path) => JSON.parse(readFileSync(path, 'utf8')));

const payload = {
  id: args.id,
  displayName: args.displayName,
  formUrl: args.formUrl,
  aliases: args.aliases.length > 0 ? args.aliases : [args.displayName],
  captures,
  notes: args.notes ?? undefined,
};

const result = args.api
  ? await generateViaApi(args.api, payload)
  : await generateViaGemini(payload);

const outPath =
  args.out ??
  resolve(rootDir, `data/university-schemas/${args.id}.draft.json`);

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(result.schema, null, 2)}\n`, 'utf8');

console.log(`Model: ${result.model}`);
console.log(`Warnings: ${result.warnings?.join('; ') || 'none'}`);
console.log(`Draft written to ${outPath}`);
console.log('Next: review selectors, rename to .json, run POST /universities/schemas/seed');
