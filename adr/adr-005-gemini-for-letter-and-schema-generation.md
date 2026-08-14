---
tags: [project/uni-apply-helper, type/adr, status/approved]
project: "Uni Apply Helper"
status: approved
created: 2026-07-17
updated: 2026-07-17
aliases: []
adr-id: adr-005
---

# ADR-005: Gemini (`@google/genai`) for letter drafting and university schema drafting

## Context

Two distinct LLM-assisted tasks: (1) drafting motivation/recommendation letters per student+university, (2) turning raw DOM field captures from a new university's form into a structured `UniversitySchema` draft (label → `mapsTo`, field types, wizard steps).

## Decision

Both use Google's Gemini via `@google/genai` in `apps/api`. `LettersService` generates `GeneratedDocument` rows gated by `approvedByConsultant` before use. `SchemaGeneratorService` / `POST /universities/schemas/generate-draft` (and the CLI `scripts/generate-university-schema.mjs`) turn `data/captures/<id>/step-*.json` into `*.draft.json`, always followed by a mandatory human review checklist before `*.draft.json` → `*.json` and seeding (`POST /universities/schemas/seed`).

Env: `GEMINI_API_KEY` (required), `GEMINI_LETTER_MODEL`, `GEMINI_SCHEMA_MODEL` (optional, defaults to letter model).

## Consequences

- Every LLM output on both paths is treated as a draft, not a source of truth: letters need `approvedByConsultant`, schemas need the Step 3 human review checklist in [[University Schema Onboarding Spec]] before going live.
- Two separate model configs (`GEMINI_LETTER_MODEL`, `GEMINI_SCHEMA_MODEL`) allow tuning cost/quality independently per task.
- No fallback LLM provider — a Gemini outage blocks both letter generation and new-university onboarding drafting (manual JSON editing remains possible as a workaround).

## Alternatives Considered

- Fully manual schema authoring (no LLM draft step) — rejected: selector/mapsTo authoring by hand doesn't scale to the top 20–50 university target pool described in [[University Schema Onboarding Spec]].
