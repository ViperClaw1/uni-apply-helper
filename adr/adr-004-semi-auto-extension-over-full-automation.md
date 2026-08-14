---
tags: [project/uni-apply-helper, type/adr, status/approved]
project: "Uni Apply Helper"
status: approved
created: 2026-07-17
updated: 2026-07-17
aliases: []
adr-id: adr-004
---

# ADR-004: Semi-automatic Chrome Extension replaces Playwright full automation

## Context

Original design (`apps/worker`, NestJS + Playwright) aimed at fully automated form submission across university sites. Login walls, CAPTCHA, CSRF tokens, and per-vendor wizard quirks made fully headless submission unreliable at the target scale (top 20–50 universities by volume).

## Decision

Move submission to a Chrome Extension (`apps/extension`, MV3) driven by a human consultant:
- Automated: field fill, file upload
- Manual (consultant): login, CAPTCHA, CSRF, program selection, final Submit click
- Not attempted: a universal "any university" engine

Flow: Dashboard creates a batch → applications reach `ready_for_submission` → consultant clicks "Открыть форму" → extension receives `SET_ACTIVE_CONTEXT`, content script pulls the profile via `GET /applications/active` and fills fields → consultant reviews and submits on the university site → extension calls `POST /applications/:id/submit` → Telegram notification.

`apps/worker` is kept only for local recon scripts / legacy testing, explicitly marked deprecated for the production flow in its own README.

## Consequences

- Submission correctness now depends on a human-in-the-loop step (real, verifiable submit) rather than a Playwright script's success/failure signal — trades automation coverage for reliability against anti-bot defenses.
- Two runtimes exist for form interaction (worker's Playwright scripts + extension's content scripts) — see [[Worker Spec]] for what remains supported.
- University-specific knowledge lives in `UniversitySchema` JSON (selectors, `mapsTo`, wizard steps) rather than in per-university Playwright code — see [[University Schema Onboarding Spec]].

## Alternatives Considered

- Keep investing in Playwright automation with CAPTCHA-solving services — rejected: out of scope, higher legal/ToS risk, doesn't remove the login-wall problem.
