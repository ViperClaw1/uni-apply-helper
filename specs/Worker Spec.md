---
tags: [project/uni-apply-helper, type/spec, status/archived]
project: "Uni Apply Helper"
status: archived
created: 2026-07-17
updated: 2026-07-17
aliases: [Playwright Worker]
---

# Worker Spec

Path: `apps/worker`. NestJS + Playwright. Deploy target: Railway (`apps/worker/railway.toml`).

> **Deprecated for the production submission flow** — superseded by [[Extension Spec]]. See [[adr-004-semi-auto-extension-over-full-automation]]. Retained for local recon scripts and legacy testing only.

## Responsibility (current, reduced scope)

- Local reconnaissance scripts against university form pages (`apps/worker/scripts`)
- Legacy test coverage predating the extension-based flow (`apps/worker/test`)

## Original Responsibility (superseded)

Fully automated Playwright-driven form submission consuming the `application.process` BullMQ queue — abandoned due to login walls, CAPTCHA, and CSRF handling being impractical to automate reliably per-university at target scale.

## Dependencies

- `@uni-apply/database` (same Prisma models as API)
- `@uni-apply/shared` (queue names, types)

## Non-goals

- Not to be extended for new production submission features — new work goes to [[Extension Spec]] + [[University Schema Onboarding Spec]].
