#!/usr/bin/env bash
# launch-backend.sh
set -euo pipefail

PROFILE="${1:-demo}"
ACTION="${2:-bootstrap}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
cd "${REPO_ROOT}"

case "${ACTION}" in
  compose-up)
    case "${PROFILE}" in
      release-candidate|rc) pnpm --dir apps/api compose:up:rc ;;
      local-dev|local) pnpm --dir apps/api compose:up:local ;;
      *) pnpm --dir apps/api compose:up:demo ;;
    esac
    ;;
  compose-down)
    pnpm --dir apps/api compose:down
    ;;
  verify)
    pnpm --dir apps/api verify:deployment -- --profile "${PROFILE}" --intent bootstrap
    ;;
  bootstrap)
    case "${PROFILE}" in
      release-candidate|rc) pnpm --dir apps/api bootstrap:rc ;;
      local-dev|local) pnpm --dir apps/api bootstrap:local ;;
      *) pnpm --dir apps/api bootstrap:demo ;;
    esac
    ;;
  reset)
    case "${PROFILE}" in
      release-candidate|rc) pnpm --dir apps/api reset:rc ;;
      local-dev|local) pnpm --dir apps/api reset:local ;;
      *) pnpm --dir apps/api reset:demo ;;
    esac
    ;;
  smoke)
    case "${PROFILE}" in
      release-candidate|rc) pnpm --dir apps/api smoke:rc ;;
      local-dev|local) pnpm --dir apps/api smoke:local ;;
      *) pnpm --dir apps/api smoke:demo ;;
    esac
    ;;
  dev)
    pnpm --dir apps/api verify:deployment -- --profile "${PROFILE}" --intent dev
    pnpm --dir apps/api dev
    ;;
  worker)
    pnpm --dir apps/api worker:dev
    ;;
  *)
    echo "Unsupported action: ${ACTION}" >&2
    exit 1
    ;;
esac
