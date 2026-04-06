# Frontend role matrix

## Landing per role
| Role | Landing | Notes |
| --- | --- | --- |
| SUPER_ADMIN | `/overview` | Global operational overview |
| SITE_ADMIN | `/overview` | Site-wide admin overview |
| MANAGER | `/overview` | Operational overview with manager scope |
| OPERATOR | `/run-lane` | Direct lane workspace |
| GUARD | `/run-lane` | Direct lane workspace |
| CASHIER | `/reports` | Reporting-first fallback |
| VIEWER | `/overview` | Read-only monitoring landing |

## Canonical route access
| Route | SUPER_ADMIN | SITE_ADMIN | MANAGER | OPERATOR | GUARD | CASHIER | VIEWER |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/overview` | View | View | View | View | View | View | View |
| `/run-lane` | View | View | View | View | View | No | No |
| `/review-queue` | View | View | View | View | View | No | No |
| `/session-history` | View | View | View | View | View | No | View |
| `/lane-monitor` | View | View | View | View | View | No | View |
| `/device-health` | View | View | View | View | View | No | View |
| `/sync-outbox` | View | View | View | View | No | No | No |
| `/reports` | View | View | View | View | No | View | View |
| `/mobile-camera-pair` | View | View | View | View | View | No | No |
| `/capture-debug` | View | View | View | View | View | No | No |
| `/subscriptions` | View + mutate | View + mutate | View + mutate | View + mutate | No | No | No |
| `/parking-live` | View | View | View | View | View | No | View |
| `/settings` | View | View | View | View | View | View | View |
| `/topology` | View + mutate | View + mutate | No | No | No | No | No |

## Forbidden fallback
| Requested route | GUARD | CASHIER | VIEWER |
| --- | --- | --- | --- |
| `/subscriptions` | `/run-lane` | `/reports` | `/overview` |
| `/parking-live` | n/a | `/reports` | n/a |

## Review gate
Cross-check this matrix against:
- runtime policy registry
- `docs/frontend/routes.md`
- role landing after a real login
- manual QA sign-off for the current release wave
