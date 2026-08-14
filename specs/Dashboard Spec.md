---
tags: [project/uni-apply-helper, type/spec]
project: "Uni Apply Helper"
status: draft
created: 2026-07-17
updated: 2026-07-17
aliases: [Consultant Dashboard]
---

# Dashboard Spec

Path: `apps/dashboard`. Next.js. Deploy target: Vercel (`apps/dashboard/vercel.json`).

## Responsibility

Minimal consultant-facing UI on top of the API: browse students, inspect a student's documents and latest application batch, trigger new batches. Not a full CRUD admin panel.

## Pages

| Route | Purpose |
|---|---|
| `/` | Student list |
| `/students/[id]` | Student card: profile, documents, latest application batch |
| `/students/new` | Placeholder — blocked on `POST /students` not yet existing in the API |

## Configuration

- `NEXT_PUBLIC_API_URL` — API base URL (e.g. `http://localhost:3000` local, `https://<railway-api-url>` prod)
- `NEXT_PUBLIC_EXTENSION_ID` — optional, Chrome extension ID for dashboard→extension messaging
- Vercel import settings: Root Directory `apps/dashboard`; build runs `turbo build --filter=@uni-apply/dashboard` from repo root — see [[adr-001-monorepo-turbo-pnpm]] for why root-level build is required
- API side: set `DASHBOARD_ORIGIN` to the Vercel domain for CORS (comma-separate for multiple origins)

## Dependencies

- `Api Service Spec` for all data — dashboard has no local DB access.

## Known gaps

- `/students/new` is a stub pending a `POST /students` endpoint.
