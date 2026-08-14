---
tags: [project/uni-apply-helper, type/spec]
project: "Uni Apply Helper"
status: draft
created: 2026-07-17
updated: 2026-07-17
aliases: [Prisma Schema, DB Schema]
---

# Domain Model Spec

Source: `packages/database/prisma/schema.prisma`. See [[adr-002-postgres-prisma-domain-model]] for the rationale.

## Responsibility

Single relational model shared by API and worker via the `@uni-apply/database` package. Owns student profile data, document uploads, per-university schema definitions, and application/batch lifecycle state.

## Core Entities

| Model | Purpose |
|---|---|
| `Student` | Root profile entity. All personal/passport/contact fields; hub for all 1:N relations below |
| `Education`, `WorkExperience`, `LanguageSkill`, `FamilyMember` | 1:N profile detail records |
| `Guarantor`, `EmergencyContact` | 1:1 profile detail records |
| `StudentDocument` | Uploaded file + `type`, `fileUrl`, `parsedData` (Json), `parseStatus` |
| `ApplicationTarget` | A university the student wants to apply to; `universityRaw` (as typed by consultant) resolved to `universityId` via `UniversityAlias` |
| `UniversityAlias` | Maps free-text university name variants → canonical `universityId` |
| `UniversitySchema` | Per-university form definition: `formUrl`, `requiredDocuments` (Json), `fields` (Json), `requiresEssay`/`essayPrompt`, `versionHash`, `lastValidatedAt` |
| `ApplicationBatch` | A submission run for one student: `total`/`submitted`/`blocked`/`failed` counters, `status` |
| `Application` | One university application within a batch: `status`, `blockedReason`, links to `motivationLetterId`, before/after screenshots |
| `ApplicationStep` | Granular step log per `Application` (`stepName`, `status`, timestamps, `errorMessage`) |
| `GeneratedDocument` | LLM-drafted letters; `approvedByConsultant` gate before use in submission |

## Notes

- `UniversitySchema.fields` / `requiredDocuments` are untyped `Json` by design — see [[adr-002-postgres-prisma-domain-model]] and [[University Schema Onboarding Spec]] for the schema shape contract enforced at the application layer, not the DB layer.
- `status` fields across `Application`/`ApplicationBatch` are free strings, not Prisma enums — the extension flow depends on the exact string `ready_for_submission` (see [[Extension Spec]]).

## Non-goals

- No versioning/audit table for `UniversitySchema` changes beyond `versionHash`/`lastValidatedAt`.
- No soft-delete — `StudentDocument`/`Application` deletes (where exposed) are hard deletes.
