# PARKLY — Development Roadmap to 10/10

**Mục tiêu:** Đưa 4 tiêu chí lên 10/10
**Baseline:** Architecture 8.0 → Documentation 9.0 → Backend 7.0 → Frontend 5.5
**Timeline ước tính:** 8-12 tuần (1 developer full-time)

---

## Phase 1: Frontend Implementation 5.5 → 10 (Tuần 1-4)

> Frontend là điểm yếu lớn nhất, cần fix trước vì nó ảnh hưởng demo/impression.

### 1.1 — Kill God Components (Tuần 1)

**Vấn đề:** OverviewPage (30KB), ReviewQueuePage (34KB), MobileCapturePage (46KB)

**Hành động:**
- [ ] Decompose mỗi page > 10KB thành sub-components:
  - `OverviewPage` → `OccupancyCard`, `IncidentOverview`, `RevenueChart`, `SessionTimeline`
  - `ReviewQueuePage` → `ReviewTable`, `ReviewDetailPanel`, `ReviewActions`, `ReviewFilters`
  - `MobileCapturePage` → `CameraViewfinder`, `PlateConfirmation`, `CaptureHistory`, `ConnectionStatus`
- [ ] Mỗi component < 200 dòng, single responsibility
- [ ] Extract shared patterns: `DataTable`, `StatusBadge`, `MetricCard`, `TimelineItem`

### 1.2 — Design System Thật Sự (Tuần 1-2)

**Vấn đề:** Styling rời rạc, không có design tokens nhất quán

**Hành động:**
- [ ] Tạo `packages/ui/` — shared component library (hoặc dùng shadcn đúng cách):
  - Color tokens: `--parkly-surface-1/2/3`, `--parkly-accent`, `--parkly-success/warn/danger`
  - Spacing scale: 4px base (4, 8, 12, 16, 24, 32, 48, 64)
  - Typography scale: `text-xs` → `text-4xl` với line-height chuẩn
- [ ] Xóa toàn bộ hardcoded hex colors (`#151518`, `#1a1b1e`) → dùng CSS variables
- [ ] Tạo Storybook cho tất cả base components (Button, Badge, Card, Dialog, Drawer, Table)

### 1.3 — Fix Topology Visualizer (Tuần 2)

**Vấn đề:** Hardcoded positions, `prompt()`/`alert()`, không reactive

**Hành động:**
- [ ] Thêm `dagre` hoặc `elkjs` auto-layout — nodes tự sắp xếp theo hierarchy
- [ ] Xóa `window.dispatchEvent(CustomEvent)` → thay bằng callback props hoặc Zustand actions
- [ ] Xóa `prompt()`/`alert()` → dùng proper Dialog components
- [ ] Fix `useNodesState(initialNodes)` → dùng `useMemo` + manual sync khi `gates` data thay đổi:
```tsx
useEffect(() => {
  const { nodes, edges } = buildGraphFromGates(gates)
  setNodes(nodes)
  setEdges(edges)
}, [gates])
```
- [ ] Thêm minimap, zoom controls, node search
- [ ] Node positions persistent qua `localStorage` hoặc API

### 1.4 — Responsive & Mobile (Tuần 2-3)

**Hành động:**
- [ ] Tất cả pages responsive từ 375px → 1920px
- [ ] Sidebar collapse trên mobile → hamburger menu
- [ ] Tables → card view trên mobile (< 768px)
- [ ] Touch-friendly: tap targets ≥ 44px
- [ ] MobileCapturePage phải hoàn hảo trên mobile (đây là use case chính)

### 1.5 — State Management Refactor (Tuần 3)

**Hành động:**
- [ ] Audit tất cả Zustand stores — merge overlapping stores
- [ ] React Query — chuẩn hóa:
  - `staleTime` / `gcTime` nhất quán theo entity type
  - Optimistic updates cho tất cả mutations (ngay lập tức update UI, rollback nếu fail)
  - Error boundaries per-page (không crash toàn app)
- [ ] SSE reconnection: exponential backoff + visual indicator khi disconnected

