# Uni Apply Helper — Chrome Extension

Semi-automatic university application form filler for consultants.

## Setup

1. Build shared package: `pnpm --filter @uni-apply/shared build`
2. Install deps: `pnpm --filter @uni-apply/extension install`
3. Build: `pnpm --filter @uni-apply/extension build`
4. Chrome → `chrome://extensions` → Developer mode → Load unpacked → `apps/extension/dist`
5. Open popup → set API URL (`http://localhost:3000`) and `EXTENSION_API_KEY` from API `.env`

## Flow

1. Dashboard: create batch → applications get `ready_for_submission`
2. Click **Открыть форму** → extension receives `SET_ACTIVE_CONTEXT` + form opens
3. Content script fetches profile via `GET /applications/active` and fills fields
4. Consultant reviews and clicks Submit on university site
5. Extension calls `POST /applications/:id/submit` → Telegram notification

## Development

```bash
pnpm --filter @uni-apply/extension dev
```

Load `apps/extension/dist` in Chrome (rebuild on changes).
