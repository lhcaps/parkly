# Parkly API Contract

Contract snapshot date: 2026-03-30
Release baseline: `backend-rc1`
Release scope: `PR20→PR25` consolidated runtime plus the newer auth, observability, backup, and secret-safety hardening.
Base API prefix: `/api`
Interactive docs: `/docs`
Machine-readable OpenAPI projection: `/openapi.json`

## Error envelope

All successful responses use:

```json
{
  "requestId": "uuid",
  "data": {}
}
```

All failed responses use:

```json
{
  "requestId": "uuid",
  "code": "BAD_REQUEST",
  "message": "Human readable summary",
  "details": {}
}
```

Operational notes:

- `requestId` is always echoed in the body and `x-request-id`.
- Correlated flows may also include `x-correlation-id`.
- Audit and manual-control writes should preserve `requestId`, `correlationId`, and `occurredAt`.

## Auth surfaces

Parkly separates three auth planes so operator sessions, device-signed capture, and internal service traffic do not share the same trust path.

### 1. User auth

Used by the web console and operator-facing APIs.

- `GET /api/auth/password-policy`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `POST /api/auth/revoke-all`
- `POST /api/auth/admin/users/:userId/revoke-all`
- `POST /api/auth/admin/users/:userId/disable`
- `POST /api/auth/admin/users/:userId/enable`
- `GET /api/auth/me`

Auth hardening highlights:

- `AUTH_SESSION_REVOKE_ALL` is emitted when the current user or an admin revokes the active session set.
- Session hygiene includes cleanup, forced logout, and per-user session limits.
- Local/demo bootstrap commonly uses `ops / Parkly@123` for smoke or reset validation on `local/demo` profiles.
- `SUPER_ADMIN` can bypass route-level backend policy checks, but audit attribution still records the acting principal.

### 2. Device-signed auth

Used by capture, heartbeat, and media-adjacent device surfaces.

- Signed device requests carry timestamp, signature version, request identifiers, and the effective device code.
- Secret rejection, missing auth headers, replay suspicion, and rotation audit events are exported to observability.
- Rotate or rollback secrets through the explicit audited workflow, not by editing env files ad hoc.

### 3. Internal service auth

Used for system-to-system surfaces. Internal tokens support active/next rotation and are included in secret-safety reporting.

## Snapshot/state query versus realtime

### Snapshot/state query

REST list and detail endpoints are the canonical state source. Frontend workspaces must hydrate from snapshot/state query endpoints first:

- `GET /api/gate-sessions`
- `GET /api/gate-sessions/:sessionId`
- `GET /api/gate-review-queue`
- `GET /api/outbox`
- `GET /api/ops/device-health`
- `GET /api/ops/lane-status`
- `GET /api/ops/parking-live`
- `GET /api/ops/parking-live/summary`

### Realtime delta stream

SSE is delta transport only. It must not replace snapshot hydration or pageable history.

- `GET /api/stream/gate-events`
- `GET /api/stream/lane-status`
- `GET /api/stream/device-health`
- `GET /api/stream/outbox`
- `GET /api/stream/incidents`
- `GET /api/stream/parking-live`

Operational rule: hydrate from REST, then merge the realtime delta stream.

## Surface map

### Platform and health

- `GET /api/health`
- `GET /api/ready`
- `GET /metrics`
- `GET /api/ops/metrics/summary`

The metrics summary exposes latency budgets, traffic/error buckets, incident counters, health breakdown status, and secret safety rollups such as `summary.secretSafety` and `components.secretSafety`.

### Dashboard and monitoring

- `GET /api/ops/dashboard/summary`
- `GET /api/ops/dashboard/sites/:siteCode/summary`
- `GET /api/ops/dashboard/incidents/summary`
- `GET /api/ops/dashboard/occupancy/summary`
- `GET /api/ops/dashboard/lanes/summary`
- `GET /api/ops/dashboard/subscriptions/summary`
- `GET /api/reports/summary`

UI guidance: overview screens should be able to recover from one canonical summary call or `một hoặc hai call summary` when a slice-specific refresh is required.

### Master data and topology read

- `GET /api/sites`
- `GET /api/gates`
- `GET /api/lanes`
- `GET /api/devices`
- `GET /api/topology`

### Gate operations

- `POST /api/gate-sessions/open`
- `POST /api/gate-sessions/resolve`
- `GET /api/gate-sessions`
- `GET /api/gate-sessions/:sessionId`
- `GET /api/gate-review-queue`
- `POST /api/gate-review-queue/:reviewId/claim`
- `POST /api/gate-sessions/:sessionId/manual-approve`
- `POST /api/gate-sessions/:sessionId/manual-reject`
- `POST /api/gate-sessions/:sessionId/manual-open-barrier`
- `POST /api/gate-sessions/:sessionId/confirm-pass`
- `POST /api/gate-sessions/:sessionId/cancel`

