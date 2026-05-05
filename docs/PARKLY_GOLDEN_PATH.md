# Parkly Golden Path — Demo Script

**Created:** 2026-05-05
**Phase:** Phase 1
**Purpose:** Step-by-step walkthrough proving the core 3-minute workflow works end-to-end.

## Prerequisites

```bash
# One-command setup
pnpm parkly:setup

# Start all services
pnpm parkly:dev

# Verify all green
pnpm parkly:verify
```

Services expected:
- API: `http://127.0.0.1:3000`
- Web: `http://127.0.0.1:5173`
- API docs: `http://127.0.0.1:3000/docs`

---

## Demo Accounts

| Role | Username | Password | Default Route |
|------|----------|----------|---------------|
| SUPER_ADMIN | `admin` | `Parkly@123` | /overview |
| SITE_ADMIN | `ops` | `Parkly@123` | /overview |
| MANAGER | `manager` | `Parkly@123` | /review-queue |
| OPERATOR | `ops` | `Parkly@123` | /run-lane |
| GUARD | `guard` | `Parkly@123` | /run-lane |

**Verify seed accounts exist:**
```bash
pnpm --dir apps/api db:seed:min
```

---

## 3-Minute Technical Demo

### Minute 1: Login + Run Lane Entry

**Step 1: Open the web console**
```
http://127.0.0.1:5173
```

**Step 2: Login as OPERATOR**
```
Username: ops
Password: Parkly@123
```
Expected: Redirect to `/run-lane`. Site selector appears at top. Gate and Lane dropdowns visible.

**Step 3: Select site, gate, and lane**
- Select a seeded site (e.g., `DEMO-SITE-01`)
- Select a gate (e.g., `GATE-ENTRY-A`)
- Select a lane (e.g., `LANE-01`)

**Step 4: Submit entry capture**
- Enter a plate number: `30A-12345`
- Click "Submit Entry"
- Expected: Session created toast appears, lane state card shows "Entry recorded"
- Expected: API call `POST /api/lane-flow/submit` returns with session ID

**Step 5: Verify session created**
```
GET /api/gate-sessions
```
Expected: Response contains session with plate `30A-12345`, status `OPEN`, entry lane `LANE-01`

---

### Minute 2: Review Queue (if needed)

**If decision engine auto-approved** (high ALPR confidence): Session is resolved, no review needed. Skip to Minute 3.

**If decision engine routed to review queue** (low confidence):
- Open `/review-queue`
- Expected: Review item appears with plate `30A-12345`
- Click "Claim" to take ownership
- Expected: "Claimed by you" indicator appears
- Click "Approve" (green button with confirmation)
- Click "Confirm"
- Expected: Review item removed from queue, session status updated to `OPEN` or `RESOLVED`
- Verify audit log:
```
GET /api/ops/audit
```
Expected: Audit entry with action `REVIEW_APPROVE`, actor `ops`, target session ID

---

### Minute 3: Exit + Session Resolution + Evidence

**Step 6: Submit exit capture**
- Return to `/run-lane`
- Same site, gate, lane
- Enter plate: `30A-12345`
- Click "Submit Exit"
- Expected: Session resolved, barrier command issued (or logged if no physical barrier)
- Expected: Session status changes to `RESOLVED`

**Step 7: Verify session history**
```
GET /api/gate-sessions
```
Expected: Session with plate `30A-12345` shows status `RESOLVED`, entry and exit timestamps.

**Step 8: Verify outbox event**
- Open `/sync-outbox`
- Expected: Outbox entries visible for entry and exit events
- Expected: Status shows `PROCESSED` or `PENDING` (not `FAILED`)

**Step 9: Verify audit trail**
```
GET /api/ops/audit
```
Expected: Multiple audit entries:
- `SESSION_OPEN` for entry
- `REVIEW_APPROVE` (if reviewed) or `SESSION_AUTO_APPROVE`
- `SESSION_RESOLVED` for exit

---

