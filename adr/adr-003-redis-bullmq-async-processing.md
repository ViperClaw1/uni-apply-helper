---
tags: [project/uni-apply-helper, type/adr, status/approved]
project: "Uni Apply Helper"
status: approved
created: 2026-07-17
updated: 2026-07-17
aliases: []
adr-id: adr-003
---

# ADR-003: Redis + BullMQ for async work

## Context

Three operations are slow/unreliable enough to not block API request/response: document parsing (OCR/LLM extraction of passport/transcript data), notification delivery (Telegram), and application processing steps.

## Decision

Redis-backed BullMQ, three named queues in `@uni-apply/shared/queue.names`: `application.process`, `notification`, `document.parse`. `QueueService` (`apps/api/src/queue`) wraps `Queue` per name, default job opts: `attempts: 2`, fixed backoff `30_000ms`.

## Consequences

- API and worker must share the exact queue name constants (`QUEUES`) from `@uni-apply/shared` — drift here silently orphans jobs.
- Only 2 retry attempts with a flat 30s backoff — acceptable for notification/parse jobs, may be too aggressive for flaky university-form interactions if `application.process` is ever revived for full automation.
- `QueueService.onModuleDestroy` closes all queues — clean shutdown, but no explicit draining/graceful-stop of in-flight jobs.

## Alternatives Considered

- Synchronous processing in the request path — rejected: document parsing and Telegram calls are both external I/O with no useful SLA to block a consultant's HTTP request on.