### 1.6 — Animations & Micro-interactions (Tuần 3-4)

**Hành động:**
- [ ] Page transitions: fade-in/slide khi navigate
- [ ] List item animations: stagger enter, smooth reorder
- [ ] Skeleton loading cho mọi data-dependent component (không dùng spinner)
- [ ] Toast notifications hệ thống (success/error/warning) thay vì `alert()`
- [ ] Topology graph: animated edge flow, node pulse khi status change
- [ ] Dashboard cards: count-up animation cho numbers, live spark charts

### 1.7 — Premium Visual Polish (Tuần 4)

**Hành động:**
- [ ] Dashboard → reference: Linear, Vercel dashboard, Raycast
- [ ] Dark mode mặc định, light mode optional
- [ ] Gradient accents, glassmorphism cho cards
- [ ] Data visualization: Recharts/Nivo cho dashboard charts (occupancy timeline, revenue bar, incident heatmap)
- [ ] Empty states: illustrated SVG + call-to-action (không chỉ "No data")
- [ ] Loading states: shimmer skeleton matching actual layout
- [ ] 404 / Error pages styled

---

## Phase 2: Backend Implementation 7.0 → 10 (Tuần 4-7)

### 2.1 — Testing Infrastructure (Tuần 4-5) ⚠️ CRITICAL

**Vấn đề:** Gần như 0% test coverage

**Hành động:**
- [ ] Setup Vitest + testing infrastructure:
  - `vitest.config.ts` với path aliases
  - Test database (separate MySQL instance hoặc SQLite in-memory)
  - Factory functions cho test data (`createTestUser()`, `createTestSession()`, `createTestLane()`)
- [ ] Unit tests cho business logic (target: 40+ tests):
  - Decision Engine: 15+ test cases (happy path, edge cases, anti-passback, subscription)
  - Plate canonicalization: 10+ plates (1 dòng, 2 dòng, quân đội, ngoại giao, invalid)
  - Tariff calculation: 10+ scenarios (free minutes, hourly, daily cap, overnight, holiday)
  - Payment status resolver: 6 status paths
- [ ] Integration tests cho critical flows (target: 20+ tests):
  - Entry flow end-to-end: ALPR capture → session → decision → barrier
  - Exit flow: presence check → payment → barrier
  - Subscription entry/exit bypass
  - Idempotency replay
  - Lane lock concurrency (2 parallel requests)
- [ ] API route tests (target: 30+ tests):
  - Auth: login, refresh, logout, revoke, role checks
  - Topology admin: CRUD sites, devices, lanes
  - Incidents: create, resolve, SSE events
  - Webhooks: create, deliver, test fire

### 2.2 — Dependency Injection (Tuần 5-6)

**Vấn đề:** Functions imported directly → impossible to mock, tight coupling

**Hành động:**
- [ ] Introduce lightweight DI container (tsyringe hoặc manual factory pattern):
```typescript
// Before: tightly coupled
import { createLane } from '../application/topology-admin.service'

// After: injectable
class TopologyAdminController {
  constructor(private readonly service: TopologyAdminService) {}
}
```
- [ ] Tất cả services injectable → testable with mocks
- [ ] Database access qua repository pattern (thin wrapper over Prisma):
  - `LaneRepository`, `SessionRepository`, `PresenceRepository`
  - Dễ swap implementation cho testing

### 2.3 — Type Safety Hardening (Tuần 6)

**Hành động:**
- [ ] Xóa tất cả `as any` casts (đặc biệt `(req as any).id`)
- [ ] Extend Express Request type properly:
```typescript
declare global {
  namespace Express {
    interface Request { id: string; actor: ActorContext }
  }
}
```
- [ ] `Record<string, unknown>` → proper typed DTOs cho tất cả API payloads
- [ ] Strict `tsconfig.json`: `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`
- [ ] Shared types giữa frontend/backend qua `packages/contracts/`

### 2.4 — Error Handling Strategy (Tuần 6)