## 10-Minute Technical Deep Dive

### Coverage Verification

**Run the API quality gate:**
```bash
pnpm --dir apps/api test:pr04  # Capture auth + idempotency
pnpm --dir apps/api test:pr20  # Auth + RBAC
pnpm --dir apps/api test:pr23  # Audit hardening
pnpm --dir apps/api typecheck
```

**Run the web quality gate:**
```bash
pnpm --dir apps/web build:web
pnpm --dir apps/web test:smoke:auth-routes
```

**Run the full release gate:**
```bash
pnpm test:full
```

### Observability Walkthrough

**Health check:**
```
GET http://127.0.0.1:3000/api/health
GET http://127.0.0.1:3000/api/ready
```
Expected: `200 OK` with health breakdown

**Metrics:**
```
GET http://127.0.0.1:3000/metrics
```
Expected: Prometheus-format metrics including gate session counters, error rates, latency buckets

**Metrics summary:**
```
GET http://127.0.0.1:3000/api/ops/metrics/summary
```
Expected: JSON with latency budgets, traffic/error buckets, incident counters, secret safety rollup

### SSE Streams

**Open SSE streams (from browser devtools or curl):**
```bash
# Gate events
curl -N http://127.0.0.1:3000/api/stream/gate-events

# Lane status
curl -N http://127.0.0.1:3000/api/stream/lane-status

# Device health
curl -N http://127.0.0.1:3000/api/stream/device-health
```
Expected: Server-sent events stream with JSON payloads when gate activity occurs

### Decision Engine Trace

Submit a low-confidence plate (intentionally unclear):
```
POST /api/lane-flow/submit
{
  "laneCode": "LANE-01",
  "plateNumber": "???",
  "source": "MANUAL",
  "idempotencyKey": "demo-001"
}
```
Expected: `201 Created` with `decision: "REVIEW"` — session goes to review queue instead of auto-resolving.

### Webhook Outbox Demo

Trigger a session event that would deliver a webhook:
- Complete entry + exit cycle
- Check outbox status:
```
GET /api/outbox?limit=5
```
Expected: Outbox records with `PROCESSING` or `PROCESSED` status.

### Topology Admin Demo

Open `/topology` (requires SITE_ADMIN or SUPER_ADMIN):
- View sites, gates, lanes, devices
- Verify device heartbeat status visible

---

## Data Needed for Demo

The following must exist in the seeded database:

| Entity | Expected |
|--------|----------|
| Sites | At least 1 site with code |
| Gates | At least 1 gate under the site |
| Lanes | At least 1 lane under the gate |
| Devices | At least 1 device (ALPR camera) assigned to the lane |
| Demo users | ops, manager, guard with correct passwords |
| Subscriptions | Optional — for subscription match demo |

**Verify seed:**
```bash
pnpm --dir apps/api db:seed:min
```

---

## Expected Screenshots

Capture these during demo:

1. **Login screen** — clean, minimal, Parkly branding
2. **Run Lane (context selected)** — site/gate/lane bar, plate input, submit button
3. **Session created toast** — session ID visible, plate confirmed
4. **Review Queue (if item exists)** — image preview, claim/approve/reject buttons
5. **Session History (detail)** — timeline of events, audit trail visible
6. **Overview dashboard** — KPIs, site attention, quick actions
7. **Outbox Monitor** — delivery backlog, status indicators

Store in: `docs/evidence/screenshots/`

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Login returns 401 | Verify seed ran: `pnpm --dir apps/api db:seed:min` |
| Run Lane shows no sites | Check database has seeded topology data |
| SSE stream not updating | Verify API is running; SSE requires active connection |
| Outbox stuck in PENDING | Verify BullMQ worker is running: `pnpm --dir apps/api worker:dev` |
| TypeScript errors | Run `pnpm typecheck:api` and `pnpm typecheck:web` to see full list |

---

*Golden path documented: 2026-05-05*
*Next update: After Phase 1 verification pass*
