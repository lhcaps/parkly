Prisma client hotfix
====================

Symptom fixed
- Cannot find module '.prisma/client/default'

Root cause
- @prisma/client was installed but generated client artifacts were missing in node_modules/.prisma.
- Running `pnpm dev` before `prisma generate` caused runtime failure.

Fix applied
- apps/api/package.json
  - added `prisma:generate`
  - added `predev`
  - added `preworker:dev`
- root package.json
  - added `postinstall`
  - added `prisma:generate`

Recommended commands after extracting this repo
1. pnpm install
2. pnpm --dir apps/api prisma:generate
3. pnpm --dir apps/api dev
