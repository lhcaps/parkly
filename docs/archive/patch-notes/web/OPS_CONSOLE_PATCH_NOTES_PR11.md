# PR-11 — Web Gate Operations Console Cutover

## What changed

- Added feature folders:
  - `src/features/lane-monitor/*`
  - `src/features/review-queue/*`
  - `src/features/session-history/*`
  - `src/features/device-health/*`
  - `src/features/manual-control/*`
  - `src/features/outbox-monitor/*`
- Reworked navigation into an operations console:
  - Console Overview
  - Lane Monitor
  - Review Queue
  - Session History
  - Device Health
  - Outbox Monitor
  - Lane Entry Surface
- `GatePage` is now positioned as the lane entry surface instead of a pseudo-simulator page.
- `SessionsPage` now renders session detail like an operations console:
  - timeline
  - decisions
  - barrier commands
  - evidence/media
  - manual actions
  - incidents
- Session actions are rendered from `allowedActions` and additionally locked by role on the frontend.
- Added SSE-backed panels for lane status, device health and outbox feeds.
- Removed UI references to demo / mock / simulate wording from the main flow.
- Synced Devices/console text with backend reality.

## Validation done in container

- `apps/web`: TypeScript check passed with:
  - `node ./node_modules/typescript/bin/tsc --noEmit`

## Not validated here

- Full Vite production build could not be completed in this container because `esbuild` is missing from the provided node_modules snapshot.
