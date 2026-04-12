# Contributing to Parkly

Keep contributions small, testable, and aligned with the scripts that already exist in the repo.

## Before you open a change

- Bootstrap with `HOW_TO_SETUP.md`.
- Read `docs/README.md` for canonical docs.
- Do not add generated output, release evidence, coverage, or local scratch files back into the tree.

## Workflow

1. Work in a focused branch.
2. Inspect existing code and docs before adding new ones.
3. Prefer extending current scripts and shared packages over one-off helpers.
4. Run the smallest verification set that proves your change.
5. Update docs only when behavior or operator workflow changed.

## Verification baseline

Backend changes:

```bash
pnpm --dir apps/api typecheck
pnpm --dir apps/api test:vitest
```

Frontend changes:

```bash
pnpm --dir apps/web build
pnpm --dir apps/web test:unit
```

Cross-cutting or release-sensitive changes:

```bash
pnpm test:full
```

## Commit style

Use conventional commits when possible:

```text
feat(gate): add anti-passback guard
fix(web): stop duplicating smoke alias artifacts
docs(runbook): align setup steps with current scripts
```

## Documentation rules

- `docs/` holds living project docs.
- `docs/archive/` holds superseded notes and historical exports.
- `apps/api/docs/` and `apps/web/docs/` hold service-specific runbooks and templates.
- If a file is just a patch checklist, scratch prompt, generated evidence, or a local debug note, it should not stay in the main repo surface.

## Code rules

- Keep TypeScript strict.
- Reuse shared contracts in `packages/contracts`.
- Keep route and role behavior aligned between API and web.
- Prefer deterministic scripts over manual steps.
