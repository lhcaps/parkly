# Monorepo grant resilience hotfix

## What changed

- `apps/api/src/scripts/apply-grants-parking-app.ts`
  - now treats missing `GRANT OPTION` on `parking_root` as a recoverable local-dev case
  - after a GRANT failure, it probes `parking_app` privileges with `SHOW GRANTS`
  - if `parking_app` already has the required gate v4/e2e privileges, it warns and exits successfully instead of killing `pnpm e2e`
  - strict mode still exists via `pnpm db:grant:app:strict`

- `apps/api/src/scripts/_probe-parking-app-grants.ts`
  - new helper to inspect effective privileges of the runtime user

- `apps/api/src/scripts/db-whoami-app.ts`
  - now prints `SHOW GRANTS` in addition to current user and gate table probe

- `apps/api/package.json`
  - added `db:grant:app:strict`

## Why

Local MySQL installs often end up with this state:
- `parking_root` can migrate schema
- but `parking_root` does **not** have `WITH GRANT OPTION`
- `pnpm db:grant:app` fails even though `parking_app` may already be usable

This hotfix stops `e2e` from failing early for that reason alone.

## Important limit

If `parking_app` really is missing required privileges, this patch will still fail and tell you to rerun `apps/api/db/scripts/bootstrap.sql` using real MySQL root/system admin.
