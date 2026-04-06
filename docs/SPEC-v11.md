# Parkly Technical Specification v11

Snapshot date: 2026-03-30
Snapshot type: full-project enterprise documentation baseline
Supersedes: `SPEC-v10`

## 1. Document Purpose

This document is the canonical top-level snapshot for the Parkly repository as it exists on March 30, 2026. It captures the current shipped architecture, security posture, data model, deployment shape, observability, and quality gate.

This is a code-aligned snapshot, not a roadmap.

## 2. Product Summary

Parkly is a gate operations and parking management platform with the following major capabilities:

- operator authentication and session-controlled access
- gate session lifecycle management for entry and exit flows
- review queue and manual intervention workflows
- dashboard and monitoring read models
- topology administration for sites, devices, and lanes
- subscription administration
- parking-live occupancy views
- incident handling and audit history
- webhook integrations, media handling, and bulk import

## 3. Repository Topology

The repository is a `pnpm` monorepo.

- `apps/api` hosts the Express API, worker jobs, migrations, Prisma schema, and operational scripts.
- `apps/web` hosts the React and Vite operations console.
- `packages/contracts` provides shared Zod contracts and transport types.
- `packages/gate-core` provides shared gate logic and plate canonicalization helpers.
- `packages/edge-node` provides an optional edge-node package for local survivability work.
- `infra/docker` contains Docker Compose files for local platform services.
- `infra/observability` contains Prometheus, Alertmanager, and Grafana configuration.

## 4. Runtime Architecture

### 4.1 Backend

The backend is an Express application with route modules organized by bounded context.

Implemented bounded contexts include:

- auth
- gate
- dashboard
- topology
- subscriptions
- parking-live
- incidents
- audit
- media
- bulk-import
- webhooks
- reconciliation
- presence

### 4.2 Frontend

The web console is a React SPA built with Vite. It uses the canonical route policy and role model defined in the codebase.

Core operator routes include:

- `/overview`
- `/run-lane`
- `/review-queue`
- `/session-history`
- `/lane-monitor`
- `/device-health`
- `/sync-outbox`
- `/reports`
- `/mobile-camera-pair`
- `/capture-debug`
- `/subscriptions`
- `/parking-live`
- `/settings`
- `/topology`

### 4.3 Shared contracts

Transport and role definitions are centralized in `packages/contracts`. Backend and frontend both depend on those definitions so that role normalization, enums, payloads, and read-model shapes stay aligned.

## 5. Deployment Profiles

Parkly has three primary deployment profiles.

### 5.1 local-dev

- intended for developer feedback loops
- uses local media storage
- composes MySQL and Redis

### 5.2 demo

- intended for repeatable demos and smoke-style validation
- uses local media storage
- composes MySQL and Redis

### 5.3 release-candidate

- intended for production-like local validation
- uses MinIO-backed media storage
- composes MySQL, Redis, MinIO, and MinIO initialization

Deployment verification is executable and profile-aware. The quality gate can reuse existing healthy dependencies instead of restarting them unnecessarily.

## 6. Security Model

### 6.1 User auth

User-facing auth is session based and exposed through dedicated auth routes:

- password policy
- login
- refresh
- logout
- revoke-all
- admin revoke-all
- admin disable or enable user
- current principal lookup

Security controls include:

- progressive login delay
- short lockout after repeated failures
- session limits per user
- cleanup for expired and revoked sessions

### 6.2 Device and internal auth

Parkly separates user auth from device and internal service auth.

- device-signed surfaces validate request signatures and timestamps
- internal service surfaces use rotating tokens
- secret hygiene and secret rotation are checked by dedicated scripts and tests

### 6.3 RBAC

Canonical user roles are:

- `SUPER_ADMIN`
- `SITE_ADMIN`
- `MANAGER`
- `OPERATOR`
- `GUARD`
- `CASHIER`
- `VIEWER`

Compatibility handling for legacy `ADMIN`, `OPS`, and `WORKER` still exists in the backend, but the enterprise model is the canonical role set above.

### 6.4 Hardening

Repository-level security controls now include:

- strict request validation
- standardized error envelopes
- secret hygiene checks
- secret rotation checks
- dependency review in CI
- dependency audit artifact capture
- CodeQL analysis workflow

## 7. Data Platform

### 7.1 Primary stores

- MySQL 8.4 for transactional and administrative data
- Redis 7.4 for coordination, caches, and selected operational state
- MinIO for production-like local media validation in the release-candidate profile

### 7.2 Migration model

- Flyway SQL migrations are the source of truth for schema evolution
- Prisma is used for client generation and typed access, not for migration authority
- The current migration set runs from `V1__init_schema.sql` through `V33__quality_gate_cleanup.sql`

### 7.3 Schema areas

The relational schema covers:

