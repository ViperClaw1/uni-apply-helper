export function assertApiRailwayService(): void {
  if (process.env.RAILWAY_SERVICE_NAME !== 'worker') {
    return;
  }

  throw new Error(
    [
      'Railway service "worker" is starting apps/api (HTTP server).',
      'Fix: Settings → Build → Dockerfile Path = apps/worker/Dockerfile',
      'Or Config-as-code path = apps/worker/railway.toml',
    ].join(' '),
  );
}
