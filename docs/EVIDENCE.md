# Parkly Release Evidence

Evidence snapshot date: 2026-03-30
This document defines the minimum evidence required to treat a build as release-grade.

## 1. Mandatory Evidence

### Quality gate

- `pnpm test:full` completed successfully.
- API unit coverage artifact exists.
- Web unit coverage artifact exists.
- Playwright report and test results artifact exist.
- Built web `dist` artifact exists.

### CI workflows

- `ci.yml` quality job passed.
- `ci.yml` migration validation job passed.
- `ci.yml` security job completed without blocking findings.
- `codeql.yml` analysis completed successfully on the relevant branch or pull request context.

### Deployment readiness

- `verify:deployment` passed for the target profile.
- Required dependencies were reachable for the target profile.
- Secret hygiene and secret rotation checks passed for the intended release mode.

### Operational readiness

- `GET /api/health` and `GET /api/ready` reported the expected state.
- `GET /api/ops/metrics/summary` shows no unexplained error spike.
- Observability stack is reachable when the release expects monitoring coverage.

## 2. Artifact Expectations

Store at least the following:

- quality gate logs
- CI job URLs or exported logs
- coverage reports
- Playwright HTML report
- deployment verification output
- backup manifest for the release candidate snapshot
- any manual sign-off notes for environment-specific checks

## 3. Manual Checks That Still Matter

Automation is the baseline, not the whole story. The following still require human confirmation when applicable:

- staging or pilot deployment health in the real target environment
- alert delivery to real receivers, not only local Alertmanager
- operational dashboard readability and routing for the target tenant or site scope
- business-owner sign-off for subscription, parking-live, or topology changes with customer impact

## 4. Minimum Sign-off Statement

A release may be described as ready only if all of the following are true:

- the automated gate is green
- the target deployment profile verifies cleanly
- the artifact set is complete
- no unresolved critical incident or critical dependency warning remains

## 5. Known Non-code Gaps

Two activities remain outside what the repository can fully prove on its own:

- an independent pentest
- real notification routing and on-call validation in a non-local environment

These do not invalidate the code-level evidence, but they must not be represented as already completed if they have not been run.
