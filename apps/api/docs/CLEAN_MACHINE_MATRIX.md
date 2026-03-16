# Clean machine verification matrix — backend RC1

| Stage | What must be proven | Canonical command |
|---|---|---|
| bootstrap | dependency + env + DB surface đủ để dựng máy mới | `pnpm --dir apps/api bootstrap:demo` |
| migrate | schema lên đúng version | `pnpm --dir apps/api db:migrate` |
| grant | runtime user có quyền đúng | `pnpm --dir apps/api db:grant:app` |
| seed | fixture baseline không drift | `pnpm --dir apps/api release:reset` |
| login | auth thật chạy được | `pnpm --dir apps/api smoke:bundle` |
| dashboard | summary read-model không vỡ | `pnpm --dir apps/api smoke:bundle` |
| upload | media path local/RC hoạt động | `pnpm --dir apps/api smoke:bundle` |
| intake | internal presence ingest hoạt động | `pnpm --dir apps/api smoke:bundle` |
| refresh | reconcile refresh đi được | `pnpm --dir apps/api smoke:bundle` |
| resolve | incident resolve còn đúng | `pnpm --dir apps/api smoke:bundle` |
| audit | audit read ra evidence liên quan | `pnpm --dir apps/api smoke:bundle` |

Chuỗi chốt RC1:

```bash
pnpm --dir apps/api rc1:fixtures:check
pnpm --dir apps/api rc1:smoke:repeat -- --runs 3 --profile demo
pnpm --dir apps/api rc1:gate -- --profile demo --runs 3
```
