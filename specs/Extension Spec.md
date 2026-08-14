---
tags: [project/uni-apply-helper, type/spec]
project: "Uni Apply Helper"
status: draft
created: 2026-07-17
updated: 2026-07-17
aliases: [Chrome Extension, Form Filler]
---

# Extension Spec

Path: `apps/extension`. Chrome MV3 (`manifest.config.ts`, Vite build). See [[adr-004-semi-auto-extension-over-full-automation]] for why this replaced the Playwright worker.

## Responsibility

Semi-automatic form filler for consultants: reads the active application context from the API, fills recognized fields on the university's live application page, and reports submission back to the API. Login, CAPTCHA, CSRF, program selection, and the final Submit click stay manual.

## Structure

| Dir | Role |
|---|---|
| `background` | Extension service worker — routing messages, holding active context |
| `content` | Injected into the university form page — reads DOM per `UniversitySchema.fields[].selector`, fills matched fields |
| `popup` | Consultant-facing settings — API URL, `EXTENSION_API_KEY` |
| `side-panel` | Field-fill status UI (green/red per field, per [[University Schema Onboarding Spec]] Step 4) |
| `shared` | Types/utilities shared across the above contexts |

## Flow

1. Dashboard creates a batch → applications reach `status: ready_for_submission`
2. Consultant clicks **Открыть форму** → extension receives `SET_ACTIVE_CONTEXT`, opens the form
3. Content script calls `GET /applications/active`, fills fields
4. Consultant reviews, clicks Submit on the university site
5. Extension calls `POST /applications/:id/submit` → API triggers a Telegram notification

## Setup

```bash
pnpm --filter @uni-apply/shared build
pnpm --filter @uni-apply/extension install
pnpm --filter @uni-apply/extension build
```
Load `apps/extension/dist` via `chrome://extensions` → Developer mode → Load unpacked. Configure API URL + `EXTENSION_API_KEY` (matches API's `.env`) in the popup.

## Dependencies

- `Api Service Spec`: `GET /applications/active`, `POST /applications/:id/submit`
- `University Schema Onboarding Spec`: field selectors and `mapsTo` come from `UniversitySchema.fields`, authored per-university, not generic.

## Non-goals

- No generic "any university" form-filling engine — only universities with a seeded `UniversitySchema`.
