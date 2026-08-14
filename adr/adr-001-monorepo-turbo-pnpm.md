---
tags: [project/uni-apply-helper, type/adr, status/approved]
project: "Uni Apply Helper"
status: approved
created: 2026-07-17
updated: 2026-07-17
aliases: []
adr-id: adr-001
---

# ADR-001: pnpm workspaces + turbo for monorepo

## Context

Four deployable units (`api`, `dashboard`, `extension`, `worker`) share two internal packages (`shared`, `database`). Need consistent builds, shared types (`@uni-apply/shared`), and independent deploy targets (Railway for API/worker, Vercel for dashboard).

## Decision

Single repo, pnpm workspaces (`apps/*`, `packages/*`), `turbo.json` for task orchestration (`build` depends on `^build`, outputs cached per app: `dist/**`, `.next/**`).

## Consequences

- Dashboard Vercel build must run `turbo build --filter=@uni-apply/dashboard` from repo root, not `apps/dashboard` in isolation — otherwise workspace deps don't resolve.
- `.next/**` must be declared in turbo outputs or Vercel can't find `routes-manifest.json`; missed once, required cache-cleared redeploy to fix.
- `packages/shared` must be built (`pnpm --filter @uni-apply/shared build`) before the extension build — no live workspace symlink resolution in the Vite/Chrome build path.

## Alternatives Considered

- Separate repos per app — rejected: duplicated `@uni-apply/shared` types (Student/University schemas) between API and extension would drift.
