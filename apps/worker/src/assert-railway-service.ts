export function assertWorkerRuntime(): void {
  if (process.env.UNI_APPLY_RUNTIME === 'worker') {
    return;
  }

  if (process.env.RAILWAY_SERVICE_NAME === 'worker') {
    throw new Error(
      [
        'Railway service "worker" is not running apps/worker.',
        'Fix: Settings → Build → Dockerfile Path = apps/worker/Dockerfile',
        'Or Config-as-code path = apps/worker/railway.toml',
      ].join(' '),
    );
  }
}
