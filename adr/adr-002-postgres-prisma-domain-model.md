---
tags: [project/uni-apply-helper, type/adr, status/approved]
project: "Uni Apply Helper"
status: approved
created: 2026-07-17
updated: 2026-07-17
aliases: []
adr-id: adr-002
---

# ADR-002: Postgres + Prisma for domain model

## Context

Domain has a deep, mostly-optional field set per student (personal, education, work, language, family, guarantor, emergency contact) driven by heterogeneous university form requirements, plus flexible per-university schema definitions.

## Decision

Postgres via Prisma (`packages/database/prisma/schema.prisma`), single `database` package shared by API and worker. Key models: `Student` (1:N to `Education`, `WorkExperience`, `LanguageSkill`, `FamilyMember`, `StudentDocument`, `ApplicationTarget`, `ApplicationBatch`; 1:1 `Guarantor`, `EmergencyContact`), `UniversitySchema` (JSON `fields` + `requiredDocuments`), `ApplicationBatch` → `Application` → `ApplicationStep`, `GeneratedDocument` (letters, needs `approvedByConsultant` before submission).

## Consequences

- `UniversitySchema.fields` and `requiredDocuments` are untyped `Json` — flexibility for wildly different wizard shapes per university, at the cost of no DB-level validation; validation lives in `@uni-apply/shared` types + LLM draft review step.
- `Application.status` and `ApplicationBatch.status` are free-text strings, not enums — see [[University Schema Onboarding Spec]] for the `ready_for_submission` status contract consumed by the extension.
- No `universityId` FK on `ApplicationTarget`/`Application` to `UniversitySchema.id` — resolution goes through `UniversityAlias` first (raw user-entered name → canonical id).

## Alternatives Considered

- Strict per-university typed columns — rejected: would require a migration per onboarded university, defeats the "add university in hours" goal in [[University Schema Onboarding Spec]].
