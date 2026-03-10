# Parkly monorepo fix bundle

This bundle includes:
- full monorepo with `apps/api`, `apps/web`, `packages/contracts`, `packages/gate-core`
- PR-02 shared plate core integration
- API capture/session routes integration already present in the patched API
- MySQL connection fix for RSA/caching_sha2_password (`allowPublicKeyRetrieval=true`, `ssl=false`)
- host normalization from `localhost` to `127.0.0.1` in Node-side MariaDB connections
- bootstrap + grants scripts updated for `localhost`, `127.0.0.1`, and `::1`
- root `packageManager` fixed to valid semver
- `db:whoami:app` helper script in `apps/api`

Important:
1. Run `apps/api/db/scripts/bootstrap.sql` one time from MySQL root / system admin.
2. Then run in `apps/api`:
   - `pnpm db:migrate`
   - `pnpm prisma:pull`
   - `pnpm db:grant:app`
   - `pnpm db:seed:min`
   - `pnpm db:whoami:app`
   - `pnpm dev`
