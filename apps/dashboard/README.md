# Uni Apply Dashboard

Минимальная панель консультанта поверх существующего NestJS API.

## Local

```bash
cp .env.example .env.local
pnpm dev
```

`NEXT_PUBLIC_API_URL` должен указывать на API, например `http://localhost:3000`.

## Pages

- `/` - список студентов.
- `/students/[id]` - карточка студента, документы и последний batch заявок.
- `/students/new` - заглушка до появления `POST /students` в API.

## Vercel

При импорте репозитория:

- Root Directory: `apps/dashboard`
- Environment Variables:
  - `NEXT_PUBLIC_API_URL=https://<railway-api-url>`
  - `NEXT_PUBLIC_EXTENSION_ID=<chrome-extension-id>` (optional)

`vercel.json` в этой папке запускает `turbo build --filter=@uni-apply/dashboard` из корня монорепо.
В `turbo.json` для build указаны outputs `.next/**` — без этого Vercel не находит `routes-manifest.json`.

После фикса turbo outputs: **Redeploy** с очисткой кэша (Deployments → ⋯ → Redeploy → uncheck "Use existing Build Cache" или `vercel --force`).

## Railway API

Для CORS добавить в переменные API:

```bash
DASHBOARD_ORIGIN=https://<vercel-dashboard-domain>
```

Если нужно несколько origins, передать через запятую.
