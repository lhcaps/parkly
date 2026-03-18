# Frontend runbook

## 1. Mục tiêu
Runbook này khóa cách bootstrap, kiểm tra, và bàn giao wave frontend hiện tại để người khác có thể lặp lại mà không phải hỏi miệng người viết.

Wave hiện tại chốt các bề mặt sau:
- auth shell + role-aware landing
- canonical routes trong shell
- subscriptions workspace
- parking live monitoring + stale fallback
- regression gate gồm build, unit, e2e, smoke, manual QA, evidence bundle

## 2. Điều kiện tiên quyết
- Node.js 20.x hoặc mới hơn
- pnpm 10.x
- Backend Parkly local-dev hoặc demo profile đã bootstrap được
- Trình duyệt desktop hiện đại
- Với E2E: Playwright browser đã được cài

Nếu backend chưa lên được, frontend vẫn có thể build và smoke route shell, nhưng login thật, snapshot subscriptions, và parking-live realtime sẽ không có dữ liệu sống.

## 3. Machine-clean bootstrap
### 3.1 Clone và cài dependency
Từ root repo:
```bash
pnpm install
```

### 3.2 Boot backend local tối thiểu
```bash
pnpm --dir apps/api bootstrap:local
```

### 3.3 Chạy API và worker
Mở 2 terminal riêng:
```bash
pnpm --dir apps/api dev
```

```bash
pnpm --dir apps/api worker:dev
```

Kiểm tra nhanh ở terminal khác:
```bash
curl.exe -i http://127.0.0.1:3000/api/health
```

### 3.4 Cấu hình env cho web
Copy env example:
```bash
cp apps/web/.env.example apps/web/.env
```

Mặc định local dev có thể để `VITE_API_BASE_URL=` rỗng để dùng Vite proxy `/api -> http://127.0.0.1:3000`.

Chỉ set `VITE_API_BASE_URL` khi:
- web không chạy bằng Vite dev server
- API ở origin khác
- cần test production-like serve path

### 3.5 Chạy web
Từ `apps/web`:
```bash
pnpm dev --host 0.0.0.0
```

Hoặc từ root repo:
```bash
pnpm --dir apps/web dev --host 0.0.0.0
```

Đợi đến khi Vite in ra `Local: http://localhost:5173/` rồi mới chạy smoke.

## 4. Auth bootstrap và role-aware landing
### 4.1 Mental model chuẩn
- user nhập account/password
- backend trả session/token
- frontend bootstrap principal authoritative qua `/api/auth/me`
- route sau login được resolve theo thứ tự:
  1. deep link `from` nếu role hiện tại được phép
  2. canonical landing của role
  3. first allowed canonical route nếu role-home không khả dụng

### 4.2 Role landing contract
- `ADMIN` -> `/overview`
- `OPS` -> `/overview`
- `GUARD` -> `/run-lane`
- `CASHIER` -> `/reports`
- `WORKER` -> `/lane-monitor`

### 4.3 Local demo credential
Nếu backend đang dùng seed/smoke fixture mặc định, account local thường là:
- username: `ops`
- password: `Parkly@123`

Nếu fixture backend của bạn đã đổi, ưu tiên credential từ backend runbook. Không được sửa UI để bù credential drift.

### 4.4 Compatibility mode
Login form có thể vẫn giữ advanced compatibility options cho role override demo. Nó chỉ phục vụ backend demo cũ. Không được coi phần này là nguồn sự thật chính về role.

## 5. Canonical routes của wave này
Các route canonical đang được ship trong shell:
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

Hai màn mới cần QA sâu trong wave này:
- `Subscriptions`: kiểm deep-link, selection recovery, detail error, read-only vs mutate
- `Parking Live`: kiểm scanability, stale fallback, reconcile, board retention

## 6. Commands phải chạy trước khi handoff
Từ `apps/web`:

### 6.1 Build
```bash
pnpm build
```

### 6.2 Unit tests
```bash
pnpm test:unit
```

### 6.3 E2E
Lần đầu hoặc sau khi nâng Playwright:
```bash
pnpm exec playwright install chromium
```

Sau đó:
```bash
pnpm test:e2e
```

### 6.4 Smoke
Smoke against Vite dev server đang chạy:
```bash
SMOKE_WEB_PORT=5173 pnpm smoke:web
```

Trên PowerShell:
```powershell
$env:SMOKE_WEB_PORT="5173"
pnpm smoke:web
```

