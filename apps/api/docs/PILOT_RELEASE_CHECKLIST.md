# Pilot Release Checklist

## Preflight

```bash
pnpm --dir apps/api secrets:check -- --profile release-candidate --intent pilot --strict --format json
pnpm --dir apps/api secrets:rotation:check -- --require-active --format json
pnpm --dir apps/api verify:deployment -- --profile release-candidate --intent pilot
```

## Gate

```bash
pnpm --dir apps/api pilot:gate
```

## Evidence bắt buộc

- `release-evidence/backend-pilot/security-secrets-check.json`
- `release-evidence/backend-pilot/security-rotation-check.json`
- `release-evidence/backend-pilot/verify-deployment-pilot.json`
- `release-evidence/backend-pilot/pilot-gate-summary.json`

## Label nội bộ

- `backend-pilot-ready`
