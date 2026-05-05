# Requirements: Parkly

**Defined:** 2026-05-05
**Core Value:** A guard can process a vehicle entry and exit through Run Lane in under 30 seconds, with confidence-based routing to human review.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Authentication & Authorization

- [x] **AUTH-01**: Gate operators can log in with username/password and receive a session — validated by `pr20-auth-rbac.test.ts`
- [x] **AUTH-02**: Session is stored in Redis with configurable expiry — validated by `pr20-auth-rbac.test.ts`
- [x] **AUTH-03**: Users are assigned one of 7 roles (SUPER_ADMIN, SITE_ADMIN, MANAGER, OPERATOR, GUARD, CASHIER, VIEWER) — validated by `pr20-auth-rbac.test.ts`
- [x] **AUTH-04**: Route access is enforced by role policy — validated by `pr20-auth-rbac.test.ts`
- [x] **AUTH-05**: Device capture requests are authenticated via HMAC signature — validated by `pr04-capture-auth-idempotency.test.ts`

### Gate Operations — Run Lane

- [x] **RUN-01**: Operator can select site, gate, and lane before processing capture
- [x] **RUN-02**: Operator can submit an entry or exit capture (plate + optional image) — validated by `pr04`
- [x] **RUN-03**: System creates a gate session upon entry capture — validated by `open-session.ts` + decision engine
- [x] **RUN-04**: Decision engine routes capture to auto-approve (high confidence) or review queue (low confidence)
- [x] **RUN-05**: Barrier command is issued via Redis Redlock coordination — validated by `pr01-redis-foundation.test.ts`
- [x] **RUN-06**: System supports plate override (operator corrects ALPR result)
- [x] **RUN-07**: Entry/exit capture supports idempotency via `x-idempotency-key` — validated by `pr04`

### Review Queue

- [x] **REV-01**: Supervisor sees pending review items in the review queue — validated by review queue module
- [x] **REV-02**: Supervisor can claim a review item (prevents race with other supervisors) — validated by `claim-review.ts`
- [x] **REV-03**: Supervisor can approve, reject, or manually open barrier from the review workspace — validated by manual action flows
- [x] **REV-04**: All review actions are recorded in the audit trail — validated by `pr23-audit-hardening.test.ts`

### Session Management

- [x] **SESS-01**: Gate sessions have lifecycle states: OPEN, RESOLVED, CANCELLED, PENDING_REVIEW
- [x] **SESS-02**: Sessions are queryable by site, gate, lane, status, date range
- [x] **SESS-03**: Session history supports cursor-based pagination — validated by API contract in `docs/API.md`
- [x] **SESS-04**: Session detail includes timeline of events (capture, decision, actions, media)
- [x] **SESS-05**: Anti-passback enforcement prevents same-plate exit without prior entry — validated by decision engine

### Lane & Device Monitoring

- [x] **MON-01**: Real-time lane status (open, closed, degraded) visible to operators — SSE delta
- [x] **MON-02**: Device health monitoring (camera online/offline, last heartbeat) — SSE delta
- [x] **MON-03**: Lane monitor shows current lane state without requiring page refresh

### Outbox & Event Delivery

- [x] **OUT-01**: All state mutations write to `gate_event_outbox` within the same transaction — validated by `pr12`
- [x] **OUT-02**: BullMQ worker processes outbox items asynchronously — validated by `pr12-outbox-bullmq.test.ts`
- [x] **OUT-03**: Failed deliveries are retried with exponential backoff — validated by webhook delivery logic
- [x] **OUT-04**: Terminal failures are moved to DLQ — validated by DLQ processor
- [x] **OUT-05**: Outbox monitor shows delivery backlog and failure status

### Audit & Compliance

- [x] **AUD-01**: All manual gate actions (approve, reject, open-barrier, cancel) write audit events — validated by `pr23`
- [x] **AUD-02**: Audit logs include actor, timestamp, requestId, correlationId, action, target — validated by `pr23`
- [x] **AUD-03**: Audit viewer allows filtering by actor, action, date range, site

### Infrastructure & Resilience

- [x] **OPS-01**: System exposes health (`/api/health`) and readiness (`/api/ready`) endpoints
- [x] **OPS-02**: Prometheus metrics include latency budgets, error rates, incident counters — validated by `pr27`
- [x] **OPS-03**: Secret hygiene checks detect exposed secrets — validated by `pr32`, `pr33`, `pr34`
- [x] **OPS-04**: Backup and restore procedures exist — validated by `pr30`
- [x] **OPS-05**: Edge node bulk sync survives ISP outage via store-and-forward — validated by edge module

## v2 Requirements

### Subscription Management
- **SUB-01**: Subscription vehicles can be registered and managed
- **SUB-02**: Bulk import of subscriptions via file upload (HTTP 202 + job polling)
- **SUB-03**: Subscription parking spots can be assigned and tracked

### Parking Live Board
- **LIVE-01**: Real-time parking spot occupancy board visible to supervisors
- **LIVE-02**: Spot detail shows current occupant, entry time, expected fee
- **LIVE-03**: Occupancy summary shows available/total spots per floor/zone

### Incident Management
- **INC-01**: Incidents are auto-created from sensor anomalies
- **INC-02**: Incident noise suppression reduces repeated alerts from same source
- **INC-03**: Incidents can be resolved with notes by supervisors

### Topology Management
- **TOPO-01**: Sites, gates, lanes, and devices can be managed via admin UI
- **TOPO-02**: Device assignments can be updated atomically with soft deletes
- **TOPO-03**: Topology mutations trigger SSE events to hot-reload connected clients

## Out of Scope

| Feature | Reason |
|---------|--------|
| Native mobile app | Web SPA covers all gate operations use cases |
| OAuth/B裴i identity providers | Custom JWT + Redis session sufficient for enterprise B2B |
| Real-time payment gateway | Tariff projection exists; actual payment integration out of scope for pilot |
| Multi-tenant SaaS isolation | Single-tenant pilot focus; tenant scope via site-based RBAC |
| Push notifications | Webhook delivery is the current B2B integration path |
| Advanced analytics / BI | Dashboard summary covers current operational KPIs |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 through AUTH-05 | Phase 4 | Pending |
| RUN-01 through RUN-07 | Phase 1 | Pending |
| REV-01 through REV-04 | Phase 1 | Pending |
| SESS-01 through SESS-05 | Phase 1 | Pending |
| MON-01 through MON-03 | Phase 4 | Pending |
| OUT-01 through OUT-05 | Phase 4 | Pending |
| AUD-01 through AUD-03 | Phase 4 | Pending |
| OPS-01 through OPS-05 | Phase 0 (already validated in code) | Pending |
| SUB-01 through SUB-03 | Phase 4 | Pending |
| LIVE-01 through LIVE-03 | Phase 4 | Pending |
| INC-01 through INC-03 | Phase 4 | Pending |
| TOPO-01 through TOPO-03 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 28 total
- Mapped to phases: 28
- Unmapped: 0

---
*Requirements defined: 2026-05-05*
*Last updated: 2026-05-05 after initial GSD project initialization*
