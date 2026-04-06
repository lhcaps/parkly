---
name: i18n-safe-edit-scripts
description: >-
  Use scripts/i18n-safe-edit.py for Parkly locale JSON — validate, parity (en/vi),
  schema-validate required keys, add-section. Never StrReplace nested i18n JSON.
---

# i18n safe edit (scripts)

Canonical tool: `scripts/i18n-safe-edit.py` (repo root).

## Commands

- `validate <file>` — parse JSON, line/column on error
- `parity <en.json> <vi.json>` — structural shape must match
- `schema-validate <locale.json> <i18n.locale.schema.json>` — required top-level keys
- `add-section` / `check` — see script `--help`

## Quality gate

`scripts/run-quality-gate.mjs` runs validate, parity, schema-validate for both locales.

## Agent rule

Do not use Cursor `StrReplace` on `apps/web/src/i18n/locales/*.json`. Use the Python CLI only.

Full narrative: `.cursor/skills/i18n-safe-edit/SKILL.md`.
