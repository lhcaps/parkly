# Decisions visible in the repository

These are descriptions of existing implementation, not claims that every design outcome was measured in production.

1. **Lease per site and lane.** The [lane lock](../../apps/api/src/lib/lane-lock.ts) uses `SET NX PX`, a random value and Lua ownership checks. It bounds lock lifetime but needs careful lease sizing and Redis availability; it is not a multi-node Redlock implementation.
2. **Persisted replay handling.** The [capture route](../../apps/api/src/modules/gate/interfaces/http/register-gate-capture-routes.ts) checks idempotency before and inside the lane lock; [read persistence](../../apps/api/src/modules/gate/infrastructure/gate-read-events.repo.ts) handles duplicate keys. The design intent is safe retries, not a claim of exactly-once behavior across all failure modes.
3. **Separate event delivery.** [Event writes and outbox creation](../../apps/api/src/services/event.service.ts) occur in a database transaction. The [outbox processor](../../apps/api/src/worker/processors/outbox-sync.processor.ts) has claim, retry and dead-letter paths. Runtime delivery, external integrations and retry guarantees require integration verification.
