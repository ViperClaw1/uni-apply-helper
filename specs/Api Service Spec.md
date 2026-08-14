---
tags: [project/uni-apply-helper, type/spec]
project: "Uni Apply Helper"
status: draft
created: 2026-07-17
updated: 2026-07-17
aliases: [API, Backend]
---

# Api Service Spec

Path: `apps/api`. NestJS. Deploy target: Railway (`apps/api/railway.toml`).

## Responsibility

Central backend: owns the Postgres DB via `@uni-apply/database`, exposes REST endpoints consumed by the dashboard and the extension, produces BullMQ jobs, calls Gemini for letters/schema drafts, sends Telegram notifications, and receives the Google-Form intake webhook.

## Modules and Endpoints

| Module | Endpoints |
|---|---|
| `students` | `GET /students`, `GET /students/:id`, `GET /students/:id/profile`, `POST /students/:id/application-targets/resolve` |
| `documents` | `GET/POST /students/:studentId/documents`, `POST /students/:studentId/documents/upload`, `GET/PATCH/DELETE /documents/:id`, `POST /documents/:id/parse` |
| `applications` | `POST /applications/batches`, `POST/GET /students/:studentId/applications/batches`, `GET /applications/batches/:id`, `GET /applications/active`, `GET/PATCH /applications/:id`, `POST /applications/:id/submit`, `POST /applications/:id/steps` |
| `letters` | `POST /generate`, `GET /students/:studentId`, `GET /universities/:universityId`, `GET/PATCH/DELETE /:id`, `POST /:id/approve`, `POST /:id/unapprove` |
| `universities` | `GET /universities`, `GET /universities/resolve`, `POST /universities/aliases`, `POST /universities/schemas/seed`, `POST /universities/schemas/generate-draft`, `GET /universities/:id`, `GET /universities/:id/aliases` |
| `webhook` | `POST /webhook/google-form` — Russian-language Google Form field names mapped to `StudentProfile` paths (e.g. `Фамилия... / Surname` → `personal.surname`) |
| `queue` | Internal `QueueService`, not HTTP-exposed — see [[adr-003-redis-bullmq-async-processing]] |
| `auth` | `ApiKeyGuard` — API-key auth for extension/service-to-service calls |

## Interfaces / Dependencies

- DB: `@uni-apply/database` (Prisma/Postgres)
- Queue: Redis + BullMQ, queue names from `@uni-apply/shared`
- LLM: Gemini via `@google/genai` (`letters`, `universities/schema-generator`) — [[adr-005-gemini-for-letter-and-schema-generation]]
- Notifications: Telegram via `grammy` (`TELEGRAM_BOT_TOKEN`, `CONSULTANT_CHAT_ID`) — degrades to a warn log if unset, does not fail requests
- CORS: `DASHBOARD_ORIGIN` env (comma-separated for multiple origins)

## Non-goals

- No user-facing auth/session system for consultants — API-key based, dashboard has no visible login flow in current scope.
