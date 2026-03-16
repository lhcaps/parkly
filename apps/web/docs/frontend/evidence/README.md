# Frontend evidence bundle

- Generated at: 2026-03-15T09:12:01.849Z
- Build log: dán từ terminal vào file kèm theo khi bàn giao
- Smoke output: latest-smoke.json đã có
- Screenshots: chụp thủ công theo docs/frontend/acceptance-checklist.md
- Manual signoff: manual-qa-signoff.md

## Smoke snapshot

{
  "startedAt": "2026-03-15T09:12:01.417Z",
  "baseUrl": "http://127.0.0.1:4173",
  "api": {
    "skipped": false,
    "ok": false,
    "target": "http://127.0.0.1:3000/health",
    "durationMs": 1,
    "bodyHint": "fetch failed"
  },
  "routes": [
    {
      "name": "login",
      "path": "/login",
      "status": 200,
      "ok": true,
      "durationMs": 17,
      "bodyHint": "<!doctype html> <html lang=\"vi\"> <head> <meta charset=\"UTF-8\" /> <meta name=\"viewport\" content=\"width=device-w"
    },
    {
      "name": "overview",
      "path": "/overview",
      "status": 200,
      "ok": true,
      "durationMs": 3,
      "bodyHint": "<!doctype html> <html lang=\"vi\"> <head> <meta charset=\"UTF-8\" /> <meta name=\"viewport\" content=\"width=device-w"
    },
    {
      "name": "run-lane",
      "path": "/run-lane?siteCode=SITE_HCM_01&gateCode=GATE_01&laneCode=GATE_01_ENTRY",
      "status": 200,
      "ok": true,
      "durationMs": 2,
      "bodyHint": "<!doctype html> <html lang=\"vi\"> <head> <meta charset=\"UTF-8\" /> <meta name=\"viewport\" content=\"width=device-w"
    },
    {
      "name": "review-queue",
      "path": "/review-queue?siteCode=SITE_HCM_01&status=OPEN&q=43A&reviewId=RV-1001",
      "status": 200,
      "ok": true,
      "durationMs": 1,
      "bodyHint": "<!doctype html> <html lang=\"vi\"> <head> <meta charset=\"UTF-8\" /> <meta name=\"viewport\" content=\"width=device-w"
    },
    {
      "name": "session-history",
      "path": "/session-history?siteCode=SITE_HCM_01&status=OPEN&q=43A&sessionId=GS-1001",
      "status": 200,
      "ok": true,
      "durationMs": 2,
      "bodyHint": "<!doctype html> <html lang=\"vi\"> <head> <meta charset=\"UTF-8\" /> <meta name=\"viewport\" content=\"width=device-w"
    },
    {
      "name": "audit-viewer",
      "path": "/audit-viewer?siteCode=SITE_HCM_01&quick=request&requestId=req-demo-001&auditId=AU-1001",
      "status": 200,
      "ok": true,
      "durationMs": 2,
      "bodyHint": "<!doctype html> <html lang=\"vi\"> <head> <meta charset=\"UTF-8\" /> <meta name=\"viewport\" content=\"width=device-w"
    },
    {
      "name": "sync-outbox",
      "path": "/sync-outbox?siteCode=SITE_HCM_01&status=FAILED&quick=failed&outboxId=OB-1001",
      "status": 200,
      "ok": true,
      "durationMs": 2,
      "bodyHint": "<!doctype html> <html lang=\"vi\"> <head> <meta charset=\"UTF-8\" /> <meta name=\"viewport\" content=\"width=device-w"
    },
    {
      "name": "reports",
      "path": "/reports?siteCode=SITE_HCM_01&days=7",
      "status": 200,
      "ok": true,
      "durationMs": 1,
      "bodyHint": "<!doctype html> <html lang=\"vi\"> <head> <meta charset=\"UTF-8\" /> <meta name=\"viewport\" content=\"width=device-w"
    },
    {
      "name": "mobile-camera-pair",
      "path": "/mobile-camera-pair",
      "status": 200,
      "ok": true,
      "durationMs": 4,
      "bodyHint": "<!doctype html> <html lang=\"vi\"> <head> <meta charset=\"UTF-8\" /> <meta name=\"viewport\" content=\"width=device-w"
    },
    {
      "name": "mobile-capture",
      "path": "/mobile-capture?siteCode=SITE_HCM_01&laneCode=GATE_01_ENTRY",
      "status": 200,
      "ok": true,
      "durationMs": 1,
      "bodyHint": "<!doctype html> <html lang=\"vi\"> <head> <meta charset=\"UTF-8\" /> <meta name=\"viewport\" content=\"width=device-w"
    }
  ],
  "passCount": 10,
  "failCount": 0
}
