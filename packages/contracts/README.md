# @parkly/contracts

Canonical shared Zod schemas and TypeScript types for the Parkly transport layer. Both `apps/api` and `apps/web` consume this package as the single source of truth for API contracts.

## What It Contains

- **Auth types**: `AuthRole`, session types, JWT claims
- **Gate session types**: `GateSession`, capture request/response, decision codes
- **Review queue types**: `ReviewItem`, claim/approve/reject actions
- **Topology types**: `Site`, `Gate`, `Lane`, `Device`
- **Dashboard types**: `DashboardSummary`, KPI metrics
- **Outbox types**: `OutboxItem`, delivery status
- **Common types**: `PageInfo`, cursor pagination, HTTP envelopes

## RC1 Envelope Format

### Success
```json
{ "requestId": "uuid", "data": {} }
```

### Error
```json
{ "requestId": "uuid", "code": "UPPERCASE_ENUM", "message": "...", "details": {} }
```

## Usage

```typescript
import type { GateSession, AuthRole } from '@parkly/contracts'
import { PlateCaptureBodySchema } from '@parkly/contracts'
```

## Maintenance Rules

- All API routes must use schemas from this package for request validation
- Frontend page components must use types from this package, not duplicated inline
- Error codes must be UPPERCASE_SNAKE_CASE
- Pagination must be cursor-based with `pageInfo.nextCursor`
