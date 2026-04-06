# Parkly RBAC Matrix

RBAC snapshot date: 2026-03-30

## Canonical Roles

User-facing canonical roles:

- `SUPER_ADMIN`
- `SITE_ADMIN`
- `MANAGER`
- `OPERATOR`
- `GUARD`
- `CASHIER`
- `VIEWER`

Compatibility role:

- `WORKER` remains in backend compatibility groups for legacy surfaces, but it is not a canonical web role.

## Enforcement Rules

- `SUPER_ADMIN` bypasses explicit backend role checks.
- Route authorization in `apps/web` and API authorization in `apps/api` both use the same canonical role model.
- Site scope is enforced in addition to role membership on scoped read and write paths.

## API Group Matrix

| API Surface | SUPER_ADMIN | SITE_ADMIN | MANAGER | OPERATOR | GUARD | CASHIER | VIEWER | WORKER* |
| --- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| Health and readiness | Y | Y | Y | Y | Y | Y | Y | Y |
| Auth self-service (`/api/auth/me`, revoke own sessions) | Y | Y | Y | Y | Y | Y | Y | Y |
| Auth admin mutation (`/api/auth/admin/*`) | Y | Y | Y | Y | N | N | N | N |
| Dashboard summary | Y | Y | Y | Y | Y | Y | Y | Y |
| Subscription dashboard slice | Y | Y | Y | Y | N | Y | N | N |
| Gate session read | Y | Y | Y | Y | Y | N | Y | Y |
| Gate session open/resolve | Y | Y | Y | Y | Y | N | N | N |
| Review queue claim and manual approve or reject | Y | Y | Y | Y | Y | N | N | N |
| Manual open barrier | Y | Y | Y | Y | N | N | N | N |
| Incident read and resolve | Y | Y | Y | Y | Y | N | N | N |
| Lane status, device health, outbox streams | Y | Y | Y | Y | Y | N | Y | Y |
| Parking live | Y | Y | Y | Y | Y | N | Y | N |
| Spot occupancy refresh | Y | Y | Y | Y | Y | N | N | N |
| Media upload from web app | Y | Y | Y | Y | Y | N | N | N |
| Subscription admin CRUD | Y | Y | Y | Y | N | N | N | N |
| Topology device or lane admin | Y | Y | Y | Y | N | N | N | N |
| Site creation | Y | N | N | N | N | N | N | N |
| Audit read | Y | Y | Y | Y | N | N | N | N |
| Bulk import and webhook admin | Y | Y | Y | Y | N | N | N | N |

## Web Route Homes

Canonical route homes implemented in `apps/web/src/lib/auth/role-policy.ts`:

| Role | Preferred Home Routes |
| --- | --- |
| `SUPER_ADMIN` | `/overview`, `/reports`, `/sync-outbox` |
| `SITE_ADMIN` | `/overview`, `/reports`, `/subscriptions` |
| `MANAGER` | `/overview`, `/run-lane`, `/reports` |
| `OPERATOR` | `/run-lane`, `/review-queue`, `/lane-monitor` |
| `GUARD` | `/run-lane`, `/review-queue`, `/lane-monitor` |
| `CASHIER` | `/reports`, `/overview`, `/settings` |
| `VIEWER` | `/overview`, `/lane-monitor`, `/session-history` |

## Notes

- `WORKER` is documented only to explain compatibility behavior on selected backend paths.
- `SITE_ADMIN`, `MANAGER`, and `OPERATOR` share most admin-ops surfaces, but only `SUPER_ADMIN` can create a new site.
- `VIEWER` is intentionally read-only.
- `CASHIER` can read reporting and subscription-related dashboard slices but cannot mutate gate operations.