- identity and user session management
- parking sites, devices, lanes, and lane-device mapping
- gate passage sessions, reads, decisions, reviews, incidents, and barrier commands
- subscriptions, vehicles, credentials, spots, and occupancy projections
- bulk import, webhook delivery, media audit, API keys, and rate-limit ledger
- audit logs and operational retention support

### 7.4 Key schema decisions

- internal relational keys use `BIGINT`
- gate events are partition-aware and migration-managed
- gates are derived from lane metadata rather than stored as a separate first-class table
- delivery and integration work is staged through outbox-style persistence

## 8. API and Realtime Surfaces

### 8.1 API basics

- API prefix: `/api`
- interactive docs: `/docs`
- OpenAPI JSON: `/openapi.json`
- Prometheus metrics: `/metrics`

### 8.2 Major REST groups

Implemented API groups include:

- auth
- health and readiness
- topology read
- gate session and review operations
- ALPR preview and recognize
- dashboard and monitoring summaries
- incidents
- audit
- reconciliation and parking-live
- subscriptions and topology admin
- media
- bulk import
- webhooks

### 8.3 SSE groups

Realtime streams include:

- gate events
- lane status
- device health
- outbox
- incidents
- parking-live

REST remains the canonical state source. SSE provides deltas only.

### 8.4 Idempotency

Retry-sensitive write paths are protected with explicit idempotency keys. The backend records request hashes and can safely return prior successful responses where supported.

## 9. Web Application Behavior

The web console is role-aware and route-aware.

Role home preferences currently resolve as follows:

- `SUPER_ADMIN` -> `/overview`, `/reports`, `/sync-outbox`
- `SITE_ADMIN` -> `/overview`, `/reports`, `/subscriptions`
- `MANAGER` -> `/overview`, `/run-lane`, `/reports`
- `OPERATOR` -> `/run-lane`, `/review-queue`, `/lane-monitor`
- `GUARD` -> `/run-lane`, `/review-queue`, `/lane-monitor`
- `CASHIER` -> `/reports`, `/overview`, `/settings`
- `VIEWER` -> `/overview`, `/lane-monitor`, `/session-history`

The web app hydrates state from REST endpoints and layers realtime updates through SSE.

## 10. Observability and Alerting

### 10.1 Metrics

The API exports Prometheus metrics for:

- HTTP latency
- gate session open and resolve latency
- barrier command timeout counts
- review queue size
- device offline count
- outbox backlog size
- Redis availability and latency
- ALPR preview cache behavior
- low-cardinality operational request totals and latencies
- incident lifecycle counters
- retention cleanup metrics
- secret rejection, replay suspicion, and rotation events
- tariff calculation and decision-engine outcomes
- active SSE connections
- lane lock wait time

### 10.2 Observability stack

Local observability can be brought up through the Compose observability profile:

- Prometheus
- Alertmanager
- Grafana

### 10.3 Alert rules

Alert rules currently cover at least:

- Redis down
- outbox backlog high
- device offline
- review queue growth
- operational error rate above threshold

## 11. Quality Engineering and Automated Testing

### 11.1 Root quality gate

The repository-level quality gate is:

```bash
pnpm test:full
```

As of this snapshot it performs:

1. deployment bootstrap for the target quality profile
2. Prisma generate
3. API typecheck
4. web typecheck
5. API tests
6. web unit tests and build
7. Playwright E2E against the built SPA artifact

### 11.2 Current test inventory snapshot

At the time of this snapshot the repository contains:

- 49 API test files under `apps/api/src/tests`
- 4 web unit test files under `apps/web/src`
- 5 Playwright E2E specs under `apps/web/tests/e2e`

### 11.3 CI workflows

CI coverage is split across:

- quality gate workflow
- migration validation workflow
- security workflow
- CodeQL workflow

The quality workflow uploads:

- API coverage
- web coverage
- Playwright reports
- Playwright raw results
- built web distribution assets

### 11.4 Release-grade frontend testing

The web E2E path is intentionally production-like:

- Playwright serves the built `dist` output
- tests do not depend on a dev server for release sign-off
- E2E configuration avoids accidental drift from local `.env` API base overrides

## 12. Operations and Recovery

Parkly includes executable operational scripts for:

- deployment bootstrap
- deployment reset
- deployment smoke
- deployment verify
- backup create
- restore apply
- restore verify
- disaster drill
- retention cleanup
- secret hygiene and rotation checks

The repository therefore supports code-level validation of deployment and recovery flows, not just application logic.

## 13. Release Evidence Standard

A release snapshot is considered code-level ready only when:

- `pnpm test:full` passes
- deployment verification passes for the intended profile
- CI jobs for quality, migrations, security, and CodeQL are green or explained
- required artifacts exist for coverage, Playwright, and build outputs
- health, readiness, and metrics summary are in the expected state

## 14. Remaining External Validation Gaps

The codebase can prove a large part of release readiness, but two important areas still require external execution:

- an independent pentest
- real alert delivery and on-call validation in a non-local environment

These are outside the repository-only proof boundary and must not be claimed as completed unless separately run.
