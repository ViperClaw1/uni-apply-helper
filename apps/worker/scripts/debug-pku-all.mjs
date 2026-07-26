/**
 * Run all PKU offline debug harnesses before deploy.
 * Usage: node apps/worker/scripts/debug-pku-all.mjs
 *    or: pnpm --filter worker debug:pku-all
 */
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const scripts = [
  'debug-pku-step1-waiver.mjs',
  'debug-pku-steps-2-7.mjs',
];

let failed = 0;
for (const script of scripts) {
  console.log(`\n########## ${script} ##########\n`);
  const result = spawnSync(process.execPath, [resolve(__dirname, script)], {
    stdio: 'inherit',
    cwd: resolve(__dirname, '..'),
  });
  if (result.status !== 0) {
    failed += 1;
    console.error(`\n${script} FAILED (exit ${result.status})`);
  }
}

if (failed > 0) {
  console.error(`\n${failed}/${scripts.length} harness(es) failed`);
  process.exit(1);
}

console.log(`\nAll ${scripts.length} PKU offline harnesses passed.`);
console.log(
  'Live E2E still needs a fresh session: pnpm --filter worker capture:pku-session',
);
