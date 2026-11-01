# Parkly architecture — source view

These diagrams describe inspected code at baseline `595934ac90a6108898a0e70027c6250ae583535e`. They are not a record of a running deployment. External devices, ALPR, downstream delivery, and the complete user journey have not been verified.

```mermaid
flowchart LR
  U[Operator console: React] -->|HTTP| A[Express API]
  D[Device request: simulated only] -.->|signed capture| A
  A --> L[Redis lane lease]
  A --> DB[(MySQL / Prisma)]
  DB --> O[Outbox records]
  O --> Q[BullMQ queue / Redis]
  Q --> W[Outbox processor]
  W -.-> X[Downstream sync / webhook]
```

```mermaid
sequenceDiagram
  participant C as Capture client
  participant A as Capture route
  participant R as Redis
  participant M as MySQL
  C->>A: Signed capture + idempotency key
  A->>A: Validate signature and replay state
  A->>R: Acquire site/lane lease
  A->>M: Persist read and session-related state
  A->>R: Release if ownership token matches
  A-->>C: Capture result or conflict
  Note over M: A separate event path writes event and outbox in a transaction
```

The sequence is deliberately simplified; it does not assert all writes share one transaction. See [capture routes](../../apps/api/src/modules/gate/interfaces/http/register-gate-capture-routes.ts), [read persistence](../../apps/api/src/modules/gate/infrastructure/gate-read-events.repo.ts), [lane lock](../../apps/api/src/lib/lane-lock.ts), and [event service](../../apps/api/src/services/event.service.ts).