### Capture and ALPR

- `POST /api/lane-flow/submit`
- `POST /api/alpr/preview`
- `POST /api/alpr/recognize`
- device capture routes under the mobile/device capture module

### Incident, audit, reconciliation, and parking live

- `GET /api/ops/incidents`
- `GET /api/ops/incidents/:incidentId`
- `POST /api/ops/incidents/:incidentId/resolve`
- `GET /api/ops/audit`
- `GET /api/ops/audit/:auditId`
- `GET /api/ops/spot-occupancy`
- `GET /api/ops/spot-occupancy/:spotCode`
- `GET /api/ops/parking-live`
- `GET /api/ops/parking-live/summary`
- `GET /api/ops/parking-live/spots/:spotCode`

Noise-control and lifecycle notes:

- Repeated stale or ghost signals are suppressed by grace hits and `cooldown` windows.
- Resolved incidents may reopen as `AUTO_REOPENED` when the same source/fingerprint fires inside the reopen window.
- Bus consumers should expect `incident.reopened` alongside the standard opened or resolved lifecycle events.

### Admin surfaces

- `POST /api/admin/topology/sites`
- `PATCH /api/admin/topology/sites/:siteId`
- `POST /api/admin/topology/devices`
- `PATCH /api/admin/topology/devices/:deviceId`
- `GET /api/admin/topology/devices/unassigned`
- `POST /api/admin/topology/lanes`
- `PATCH /api/admin/topology/lanes/:laneId`
- `PUT /api/admin/topology/lanes/:laneId/devices`
- `GET /api/admin/subscriptions`
- `GET /api/admin/subscriptions/:subscriptionId`
- `POST /api/admin/subscriptions`
- `PATCH /api/admin/subscriptions/:subscriptionId`
- `GET /api/admin/subscription-spots`
- `POST /api/admin/subscription-spots`
- `PATCH /api/admin/subscription-spots/:subscriptionSpotId`
- `GET /api/admin/subscription-vehicles`
- `POST /api/admin/subscription-vehicles`
- `PATCH /api/admin/subscription-vehicles/:subscriptionVehicleId`
- `POST /api/admin/subscriptions/bulk-import`
- `GET /api/admin/jobs/:jobId`
- `POST /api/integrations/webhooks`
- `GET /api/integrations/webhooks`
- `GET /api/integrations/webhooks/:webhookId`
- `PATCH /api/integrations/webhooks/:webhookId`
- `DELETE /api/integrations/webhooks/:webhookId`
- `POST /api/integrations/webhooks/:webhookId/regenerate-secret`
- `GET /api/integrations/webhooks/:webhookId/deliveries`
- `POST /api/integrations/webhooks/:webhookId/test`

## Contract rules

### Validation

- Zod schemas are the source of truth for transport contracts.
- Validation failures return `400 BAD_REQUEST`.
- Business rule failures return `422 UNPROCESSABLE_ENTITY`.
- Numeric identifiers and cursors must not be silently coerced from invalid input.

### Pagination

Cursor-based list responses return:

```json
{
  "rows": [],
  "nextCursor": "opaque-or-numeric-string",
  "pageInfo": {
    "type": "CURSOR",
    "limit": 50,
    "nextCursor": "opaque-or-numeric-string",
    "hasMore": true,
    "sort": "sessionId:desc"
  }
}
```

Rules:

- `limit` is clamped per endpoint.
- `nextCursor` is a string or `null`.
- `sort` is explicit and canonical.
- Frontend code must not infer hidden defaults.

### Audit traceability

- Audit reads and writes preserve `requestId`, `correlationId`, and `occurredAt`.
- Actor snapshots must distinguish user, service, and system principals.
- Manual review actions write explicit audit events for claim, approve, reject, and open-barrier flows.

### Secret safety and observability

- `/api/ops/metrics/summary` includes health breakdown plus secret-safety indicators for rejection spikes, replay suspicion, and missing auth headers.
- Consumers should inspect `summary.secretSafety` for the rolled-up view and `components.secretSafety` for component-level drilldown.
- `GET /api/health` and `GET /api/ready` are not enough on their own when metrics show `health breakdown` or secret-safety degradation.

## Contract ownership

- Canonical transport types live in `packages/contracts`.
- API route modules in `apps/api/src/modules` must conform to those contracts.
- Web route and page logic in `apps/web` uses the same role and contract model.
- `SPEC-v11.md` is the project-level snapshot. This file is the API-specific companion for `backend-rc1`.
