# API host/grant fix

This patch fixes the local MySQL auth/grant mess on Windows by doing three things:

1. Node-side DB connections normalize `localhost` to `127.0.0.1` by default.
2. Bootstrap now creates **parking_root** and **parking_app** for `localhost`, `127.0.0.1`, and `::1`, and grants `parking_root` schema-admin rights with `WITH GRANT OPTION` on all three.
3. Grant scripts fan out runtime grants to the same three host variants.

## Required one-time step if your DB was bootstrapped before this patch
Run `db/scripts/bootstrap.sql` using **MySQL root/system admin** (DBeaver is fine).
This is required because `parking_root` cannot create missing MySQL accounts by itself.

## After that
```bash
cd apps/api
pnpm db:grant:app
pnpm db:whoami:app
pnpm dev
```

## Override
If you explicitly want Node to keep using literal `localhost`, set:

```env
DB_PREFER_LITERAL_LOCALHOST=ON
```
