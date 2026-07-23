import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getSessionPaths } from './browser-session.mjs';

const RAILWAY_API_URL = 'https://backboard.railway.com/graphql/v2';

function getPrimarySessionEnvKey(universityId) {
  return `${universityId.toUpperCase().replace(/-/g, '_')}_SESSION_STATE_B64`;
}

function getSessionEnvKeys(universityId) {
  const primary = getPrimarySessionEnvKey(universityId);
  const aliases = {
    'zhengzhou-university': ['ZZU_SESSION_STATE_B64'],
    'shandong-university': ['SDU_SESSION_STATE_B64'],
  };

  return [...new Set([primary, ...(aliases[universityId] ?? [])])];
}

function readRequiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing ${name}`);
  }
  return value;
}

async function railwayGraphql(query, variables) {
  const token = readRequiredEnv('RAILWAY_API_TOKEN');
  const response = await fetch(RAILWAY_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  const payload = await response.json();
  if (!response.ok || payload.errors?.length) {
    const details = payload.errors?.map((error) => error.message).join('; ');
    throw new Error(details || `Railway API HTTP ${response.status}`);
  }

  return payload.data;
}

/**
 * Upserts session base64 into Railway worker vars and triggers redeploy
 * (variableUpsert redeploys by default unless skipDeploys: true).
 *
 * Required env:
 *   RAILWAY_API_TOKEN
 *   RAILWAY_PROJECT_ID
 *   RAILWAY_ENVIRONMENT_ID
 *   RAILWAY_SERVICE_ID   (worker)
 */
export async function pushSessionToRailway(universityId) {
  const { b64File } = getSessionPaths(universityId);

  if (!existsSync(b64File)) {
    throw new Error(`Session base64 not found: ${b64File}`);
  }

  const value = readFileSync(b64File, 'utf-8').trim();
  if (!value) {
    throw new Error(`Session base64 is empty: ${b64File}`);
  }

  const projectId = readRequiredEnv('RAILWAY_PROJECT_ID');
  const environmentId = readRequiredEnv('RAILWAY_ENVIRONMENT_ID');
  const serviceId = readRequiredEnv('RAILWAY_SERVICE_ID');
  const keys = getSessionEnvKeys(universityId);

  for (const name of keys) {
    await railwayGraphql(
      `mutation VariableUpsert($input: VariableUpsertInput!) {
        variableUpsert(input: $input)
      }`,
      {
        input: {
          projectId,
          environmentId,
          serviceId,
          name,
          value,
        },
      },
    );
    console.log(`Railway: upserted ${name}`);
  }

  console.log('Railway: worker redeploy triggered by variable upsert.');
}

export function canPushToRailway() {
  return Boolean(
    process.env.RAILWAY_API_TOKEN?.trim() &&
      process.env.RAILWAY_PROJECT_ID?.trim() &&
      process.env.RAILWAY_ENVIRONMENT_ID?.trim() &&
      process.env.RAILWAY_SERVICE_ID?.trim(),
  );
}

/** Load apps/worker/.env into process.env without overriding existing keys. */
export function loadWorkerEnvFile() {
  const envPath = resolve(process.cwd(), '.env');
  if (!existsSync(envPath)) {
    return;
  }

  for (const line of readFileSync(envPath, 'utf-8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const eq = trimmed.indexOf('=');
    if (eq <= 0) {
      continue;
    }

    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}
