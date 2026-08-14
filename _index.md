---
tags: [project/uni-apply-helper, type/index]
project: "Uni Apply Helper"
status: draft
created: 2026-07-17
updated: 2026-07-17
aliases: [Uni Apply, UAH]
---

# Uni Apply Helper

Semi-automatic university application platform for education consultants. Consultants intake student data (Google Form → webhook), the system resolves target universities, parses uploaded documents, drafts motivation/recommendation letters via Gemini, and hands off form-filling to a Chrome Extension for human-supervised submission. Consultants get Telegram notifications at key stages.

## Source

- Repo: [uni-apply-helper](https://github.com/ViperClaw1/uni-apply-helper)
- Monorepo: pnpm workspaces + turbo (`apps/*`, `packages/*`)

## Architecture Decisions

- [[adr-001-monorepo-turbo-pnpm]]
- [[adr-002-postgres-prisma-domain-model]]
- [[adr-003-redis-bullmq-async-processing]]
- [[adr-004-semi-auto-extension-over-full-automation]]
- [[adr-005-gemini-for-letter-and-schema-generation]]

## Specs

- [[Domain Model Spec]]
- [[Api Service Spec]]
- [[Dashboard Spec]]
- [[Extension Spec]]
- [[Worker Spec]]
- [[University Schema Onboarding Spec]]

## Components

| App | Path | Role |
|---|---|---|
| API | `apps/api` | NestJS. Students, documents, letters, universities, applications, webhook, queue producer |
| Dashboard | `apps/dashboard` | Next.js. Consultant UI — student list, batch creation, review |
| Extension | `apps/extension` | Chrome MV3. Reads active application context, fills university form fields, triggers submit |
| Worker | `apps/worker` | NestJS + Playwright. **Deprecated** for production submission; kept for local recon/legacy scripts |

## Infra

- Postgres 16 (`packages/database`, Prisma)
- Redis 7 + BullMQ (`apps/api/src/queue`) — queues: `application.process`, `notification`, `document.parse`
- Deploy: API/Worker → Railway (`railway.toml`); Dashboard → Vercel (`vercel.json`)
