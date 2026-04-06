# Parkly Operations Runbook

Runbook snapshot date: 2026-03-30
Release baseline: `backend-rc1`
Repository scope: root orchestration for bootstrap, release gate, incident handling, backup, restore, and demo rollback.

## 1. Startup profiles

### Local developer profile

```bash
pnpm --dir apps/api bootstrap:local
pnpm dev:api
pnpm --dir apps/api worker:dev
pnpm dev:web
```

### Demo profile

```bash
pnpm --dir apps/api bootstrap:demo
pnpm --dir apps/api smoke:demo
```

### Release-candidate profile

```bash
pnpm --dir apps/api bootstrap:rc
pnpm --dir apps/api rc:gate
pnpm --dir apps/api smoke:rc
```

## 2. Release gate

Before any serious handoff or release rehearsal:

1. Run `pnpm --dir apps/api rc:gate`.
2. If the environment needs reseeding, run `pnpm --dir apps/api release:reset`.
3. Re-run `pnpm --dir apps/api smoke:bundle`.
4. Confirm web build, E2E, smoke, and evidence bundles are green for the same commit.

The consolidated RC gate is the current `backend-rc1` baseline covering `PR20→PR25`. Historical note: `PR18` established the clean-machine bootstrap discipline that this gate still depends on.

## 3. What to run first when things are slow or broken

Read these in order:

1. `GET /api/ops/metrics/summary`
2. `GET /api/ready`
3. `GET /api/health`
4. profile-specific smoke or reset output

Why this order:

- metrics summary tells you which surface is failing first,
- health breakdown shows which component is `READY`, `DEGRADED`, or `MISCONFIGURED`,
- ready/health alone can miss queue, secret-safety, or background-job drift.

## 4. Standard operational checks

### Health, readiness, and metrics

```bash
curl http://127.0.0.1:3000/api/health
curl http://127.0.0.1:3000/api/ready
curl http://127.0.0.1:3000/api/ops/metrics/summary
```

### Secrets and session hygiene

```bash
pnpm --dir apps/api secrets:check
pnpm --dir apps/api secrets:rotation:check
pnpm --dir apps/api secrets:rotation:audit
pnpm --dir apps/api auth:sessions:cleanup
```

Local/demo auth bootstrap frequently uses `ops / Parkly@123` for smoke validation on `local/demo`.

### Deployment verification

```bash
pnpm --dir apps/api verify:deployment -- --profile release-candidate --intent bootstrap
```

## 5. Incident playbooks

### Redis unavailable

Symptoms:

- `redis_up == 0`
- queue coordination or cache-assisted flows degrade
- observability summary shows Redis errors

Actions:

1. Check Redis reachability and memory.
2. Restart Redis if the failure is local infrastructure.
3. Re-run deployment verification or the relevant smoke step.
4. Watch `redis_command_failures_total` and `parkly_lane_lock_wait_time_ms`.

### Review queue or outbox backlog growth

Symptoms:

- `gate_review_queue_size` or `gate_outbox_backlog_size` stays elevated
- operators report stale operational flows

Actions:

1. Inspect `/api/outbox` and `/api/gate-review-queue`.
2. Inspect worker health and Redis.
3. Review recent incident, lane, and device status streams.
4. If backlog is operationally blocking, use audited drain or requeue commands only after the cause is understood.

### Secret rejection spike

Symptoms:

- `parkly_secret_rejects_total`, replay suspicion, or missing-auth counters grow quickly
- `summary.secretSafety` shows a spike or mismatch hint

Actions:

1. Read `/api/ops/metrics/summary` first.
2. Confirm active and next token topology.
3. Validate time skew, signature timestamp handling, and rollout order.
4. Use the explicit secret rotation or rollback path.

## 6. Backup, restore, reset, and demo rollback

### Create backup

```bash
pnpm --dir apps/api backup:create
pnpm --dir apps/api backup:demo
pnpm --dir apps/api backup:rc
```

### Restore and verify

```bash
pnpm --dir apps/api restore:apply
pnpm --dir apps/api restore:verify
```

### Reset for clean release smoke

```bash
pnpm --dir apps/api release:reset
pnpm --dir apps/api smoke:bundle
```

### Rollback bản demo

Use demo rollback when the fixture itself drifted, not when you merely need to clear old sessions:

1. restore the latest known-good demo backup,
2. verify grants and seed-min are intact,
3. run `pnpm --dir apps/api smoke:bundle`,
4. capture the same evidence bundle again.

Operational rule:

- backup proves recoverability,
- restore proves you can return to a known-good state,
- reset is for clean smoke and fixture refresh,
- rollback bản demo is the recovery path when the demo snapshot is no longer trustworthy.

Do not use retention cleanup as a substitute for restore, reset, or rollback.

## 7. Disaster drill

```bash
pnpm --dir apps/api drill:disaster
pnpm --dir apps/api drill:disaster:demo
```

Always keep the generated manifest with the backup artifact and always run restore verification after a restore or drill.

## 8. Release closure checklist

1. `pnpm --dir apps/api rc:gate` passes.
2. `pnpm --dir apps/api release:reset` and `pnpm --dir apps/api smoke:bundle` have been run for the target fixture when required.
3. Backup and restore paths are known-good for the target profile.
4. Health, readiness, metrics summary, and secret-safety signals are clean after bootstrap.
5. Required evidence listed in `docs/EVIDENCE.md` is captured and stored for the same commit.
