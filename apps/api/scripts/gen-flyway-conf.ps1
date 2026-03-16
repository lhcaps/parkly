$ErrorActionPreference = 'Stop'
# Windows wrapper: call TS generator (tsx) to produce db/flyway.conf
pnpm -s tsx scripts/gen-flyway-conf.ts
