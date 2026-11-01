# Parkly CI audit

Observed on 2026-11-02. Baseline commit: `595934ac90a6108898a0e70027c6250ae583535e` (`main` at the time of inspection). Local changes are on `chore/career-evidence-2026`.

## Hosted baseline

| Workflow | Run | Result and observed failing step |
| --- | --- | --- |
| Parkly CodeQL | [28773264742](https://github.com/lhcaps/parkly/actions/runs/28773264742) | Failed at `pnpm/action-setup@v4`; dependency installation and CodeQL analysis were skipped. |
| Parkly Quality Gate | [25388948741](https://github.com/lhcaps/parkly/actions/runs/25388948741) | Quality, migration and security jobs failed at `pnpm/action-setup@v4`. |

Both runs used the baseline SHA. GitHub's retained check annotations report multiple pnpm versions: action input `10` and `packageManager: pnpm@10.0.0`. The full logs returned HTTP 410 and were unavailable. The annotation also warns that CodeQL Action v3 is due for deprecation in December 2026. No CodeQL analysis result can be inferred from the failed setup.

## Change and verification

Removed the redundant `version` input from all four pnpm setup steps and the unused `PNPM_VERSION` environment variable. The exact `pnpm@10.0.0` package-manager pin remains in `package.json`. No checks were skipped or disabled. This addresses the failure described by the retained annotation; a hosted run at the new commit is still required to verify the action and reveal any later failures.

On Windows, Node `v22.23.1`, pnpm `10.0.0`, Python `3.14.0` and PyYAML `6.0.3`, with the working tree based on the baseline SHA:

| Command/check | Result |
| --- | --- |
| One-off Node check for pnpm action version inputs in both workflow files | Before: four duplicate declarations, exit 1; after: zero, exit 0. |
| PyYAML `safe_load` of both workflow files | PASS: both parsed. This does not execute or fully validate GitHub Actions semantics. |
| `pnpm install --frozen-lockfile --store-dir <local-store>` | PASS, including Prisma client generation. pnpm reported ignored dependency build scripts. |
| `pnpm typecheck:web` | PASS. |
| `pnpm --dir apps/web build:web` | PASS; Vite reported a chunk-size warning and stale Browserslist data. |
| `pnpm typecheck:api` | FAIL: `src/server/app.ts:104` imports `../modules/media/interfaces/http/register-media-routes`, absent from the tracked baseline tree. The import and registration exist since initial commit `db71a9f`; `git log --all -- apps/api/src/modules/media` found no tracked version. `git check-ignore -v` identifies the broad `.gitignore` rule `media/` as a reason the source path is ignored. |
| `docker version --format '{{.Server.Version}}'` | BLOCKED: Docker Desktop Linux engine was not running, so migration and infrastructure-backed tests were not run. |

The local configuration check was:

```powershell
node -e "const fs=require('fs');const p=require('./package.json');for(const f of ['.github/workflows/ci.yml','.github/workflows/codeql.yml']){const s=fs.readFileSync(f,'utf8');const n=[...s.matchAll(/uses: pnpm\/action-setup@v4\s*\n\s*with:\s*\n\s*version:/g)].length;console.log(f+': '+n+' duplicate declarations; packageManager='+p.packageManager);if(n)process.exitCode=1}"
```

## Remaining work

- Recover the missing media route from an authoritative source, or implement its contract with security tests. Archived specifications describe a device upload protected by HMAC and idempotency, but do not establish the omitted code. A stub would conceal the missing functionality; do not hide the import or weaken the typecheck. Review the broad `media/` ignore rule when restoring source, while retaining protection for actual uploaded media.
- Run the full quality, migration and CodeQL workflows at the resulting commit after an authorized push. A local install or frontend build is not hosted CI evidence.
- Assess the CodeQL v4 upgrade separately against the current GitHub Actions requirements.
- The existing dependency audit step uses `continue-on-error: true` and uploads a report; it does not enforce an audit failure. Treat that as an existing security-gate gap, not a passing security audit.
- Validate migration, Redis and MySQL integration on isolated infrastructure; no running service or production data was used in this audit.
