# Observed failures and current status

## Duplicate pnpm version configuration

GitHub [CodeQL run 28773264742](https://github.com/lhcaps/parkly/actions/runs/28773264742) and [quality run 25388948741](https://github.com/lhcaps/parkly/actions/runs/25388948741) at `595934ac90a6108898a0e70027c6250ae583535e` failed during pnpm setup. Retained annotations identify action input `10` plus `packageManager: pnpm@10.0.0` as the conflict. Commit `b1f2ba9818fb3cca7fd543128bee4d92f9257da2` removes duplicate action inputs. Local workflow checks and frozen install passed; a matching hosted run is still required. The full historical logs returned HTTP 410. See [CI audit](CI_AUDIT.md).

## Missing media source module

On Windows at baseline and commit `b1f2ba9818fb3cca7fd543128bee4d92f9257da2`, `pnpm typecheck:api` failed with TS2307 for `register-media-routes`. The tracked tree and available Git history do not contain the module; `.gitignore` has an unanchored `media/` rule that matches its intended path. No safe reconstruction was made: the archived device-upload specification indicates security requirements, but the original implementation is unavailable. Recover or implement the route with security tests and rerun the complete gate before treating the demo as runnable.
