# Parkly Error Catalog

Every error response uses the standard API envelope:

```json
{
  "requestId": "uuid",
  "code": "ERROR_CODE",
  "message": "Human readable summary",
  "details": {}
}
```

## Canonical Error Codes

| Code | HTTP | Meaning | Typical Cause |
| --- | --- | --- | --- |
| `BAD_REQUEST` | 400 | Request shape is invalid | Validation failure, malformed cursor, missing required field |
| `UNAUTHENTICATED` | 401 | Caller could not be authenticated | Missing bearer token, invalid token, expired session |
| `FORBIDDEN` | 403 | Caller authenticated but lacks permission | Role mismatch or site-scope denial |
| `NOT_FOUND` | 404 | Target resource does not exist | Unknown session, review, audit, or job |
| `CONFLICT` | 409 | Request conflicts with current state | Idempotency collision, duplicate key, concurrent mutation |
| `PAYLOAD_TOO_LARGE` | 413 | Payload exceeds configured limit | Oversized media upload |
| `UNSUPPORTED_MEDIA_TYPE` | 415 | Media type not accepted | Invalid upload MIME type |
| `UNPROCESSABLE_ENTITY` | 422 | Business rule violation | Anti-passback, invalid workflow transition, rule breach |
| `SERVICE_UNAVAILABLE` | 503 | Service intentionally unavailable | Maintenance or overload style condition |
| `DEP_UNAVAILABLE` | 503 | Dependency is down or unreachable | Redis, object storage, or similar runtime dependency |
| `INTERNAL_ERROR` | 500 | Unexpected server failure | Unhandled runtime or database permission issue |

## Typed Error Classes

Route handlers use typed error helpers from `apps/api/src/server/errors.ts`:

- `NotFoundError`
- `ConflictError`
- `BusinessRuleError`
- `ValidationError`
- `UnauthenticatedError`
- `ForbiddenError`
- `PayloadTooLargeError`

These are normalized by the global error middleware into the standard envelope.

## Behavior Notes

- Validation failures should not silently coerce invalid data.
- Business rule failures should prefer `UNPROCESSABLE_ENTITY` over generic `BAD_REQUEST`.
- Dependency failures should return `DEP_UNAVAILABLE` when the failing component is known.
- The backend may include structured `details` for operational debugging, but the envelope shape is stable.

## Example Responses

### Validation failure

```json
{
  "requestId": "req-123",
  "code": "BAD_REQUEST",
  "message": "Validation failed",
  "details": {
    "fieldErrors": [
      { "path": "siteCode", "message": "Required" }
    ]
  }
}
```

### Permission failure

```json
{
  "requestId": "req-123",
  "code": "FORBIDDEN",
  "message": "Role 'VIEWER' is not permitted to access this resource",
  "details": {
    "requiredRoles": ["SITE_ADMIN", "MANAGER", "OPERATOR"],
    "currentRole": "VIEWER"
  }
}
```

### Dependency failure

```json
{
  "requestId": "req-123",
  "code": "DEP_UNAVAILABLE",
  "message": "Redis is unavailable",
  "details": {
    "dependency": "Redis"
  }
}
```

### Business rule failure

```json
{
  "requestId": "req-123",
  "code": "UNPROCESSABLE_ENTITY",
  "message": "Anti-passback blocked the request",
  "details": {
    "ruleCode": "ANTI_PASSBACK"
  }
}
```
