# Conventions — Parkly Codebase

**Analyzed:** 2026-05-05
**Focus:** Code style, naming conventions, patterns, error handling

## TypeScript

- **Strict mode** enforced via `tsconfig.json`
- **`any` is forbidden** — `.cursorrules` mandates strict Zod schemas for all inputs
- Zod for runtime validation (not `typeof` or `instanceof` guards)
- `tsc -p tsconfig.json --noEmit` for type checking

## HTTP Envelopes (strict)

### Success
```json
{ "requestId": "uuid", "data": {} }
```

### Error
```json
{ "requestId": "uuid", "code": "UPPERCASE_ENUM", "message": "...", "details": {} }
```

### Contract rules
- `400 BAD_REQUEST` — validation failures
- `422 UNPROCESSABLE_ENTITY` — business rule failures
- `requestId` always echoed in body + `x-request-id` header

## Pagination

**Cursor-based only.** No offset pagination.

Response shape:
```json
{
  "rows": [],
  "pageInfo": {
    "type": "CURSOR",
    "limit": 50,
    "nextCursor": "string|null",
    "hasMore": true,
    "sort": "sessionId:desc"
  }
}
```

## Enums

- **Database**: UPPERCASE_SNAKE_CASE strings (e.g., `GATE_STATUS`, `SESSION_STATUS_ACTIVE`)
- **API codes**: UPPERCASE_SNAKE_CASE (e.g., `BAD_REQUEST`, `UNAUTHORIZED`)
- **No numeric enums** in transport layer

## Idempotency

- All state-changing APIs (payments, barrier commands) must implement idempotency
- Pattern: Redis `SETNX` fast-fail + DB `api_idempotency_keys` persistence
- Header: `x-idempotency-key`
- Redis Redlock for lane-level critical operations

## Early Returns

- No deep nesting
- Guard clauses for auth, validation, not-found cases
- Prefer `return` over `else`

## Module Structure (API)

Each module follows:

```
modules/{domain}/
  interfaces/http/
    register-*-routes.ts   # Route registration
    *-schemas.ts           # Zod input schemas
  application/
    *-service.ts          # Business logic
    *-policy.ts           # Business rules
  domain/
    *.ts                  # Domain entities/logic
```

## Frontend Patterns

- **Functional components only**
- **TanStack Query** for server state (API fetching, caching)
- **Zustand** for client state (UI toggles, local filters)
- **Custom hooks** for complex logic: `useRunLanePreview`, `useReviewQueue`, `useOverviewData`
- **Lazy loading** for page routes (see `routes.tsx`)
- **Data hydration**: REST snapshot first, SSE delta second (NEVER treat SSE as full source of truth)
- **Error handling**: catch at boundary, render based on `error.code` from RC1 envelope

## React Component Conventions

- `*.tsx` for components
- `*.test.ts` / `*.test.tsx` for tests
- co-located `__tests__` folders in `pages/` and `features/`
- Tailwind CSS for styling (no CSS modules, no styled-components)
- `clsx` + `tailwind-merge` for conditional class composition
- `cva` for variant components

## i18n

- `i18next` + `react-i18next`
- Keys use dot notation: `route.overview.label`, `error.session.notFound`
- Schema validation: `i18n.locale.schema.json`
- Parity checking: `scripts/i18n-safe-edit.py` (Python script for safe JSON editing)
- Two locales: `en.json`, `vi.json`

## Logging

- **pino** for structured logging
- `pino-http` for HTTP request/response logging
- Include `requestId`, `correlationId` where applicable

## Test Naming

| Pattern | Meaning |
|---------|---------|
| `pr01-redis-*.test.ts` | Integration test for PR01 |
| `smoke/*.test.ts` | Release gate smoke tests |
| `domain-events.vitest.ts` | Vitest unit tests |
| `decision-engine.vitest.ts` | Vitest unit tests |
| `*.test.ts` in `pages/` | Frontend unit tests |

## Error Handling

- Custom error hierarchy in `server/errors.ts`
- `error-handler.ts` middleware catches all
- Error codes are UPPERCASE_ENUMS
- No silent error swallowing

## API Route Registration

- Routes registered in `app.ts`
- Each module has `register-*-routes.ts` that adds routes to the Express app
- Auth middleware applied at route level
- Site scope middleware for tenant isolation

## Summary

Parkly conventions are well-defined and enforced. The RC1 envelope, Zod-first validation, cursor pagination, and idempotency patterns are the strongest parts. The main gap is the Node version conflict between `.cursorrules` and CI.
