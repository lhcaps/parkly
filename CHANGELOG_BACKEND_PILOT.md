# Backend Pilot Changelog

Label: `backend-pilot-ready`

## Scope

- BE-PR-35: pilot gate hardening

## Highlights

- `pilot:gate` now bundles security secret checks, rotation checks, and pilot deployment verification.
- Evidence artifacts are emitted under `release-evidence/backend-pilot`.
- Active rotation topology is required before the backend can be called backend-pilot-ready.

## Evidence

- `security-secrets-check.json`
- `security-rotation-check.json`
- `verify-deployment-pilot.json`
- `pilot-gate-summary.json`
