import { defineConfig } from 'prisma/config';

const databaseUrl =
  process.env.DATABASE_URL ?? 'postgresql://postgres:VmWMAtAtAXUJVjhUFesPutyamkNLCkcf@tokaido.proxy.rlwy.net:54006/railway';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: databaseUrl,
  },
});
