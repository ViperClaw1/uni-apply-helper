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

## Railway API

Для CORS добавить в переменные API:

```bash
DASHBOARD_ORIGIN=https://<vercel-dashboard-domain>
```

Если нужно несколько origins, передать через запятую.
