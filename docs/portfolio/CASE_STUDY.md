# Parkly: coordinating parking operations

**Evidence level:** source implementation and isolated tests; end-to-end demo **BLOCKED**. No operating facility, real camera, deployed service, customer usage, or production traffic has been independently verified.

## Problem and approach

Parkly models a parking operator's workflow: capture a gate read, manage a session, review uncertain decisions, and inspect events. Its TypeScript monorepo contains an Express API, a React console, MySQL/Prisma persistence, Redis coordination, and BullMQ workers. The evidence here describes the repository; it does not establish individual contribution or deployment history.

## Engineering details

- **Capture and contention:** the [capture routes](../../apps/api/src/modules/gate/interfaces/http/register-gate-capture-routes.ts) validate signed device requests, check for idempotent replay and use a site/lane lock. The [lock](../../apps/api/src/lib/lane-lock.ts) uses a Redis lease and ownership-checked release; it is not Redlock and does not eliminate risks from expiry or Redis failover.
- **State and review:** [session rules](../../apps/api/src/modules/gate/domain/session.ts) represent waiting and review decisions; [manual approval](../../apps/api/src/modules/gate/application/review/manual-approve.ts) provides a separate review action. A focused test exercises low OCR confidence as review; this is a software test, not a measurement of ALPR accuracy.
- **Outbox:** [event service](../../apps/api/src/services/event.service.ts) writes a gate event and outbox record within a transaction. A [queue](../../apps/api/src/worker/queues/outbox.queue.ts) and [processor](../../apps/api/src/worker/processors/outbox-sync.processor.ts) implement job identity, claim, retry and dead-letter paths. Actual downstream delivery and exactly-once effects were not verified in this audit.

## Evidence and limits

At commit `b1f2ba9818fb3cca7fd543128bee4d92f9257da2`, Windows, Node `v22.23.1`, pnpm `10.0.0`: `pnpm --dir apps/api test:pr06` passed 4/4 decision tests and `pnpm --dir apps/api test:pr04` passed 5/5 capture contract/signature tests. Neither proves the complete workflow. See [CI audit](CI_AUDIT.md) for the missing media module, stopped Docker engine, and historical hosted CI outcomes.

[Architecture](ARCHITECTURE.md) · [Decisions](DECISIONS.md) · [3-minute demo plan](DEMO_3MIN.md) · [10-minute demo plan](DEMO_10MIN.md) · [Observed failures](FAILURES_AND_FIXES.md)
