---
tags: [project/uni-apply-helper, type/spec]
project: "Uni Apply Helper"
status: draft
created: 2026-07-17
updated: 2026-07-17
aliases: [University Onboarding, Schema Runbook]
---

# University Schema Onboarding Spec

Source: `docs/university-onboarding.md`. Runbook for adding a new university to the semi-auto flow ([[Extension Spec]]).

## Responsibility

Define the repeatable process for turning a university's live application form into a seeded `UniversitySchema` row, without building per-university code.

## Scope

- Automated: filling wizard fields, uploading files
- Manual (consultant): login, CAPTCHA, CSRF, agreement checkboxes, program selection, final submit
- Explicit non-goal: a universal "any university" engine — target is the top 20–50 universities by application volume (Pareto)

## Pipeline (4 steps)

1. **DOM Capture** — consultant logs into the university form in Chrome, runs `scripts/dom-field-capture.js` from DevTools console at each wizard step, saves output as `data/captures/<university-id>/step-N.json` (fields with selector/label/type, file inputs, next-button selector)
2. **LLM Draft Generation** — either the CLI (`node scripts/generate-university-schema.mjs --capture ... --id ... --out data/university-schemas/<id>.draft.json`, requires `GEMINI_API_KEY`) or `POST /universities/schemas/generate-draft` (same inputs over HTTP) produces a `UniversitySchema` draft + a `warnings` list (e.g. file fields missing `documentType`)
3. **Human Review** — checklist before promoting a draft: `formUrl` matches post-login origin+path, `wizard.totalSteps` matches the real form, every `selector` verified in DevTools, `mapsTo` correctly matches surname/givenName/email/passport fields, file fields tagged with the right `documentType` (photo/passport/transcript/medical/financial), essay fields have `mapsTo: null`, only truly required fields marked `required`, pre-wizard steps documented in `notes`. Rename `*.draft.json` → `*.json` once passed.
4. **Seed + Smoke Test** — `POST /universities/schemas/seed` loads DB from the JSON files; verify via a dashboard-created batch, check field highlighting (green/red) in the extension side panel, do one manual submit on the real site.

## What the LLM does / doesn't do

| Does | Doesn't |
|---|---|
| Maps form labels → `mapsTo` | Guarantee 100%-correct selectors |
| Proposes wizard config | Get past login/pre-wizard steps |
| Classifies file/essay/select fields | Replace human review |
| Produces a draft in minutes | Generalize to every university worldwide |

## Speeding up subsequent universities

Reuse the same capture script and CLI command shape (only `id`/captures change); compare against a university on the same form vendor (e.g. 17gz.org, ApplyBoard) and reuse its wizard-navigation patterns as a starting point (`zhengzhou-university.json` is the current reference example).

## Files

| File | Role |
|---|---|
| `scripts/dom-field-capture.js` | Browser console DOM capture |
| `scripts/generate-university-schema.mjs` | CLI → Gemini → draft JSON |
| `POST /universities/schemas/generate-draft` | API equivalent of the CLI |
| `data/university-schemas/*.json` | Production schemas, seeded via `POST /universities/schemas/seed` |
| `data/captures/<id>/step-*.json` | Raw DOM captures (gitignore optional) |

## Dependencies

- [[Domain Model Spec]] — `UniversitySchema` table shape
- [[adr-005-gemini-for-letter-and-schema-generation]] — why Gemini, and the draft/review split
- [[Extension Spec]] — consumes the seeded schema at fill-time