**Hành động:**
- [ ] Tạo error hierarchy:
```typescript
abstract class ParklyError extends Error { code: string; statusCode: number }
class NotFoundError extends ParklyError { statusCode = 404 }
class ConflictError extends ParklyError { statusCode = 409 }
class BusinessRuleError extends ParklyError { statusCode = 422 }
```
- [ ] Global error handler middleware — không repeat try/catch trong mỗi route
- [ ] Structured error logging với correlation ID
- [ ] Error codes catalog trong spec

### 2.5 — Missing Migration Files (Tuần 7)

**Vấn đề:** Spec nói V31, V32 nhưng file không tồn tại

**Hành động:**
- [ ] Tạo `V31__webhook_bulk_import.sql` — tables cho webhooks, bulk_import_jobs, media_upload_audit
- [ ] Tạo `V32__security_hardening.sql` — gate_incident_history, site scope changes
- [ ] Verify mỗi migration chạy được idempotent
- [ ] Thêm migration test: up → seed → down → up

### 2.6 — Webhook & Bulk Import Verification (Tuần 7)

**Hành động:**
- [ ] End-to-end test: create webhook → trigger event → verify delivery
- [ ] End-to-end test: upload CSV → poll job status → verify subscriptions created
- [ ] Webhook retry logic với exponential backoff
- [ ] Bulk import: progress streaming qua SSE (thay vì polling)

---

## Phase 3: Architecture & Design 8.0 → 10 (Tuần 7-9)

### 3.1 — Observability Stack (Tuần 7-8)

**Hành động:**
- [ ] Structured logging: JSON format, correlation ID propagation end-to-end
- [ ] Prometheus metrics thêm:
  - `parkly_tariff_calculation_duration_ms` — histogram
  - `parkly_decision_engine_outcomes_total` — counter by decision_code
  - `parkly_active_sse_connections` — gauge
  - `parkly_lane_lock_wait_time_ms` — histogram
- [ ] Grafana dashboard templates (3 dashboards):
  - Operations: sessions/min, decision distribution, barrier response time
  - Infrastructure: DB connections, Redis memory, queue backlog
  - Business: occupancy %, revenue/hour, subscription utilization
- [ ] Health check mở rộng: deep health (query DB, ping Redis, check MinIO)
- [ ] Alert rules: queue backlog > 100, device offline > 5min, error rate > 5%

### 3.2 — API Versioning Strategy (Tuần 8)

**Hành động:**
- [ ] URL prefix versioning: `/api/v1/` (current routes → v1)
- [ ] Breaking change policy documented
- [ ] Deprecation headers cho legacy endpoints (`/api/me`)
- [ ] OpenAPI spec generated from Zod schemas (zod-to-openapi)

### 3.3 — Event-Driven Architecture Enhancement (Tuần 8-9)

**Hành động:**
- [ ] Domain events bus (in-process):
  - `SessionOpened`, `SessionResolved`, `DecisionMade`, `BarrierOpened`
  - Decouple `gate.service` → `incident.service` → `webhook.service`
- [ ] Event schema registry (Zod schemas for all event types)
- [ ] Event sourcing khả thi cho gate_passage_sessions (immutable event log)

### 3.4 — Multi-tenancy Hardening (Tuần 9)

**Hành động:**
- [ ] Row-level security audit: mọi query PHẢI có `WHERE site_id = ?`
- [ ] Middleware auto-inject `siteId` từ JWT scope
- [ ] Cross-site query protection: automated test verify không có cross-site data leak
- [ ] Tenant-aware caching (Redis key prefix: `site:{siteCode}:`)

---

## Phase 4: Documentation 9.0 → 10 (Tuần 9-10)

### 4.1 — API Documentation (Tuần 9)

**Hành động:**
- [ ] OpenAPI 3.1 spec generated from code (không viết tay):
  - `zod-to-openapi` → auto-generate từ route schemas
  - Swagger UI tự động cập nhật
- [ ] Request/Response examples cho MỌI endpoint (hiện tại spec chỉ có 1 số)
- [ ] Error response examples theo error code
- [ ] Postman/Insomnia collection export