Nếu muốn kiểm thêm API health:
```powershell
$env:SMOKE_WEB_PORT="5173"
$env:SMOKE_API_URL="http://127.0.0.1:3000/api"
pnpm smoke:web
```

Smoke production-like serve path:
```bash
pnpm build
pnpm smoke:web:dist -- --apiUrl http://127.0.0.1:3000/api
```

### 6.5 Evidence bundle
Ví dụ gom log đã redirect từ terminal:
```bash
node ./scripts/collect-evidence.mjs \
  --buildLog ../../release-evidence/frontend-wave-09/build.log \
  --unitLog ../../release-evidence/frontend-wave-09/test-unit.log \
  --e2eLog ../../release-evidence/frontend-wave-09/test-e2e.log \
  --smokeLog ../../release-evidence/frontend-wave-09/smoke.log \
  --screensDir ../../release-evidence/frontend-wave-09/screenshots
```

## 7. Debug path cho Subscriptions
### 7.1 Deep-link mẫu
```text
/subscriptions?siteCode=SITE_HCM_01&id=sub_demo_01&tab=vehicles
```

### 7.2 Điều phải đúng
- refresh không làm mất selected subscription nếu `id` còn hợp lệ
- `tab` sai giá trị phải normalize về `overview`
- filter đổi làm `id` biến mất phải clear selection có chủ đích
- list error, empty list, detail error, empty selection là bốn state khác nhau
- role read-only vẫn đọc được detail, chỉ không thấy CTA mutate

### 7.3 Khi detail không hiện
- kiểm URL có `id` hợp lệ không
- kiểm list hiện tại còn row đó không
- kiểm network detail có 4xx/5xx không
- nếu 5xx, detail pane phải hiện requestId/hint chứ không collapse pane trái

## 8. Debug path cho Parking Live
### 8.1 Deep-link mẫu
```text
/parking-live?siteCode=SITE_HCM_01&floor=F1&density=compact
```

### 8.2 Điều phải đúng
- board snapshot là authoritative source
- SSE chỉ advisory delta
- stream fail không làm board trắng nếu đã có snapshot cuối
- stale banner phải hiện rõ fallback state
- reconcile/refresh phải đổi freshness timestamp
- floor/zone summary phải chỉ ra nơi đáng chú ý trước khi click tile

### 8.3 Khi stale fallback không hiện
- kiểm SSE stream có degrade nhưng reconnect loop đã ghi đè UI state hay chưa
- kiểm connection banner đang hiển thị `retrying` hay `stale`
- kiểm snapshot cuối có còn trong hook state không
- lưu requestId nếu refresh snapshot lỗi

## 9. Merge gate cuối wave
Không merge nếu còn thiếu một trong các bước sau:
1. `pnpm build`
2. `pnpm test:unit`
3. `pnpm test:e2e`
4. `SMOKE_WEB_PORT=5173 pnpm smoke:web`
5. Manual QA sign-off hoàn tất
6. Docs sync: `runbook.md`, `routes.md`, `acceptance-checklist.md`, `role-matrix.md`
7. Evidence bundle đã sinh và có screenshot checklist tối thiểu

## 10. Manual QA tối thiểu phải ký
- login landing đúng theo role
- forbidden direct URL đi qua `/forbidden` với fallback đúng
- subscriptions deep-link survive reload và giữ tab đúng
- subscriptions read-only không thấy mutate CTA
- parking-live stale fallback giữ snapshot cuối và banner đúng
- reconcile cập nhật freshness

## 11. Known constraints
- Auth hiện là login/password + backend role contract, chưa phải SSO/OAuth
- Smoke script là route sanity + health probe, không thay thế operator journey đầy đủ
- Screenshot evidence vẫn cần chụp thủ công
- Warning circular chunk của Vite chưa phải blocker runtime cho wave này

## 12. File bàn giao quan trọng
- `apps/web/docs/frontend/runbook.md`
- `apps/web/docs/frontend/routes.md`
- `apps/web/docs/frontend/acceptance-checklist.md`
- `apps/web/docs/frontend/evidence-template.md`
- `apps/web/docs/frontend/manual-qa-signoff.md`
- `apps/web/docs/frontend/role-matrix.md`
- `apps/web/scripts/smoke-web.mjs`
- `apps/web/scripts/collect-evidence.mjs`
