# Frontend role matrix — wave parking-live + subscriptions + RBAC

## Landing per role
| Role | Landing | Notes |
|---|---|---|
| ADMIN | `/overview` | Canonical admin/ops shell landing |
| OPS | `/overview` | Shared operational landing |
| GUARD | `/run-lane` | Direct operational workspace |
| CASHIER | `/reports` | Reporting-first fallback |
| WORKER | `/lane-monitor` | Monitoring-first fallback |

## Canonical route access
| Route | ADMIN | OPS | GUARD | CASHIER | WORKER |
|---|---|---|---|---|---|
| `/overview` | View | View | View | View | View |
| `/run-lane` | View | View | View | No | No |
| `/review-queue` | View | View | View | No | No |
| `/session-history` | View | View | View | No | View |
| `/lane-monitor` | View | View | View | No | View |
| `/device-health` | View | View | View | No | View |
| `/sync-outbox` | View | View | No | No | No |
| `/reports` | View | View | No | View | View |
| `/mobile-camera-pair` | View | View | View | No | No |
| `/capture-debug` | View | View | View | No | No |
| `/subscriptions` | View + Mutate | View + Mutate | No | No | No |
| `/parking-live` | View | View | View | No | No |
| `/settings` | View | View | View | View | View |

## Mutation capability in scope
| Surface | ADMIN | OPS | GUARD | CASHIER | WORKER |
|---|---|---|---|---|---|
| Subscription create/edit/status patch | Yes | Yes | No | No | No |
| Subscription vehicle create/edit/primary/status patch | Yes | Yes | No | No | No |
| Subscription spot create/edit/primary/release/suspend | Yes | Yes | No | No | No |
| Parking Live reconcile / refresh | Yes | Yes | Yes | No | No |
| Read-only access to subscription detail | Yes | Yes | Not in current policy | Not in current policy | Not in current policy |

## Forbidden fallback expectation
| Requested route | GUARD | CASHIER | WORKER |
|---|---|---|---|
| `/subscriptions` | `/run-lane` | `/reports` | `/lane-monitor` |
| `/parking-live` | n/a | `/reports` | `/lane-monitor` |

## Review gate
Role matrix này phải được đối chiếu với:
- policy registry runtime
- docs/frontend/routes.md
- auth landing behavior sau login thật
- manual QA sign-off của wave hiện tại
