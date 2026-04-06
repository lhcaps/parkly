# Frontend route and query-param contract

## Goal
Critical operational routes must reopen the correct context when:
- the page is refreshed
- a URL is pasted into a new tab
- the browser uses back or forward navigation
- an operator hands off a deep link

## Shared rules
- Only durable, shareable state belongs in the URL.
- Never put secrets, runtime tokens, or sensitive draft notes in query params.
- Invalid query params must normalize back to safe defaults and must not crash the page.
- The URL is the source of truth for shareable state. Local hooks can retain only ephemeral UI state.

## Review Queue `/review-queue`
- `siteCode`
- `status`: `OPEN | CLAIMED | RESOLVED | CANCELLED`
- `q`
- `from`
- `to`
- `reviewId`

## Session History `/session-history`
- `siteCode`
- `laneCode`
- `status`
- `direction`: `ENTRY | EXIT`
- `q`
- `from`
- `to`
- `sessionId`

## Sync Outbox `/sync-outbox`
- `siteCode`
- `status`: `PENDING | SENT | FAILED`
- `quick`: `failed | pending | retrying | sent | barrier | review`
- `q`
- `correlationId`
- `requestId`
- `entity`
- `outboxId`

## Reports `/reports`
- `siteCode`
- `days`: `1 | 3 | 7 | 14 | 30`

## Parking Live `/parking-live`
- `siteCode`
- `floor`
- `zone`
- `status`
- `q`
- `spot`
- `density`: `comfortable | compact`

Monitoring contract:
- search only spotlights matching slots and must not erase board context
- snapshot is the authoritative state source
- SSE is advisory delta only
- when realtime fails but snapshot exists, the board stays visible with a stale banner
- invalid `density`, `status`, `floor`, `zone`, or `spot` values normalize to safe defaults

## Subscriptions `/subscriptions`
- `siteCode`
- `status`: `ACTIVE | EXPIRED | SUSPENDED | CANCELLED`
- `plate`
- `id`
- `tab`: `overview | spots | vehicles`

Deep-link contract:
- the URL is the source of truth for `siteCode`, `status`, `plate`, `id`, and `tab`
- if `id` remains valid in the current result set, the detail pane must reopen the same record and tab
- if `id` is no longer valid, selection must clear deliberately and `tab` must fall back to `overview`
- invalid `tab` values fall back to `overview`

## Run Lane `/run-lane`
- `siteCode`
- `gateCode`
- `laneCode`

## Mobile Capture `/mobile-capture`
Mobile capture receives context from the pair link or prefilled query string. After a successful capture, handoff buttons can open:
- `/session-history?siteCode=...&sessionId=...`
- `/run-lane?siteCode=...&laneCode=...`

## Canonical shell surfaces
- `/overview`
- `/run-lane`
- `/review-queue`
- `/session-history`
- `/lane-monitor`
- `/device-health`
- `/sync-outbox`
- `/reports`
- `/mobile-camera-pair`
- `/capture-debug`
- `/subscriptions`
- `/parking-live`
- `/settings`
- `/topology`

## Canonical role-home contract
- `SUPER_ADMIN` -> `/overview`
- `SITE_ADMIN` -> `/overview`
- `MANAGER` -> `/overview`
- `OPERATOR` -> `/run-lane`
- `GUARD` -> `/run-lane`
- `CASHIER` -> `/reports`
- `VIEWER` -> `/overview`

## Forbidden fallback contract
- `/subscriptions`
  - `GUARD` -> `/run-lane`
  - `CASHIER` -> `/reports`
  - `VIEWER` -> `/overview`
- `/parking-live`
  - `CASHIER` -> `/reports`

## Evidence contract
Before merge, align this document with:
- the runtime policy registry
- `docs/frontend/evidence/latest-smoke-dev.json`
- `docs/frontend/evidence/latest-smoke-dist.json`
- current manual QA sign-off
