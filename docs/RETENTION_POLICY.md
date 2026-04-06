# Parkly Retention Policy

Retention policy snapshot date: 2026-03-30

## 1. Objectives

Retention cleanup must satisfy all of the following:

- preserve repeatable demo baselines
- keep release-like environments operationally clean
- protect auditability, evidence, and critical incident history

Canonical commands:

```bash
pnpm --dir apps/api cleanup:retention:dry-run
pnpm --dir apps/api cleanup:retention
```

## 2. Guardrails

- Dry-run must be executed before apply.
- Cleanup must be idempotent.
- Cleanup output must show scanned, eligible, deleted, and error counts.
- `audit_logs` are not deleted by default.
- critical incident history is not deleted by default.
- evidence media and active operational records must not be removed opportunistically.

## 3. Profile Policy

### Demo

Purpose:

- preserve repeatability for smoke and demonstrations

Allowed cleanup:

- expired or revoked auth sessions
- stale login-attempt ledgers
- temporary runtime scratch artifacts
- non-essential noise records that are outside the protected baseline

### Release-candidate or release-like

Purpose:

- maintain runtime hygiene without losing auditability

Allowed cleanup:

- expired or revoked auth sessions
- retention-managed temporary files
- noise-only operational artifacts outside active windows

Protected data:

- `audit_logs`
- critical incidents
- evidence-bearing media
- active sessions, active reviews, and currently relevant business records

## 4. Dataset Guidance

### Auth

May clean:

- expired sessions
- revoked sessions after retention window
- stale login-attempt data

Must protect:

- active user sessions
- recent revoke-all evidence required for investigation

### Gate and incident data

May clean:

- noise-only internal presence artifacts outside the retention window
- non-critical derived artifacts that are no longer operationally useful

Must protect:

- open incidents
- critical incidents
- evidence linked to active reviews or incidents

### Files and media

May clean:

- temporary upload scratch areas
- disposable runtime artifacts outside observability and backup storage

Must protect:

- evidence media
- backup manifests and retained restore artifacts
- observability state explicitly marked as retained

## 5. Output Contract

Dry-run and apply should emit a summary equivalent to:

```json
{
  "scanned": 0,
  "eligible": 0,
  "deleted": 0,
  "errors": 0,
  "sampleIds": []
}
```

## 6. Operating Procedure

1. Run `cleanup:retention:dry-run`.
2. Review whether the candidate rows or files match the intended profile.
3. Run `cleanup:retention` only after review.
4. Re-check health and metrics if the cleanup touched a busy environment.

## 7. Release Rule

Retention cleanup is acceptable for a release snapshot only when:

- dry-run output is complete
- apply is idempotent
- protected datasets remain protected
- the environment is still healthy after the cleanup pass
