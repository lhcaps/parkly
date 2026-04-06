# Backend RC Changelog

Baseline tag: `backend-rc1`

## Scope

- BE-PR-20: auth + RBAC consolidation
- BE-PR-21: contract freeze
- BE-PR-22: dashboard read-model hardening
- BE-PR-23: deployment profile cleanup
- BE-PR-24: backup / restore / disaster drill
- BE-PR-25: final release hardening

## Highlights

- RC1 freezes the backend-rc1 contract around PR20 to PR25.
- The RC gate now expects `rc:gate`, `release:reset`, and `smoke:bundle` to stay aligned.
- Clean-machine evidence is tracked through `rc1:fixtures:check`, `rc1:smoke:repeat`, and `rc1:gate`.

## Schema Impact

- Flyway migration v33 removes the duplicate ticket index used by older quality checks.
- DLQ persistence and deployment quality checks were aligned with the current schema.

## Grant Impact

- MVP grants remain the source of truth for the RC1 consolidated runtime surface.
- Grant impact covers auth / dashboard / presence / incidents / audit.

## Notes

- This changelog is the release-note companion for BE-PR-25.
- Source regressions use this file as the canonical changelog artifact for backend-rc1.