### 4.2 — Developer Onboarding (Tuần 9)

**Hành động:**
- [ ] `CONTRIBUTING.md` — setup guide under 15 minutes:
  - Prerequisites check script
  - `docker-compose up` → `pnpm db:migrate` → `pnpm db:seed:min` → `pnpm dev`
  - Verify script: `pnpm verify:setup`
- [ ] Architecture Decision Records (ADRs):
  - ADR-001: Why outbox pattern over direct webhooks
  - ADR-002: Why Redis distributed lock over DB pessimistic locking
  - ADR-003: Why gates are derived, not stored
  - ADR-004: Why BIGINT over UUID for PKs
- [ ] Module dependency diagram (Mermaid)

### 4.3 — Runbook (Tuần 10)

**Hành động:**
- [ ] Operations runbook:
  - "Queue backlog growing" → check worker, drain manually, investigate DLQ
  - "Device offline" → check network, verify heartbeat, escalation path
  - "Ghost presence blocking entry" → manual purge, root cause analysis
  - "High review queue" → staffing, auto-approve thresholds
- [ ] Disaster recovery procedures
- [ ] Database backup & restore tested procedure

---

## Phase 5: Bonus — Production Readiness (Tuần 10-12)

### 5.1 — CI/CD Pipeline
- [ ] GitHub Actions: lint → typecheck → unit tests → integration tests → build
- [ ] Preview deployments per PR
- [ ] Automated migration verification

### 5.2 — Performance
- [ ] Database query analysis: `EXPLAIN ANALYZE` top 20 queries
- [ ] Add missing indexes (gate_read_events by session_id+occurred_at)
- [ ] API response time SLA: p99 < 200ms for read, < 500ms for write
- [ ] Frontend bundle analysis: code splitting, lazy loading cho heavy pages

### 5.3 — Security Audit
- [ ] OWASP Top 10 checklist
- [ ] SQL injection test (Prisma handles, but verify raw queries)
- [ ] Rate limiting trên tất cả mutation endpoints
- [ ] CSP headers, HSTS
- [ ] Dependency audit: `pnpm audit`

---

## Priority Matrix

| Effort | Impact Cao | Impact Trung Bình |
|--------|-----------|-------------------|
| **Thấp (< 1 tuần)** | Fix Topology bugs (1.3), Kill `prompt()`/`alert()`, Xóa `as any` | Empty states, Loading skeletons |
| **Trung bình (1-2 tuần)** | Testing infrastructure (2.1), Design system (1.2), Error handling (2.4) | Responsive (1.4), API docs (4.1) |
| **Cao (2-4 tuần)** | God component decomposition (1.1), DI refactor (2.2), Observability (3.1) | Event-driven (3.3), CI/CD (5.1) |

---

## Thứ tự thực hiện đề xuất

```
Tuần 1-2:  [Frontend] Design system + Kill god components + Fix topology
Tuần 3-4:  [Frontend] Responsive + Animations + Visual polish
Tuần 4-5:  [Backend]  Testing infrastructure + 70 test cases
Tuần 5-6:  [Backend]  DI refactor + Type safety + Error handling
Tuần 7:    [Backend]  Missing migrations + Webhook/Bulk import verification
Tuần 7-8:  [Arch]     Observability + API versioning
Tuần 8-9:  [Arch]     Event-driven + Multi-tenancy
Tuần 9-10: [Docs]     OpenAPI auto-gen + Developer onboarding + Runbook
Tuần 10-12:[Bonus]    CI/CD + Performance + Security audit
```

**Sau 12 tuần, expected scores:**
- Architecture & Design: **9.5** (10 nếu có event sourcing)
- Documentation: **10**
- Backend Implementation: **9.5** (10 nếu > 80% coverage)
- Frontend Implementation: **9.0** (10 nếu có Storybook + full responsive + animations)

---

*Roadmap generated: 2026-03-25 | Parkly Development Roadmap v1.0*
