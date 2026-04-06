# Parkly Documentation

Last updated: 2026-03-30
Canonical project snapshot: [SPEC-v11.md](./SPEC-v11.md)
Primary audience: engineering, release managers, operators, and auditors

## Canonical Documents

| Document | Purpose |
| --- | --- |
| [SPEC-v11.md](./SPEC-v11.md) | Enterprise snapshot of the full project as of March 30, 2026 |
| [spec/Parkly_Project_Snapshot_v11_20260330.docx](./spec/Parkly_Project_Snapshot_v11_20260330.docx) | Enterprise Word export generated from the current v11 snapshot |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Runtime topology, bounded contexts, and deployment shape |
| [API.md](./API.md) | API contract summary, auth surfaces, envelopes, and integration rules |
| [RBAC_MATRIX_API.md](./RBAC_MATRIX_API.md) | Canonical role model and endpoint-group access matrix |
| [ADR.md](./ADR.md) | Architecture decisions that govern core platform behavior |
| [RUNBOOK.md](./RUNBOOK.md) | Day-2 operations, incident handling, backup, restore, and release procedures |
| [ERROR_CODES.md](./ERROR_CODES.md) | Standard error catalog used by the API envelope |
| [RETENTION_POLICY.md](./RETENTION_POLICY.md) | Data retention and cleanup policy for demo and release profiles |
| [EVIDENCE.md](./EVIDENCE.md) | Required evidence for CI, QA, release sign-off, and auditability |

## Supporting Product Docs

| Location | Purpose |
| --- | --- |
| [../README.md](../README.md) | Monorepo overview and quickstart |
| [../apps/api/docs/RUNBOOK.md](../apps/api/docs/RUNBOOK.md) | Backend deep-dive runbook |
| [../apps/api/docs/BACKUP_RESTORE.md](../apps/api/docs/BACKUP_RESTORE.md) | Backup and restore details |
| [../apps/api/docs/SECURITY_SECRETS.md](../apps/api/docs/SECURITY_SECRETS.md) | Secret hygiene and rotation notes |
| [../apps/api/docs/grafana-dashboards/README.md](../apps/api/docs/grafana-dashboards/README.md) | Grafana dashboard inventory |

## Versioning Policy

- `SPEC-v11.md` is the active top-level project snapshot.
- Older project snapshots and historical plans live under [archive/](./archive/).
- Only top-level files in `docs/` should be treated as current canonical guidance.
- Historical patch notes, superseded specs, and one-off notes must not be linked as current release truth.

## Cleanup Rules

- Keep `docs/` limited to living, operator-facing documentation.
- Move superseded snapshots and historical `.docx` deliverables into `docs/archive/`.
- Keep generated `.docx` deliverables in `docs/spec/` only when they represent the latest approved snapshot.
