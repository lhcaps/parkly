# Parkly Web v3.4

Web frontend for the Parkly demo, built with **React 18 + Vite + TypeScript + Tailwind CSS + shadcn-ui style components**.

## What changed in this patch

- fixed API base handling to avoid `.../api/api/...`
- added **Vite proxy** for `/api` and `/uploads`
- upgraded `src/lib/api.ts` with better HTTP / JSON error handling
- added **Vietnam plate parser + validator**:
  - `src/lib/plate-rules.ts`
  - `src/lib/plate-parser.ts`
- upgraded **Gate Simulator**:
  - live plate hint analysis
  - strict/review/invalid badge
  - family classification: `DOMESTIC / DIPLOMATIC / FOREIGN / SPECIAL / UNKNOWN`
  - OCR substitution tracking
  - last run result card
  - reset action
- upgraded **Settings**:
  - resolved API base preview
  - `/api/health` runtime check

## Setup

```bash
cd web
pnpm install
pnpm dev
```

## Environment

Use one of these:

```env
VITE_API_BASE_URL=
```

or

```env
VITE_API_BASE_URL=http://127.0.0.1:3000
```

Do **not** use:

```env
VITE_API_BASE_URL=http://127.0.0.1:3000/api
```

## Plate validation notes

This patch intentionally uses a **tiered validation** strategy instead of one regex:

- `STRICT_VALID`
- `REVIEW`
- `INVALID`

It accepts OCR-tolerant input, normalizes it, then classifies the result into one of the supported families.

Current families:

- `DOMESTIC`
- `DIPLOMATIC`
- `FOREIGN`
- `SPECIAL`
- `UNKNOWN`

If you later want province codes / family rules to be fully data-driven, move `plate-rules.ts` into backend/shared config or a master-data API.
