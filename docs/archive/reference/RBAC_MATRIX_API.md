# Parkly API – RBAC Matrix (Demo)

| Endpoint | Method | ADMIN | OPS | GUARD | CASHIER | WORKER |
|---|---:|:---:|:---:|:---:|:---:|:---:|
| /api/health | GET | ✅ | ✅ | ✅ | ✅ | ✅ |
| /api/ready | GET | ✅ | ✅ | ✅ | ✅ | ✅ |
| /api/me | GET | ✅ | ✅ | ✅ | ✅ | ✅ |
| /api/sites | GET | ✅ | ✅ | ✅ | ❌ | ❌ |
| /api/devices | GET | ✅ | ✅ | ✅ | ❌ | ❌ |
| /api/gate-events | POST | ✅ | ✅ | ✅ | ❌ | ❌ |
| /api/gate-events | GET | ✅ | ✅ | ✅ | ❌ | ✅ |
| /api/media/upload | POST | ✅ | ✅ | ✅ | ❌ | ❌ |
| /api/alpr/recognize | POST | ✅ | ✅ | ✅ | ❌ | ❌ |
| /api/outbox | GET | ✅ | ✅ | ❌ | ❌ | ✅ |
| /api/outbox/drain | POST | ✅ | ❌ | ❌ | ❌ | ✅ |
| /api/outbox/requeue | POST | ✅ | ❌ | ❌ | ❌ | ❌ |
| /api/tariffs | GET | ✅ | ✅ | ❌ | ❌ | ❌ |
| /api/tariffs | POST | ✅ | ❌ | ❌ | ❌ | ❌ |
| /api/tariffs/:id | PATCH | ✅ | ❌ | ❌ | ❌ | ❌ |
| /api/tariffs/:id/active | PATCH | ✅ | ❌ | ❌ | ❌ | ❌ |
| /api/tariffs/:id/rules | POST | ✅ | ❌ | ❌ | ❌ | ❌ |
| /api/tariffs/:id/rules/:ruleId | DELETE | ✅ | ❌ | ❌ | ❌ | ❌ |
| /api/tariffs/quote | POST | ✅ | ✅ | ❌ | ❌ | ❌ |
| /api/audit-logs | GET | ✅ | ✅ | ❌ | ❌ | ❌ |
| /api/shift/demo-seed | POST | ✅ | ❌ | ❌ | ❌ | ❌ |
| /api/shift/close | POST | ✅ | ❌ | ❌ | ✅ | ❌ |
| /api/shift/closures | GET | ✅ | ✅ | ❌ | ✅ | ❌ |
| /api/shift/closures/:shiftCode | GET | ✅ | ✅ | ❌ | ✅ | ❌ |
| /api/stream/gate-events | GET (SSE) | ✅ | ✅ | ✅ | ❌ | ✅ |
| /api/stream/outbox | GET (SSE) | ✅ | ✅ | ❌ | ❌ | ✅ |
| /api/reports/summary | GET | ✅ | ✅ | ❌ | ❌ | ❌ |

**Notes**
- Demo token-based auth: map token -> role (+ optional actorUserId). See `.env.example`.
- Production: thay bằng JWT/OIDC + permission table.
