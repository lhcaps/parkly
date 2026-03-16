# Frontend runbook

## 1. Mục tiêu của runbook
Tài liệu này khóa phần bàn giao FE để người khác có thể dựng, chạy, smoke và demo lại web console mà không cần suy đoán theo máy người viết.

Phạm vi của runbook này:
- boot local web
- env setup
- machine-clean bootstrap
- smoke route tối thiểu
- demo walkthrough
- failure triage nhanh
- known constraints của phase hiện tại

## 2. Điều kiện tiên quyết
- Node.js 20.x hoặc mới hơn
- pnpm 10.x
- Backend Parkly đã có thể boot ở profile local hoặc demo
- Trình duyệt desktop hiện đại

Nếu backend chưa lên được thì FE vẫn có thể build và smoke route tĩnh, nhưng login, snapshot thật và realtime sẽ không có dữ liệu sống.

## 3. Machine-clean bootstrap
### 3.1 Clone và cài dependency
```bash
pnpm install
```

### 3.2 Boot backend local tối thiểu
Từ root repo:
```bash
pnpm --dir apps/api bootstrap:local
```

Lệnh này chuẩn bị hạ tầng local-dev theo script backend hiện có. Nếu bạn đã có MySQL/Redis và dữ liệu sẵn thì có thể bỏ qua, nhưng không nên đoán.

### 3.3 Chạy API và worker
Mở 2 terminal riêng:
```bash
pnpm --dir apps/api dev
```

```bash
pnpm --dir apps/api worker:dev
```

### 3.4 Cấu hình env cho web
Copy env example:
```bash
cp apps/web/.env.example apps/web/.env
```

Mặc định local dev có thể để `VITE_API_BASE_URL=` rỗng để đi qua Vite proxy `/api -> http://127.0.0.1:3000`.

Chỉ set `VITE_API_BASE_URL` khi:
- web chạy ngoài Vite dev server
- API ở origin khác
- muốn test production-like serve path

### 3.5 Chạy web
Từ root repo:
```bash
pnpm dev:web
```

Hoặc từ `apps/web`:
```bash
pnpm dev:web
```

## 4. Login mặc định để demo local
Nếu backend đang dùng seed/smoke fixture mặc định, account local thường dùng là:
- username: `ops`
- password: `Parkly@123`
- role: `AUTO` hoặc `OPS`

Nếu fixture backend của bạn đã đổi, ưu tiên dùng credential trong backend smoke/runbook nội bộ. Đừng hardcode giả định mới vào UI.

## 5. Build và smoke
### 5.1 Build sạch
```bash
pnpm build:web
```

### 5.2 Smoke against dev server đang chạy
Từ root repo:
```bash
pnpm smoke:web -- --baseUrl http://127.0.0.1:5173 --apiUrl http://127.0.0.1:3000
```

Từ `apps/web`:
```bash
pnpm smoke:web -- --baseUrl http://127.0.0.1:5173 --apiUrl http://127.0.0.1:3000
```

### 5.3 Smoke production-like serve path
Script này tự serve `dist/` theo kiểu SPA fallback rồi đi qua các deep link trọng yếu:
```bash
pnpm smoke:web:dist -- --apiUrl http://127.0.0.1:3000
```

Kết quả smoke mới nhất sẽ được ghi vào:
- `apps/web/docs/frontend/evidence/latest-smoke.json`

### 5.4 Tạo evidence scaffold
```bash
pnpm evidence:web
```

Script này tạo hoặc cập nhật:
- `docs/frontend/evidence/README.md`
- `docs/frontend/evidence/manual-qa-signoff.md`

## 6. Demo walkthrough tối thiểu
### Luồng A — Auth + shell
1. Mở `/login`
2. Đăng nhập bằng account local
3. Xác nhận topbar hiện role/site/session state
4. Refresh `/overview` để chắc route sâu không trắng màn

### Luồng B — Operations path
1. Mở `/run-lane?siteCode=SITE_HCM_01&laneCode=GATE_01_ENTRY`
2. Đảm bảo route mở được kể cả sau refresh
3. Mở `Review Queue`
4. Từ một case đang chọn, handoff sang `Session History` rồi sang `Audit Viewer`
5. Back/forward browser phải giữ được context chính

### Luồng C — Monitoring path
1. Mở `Sync Outbox`
2. Chuyển filter qua URL
3. Refresh route
4. Mở `Reports` với `?siteCode=SITE_HCM_01&days=7`
5. Kiểm tra empty/degraded/error state không làm vỡ shell

### Luồng D — Mobile path
1. Mở `Mobile Camera Pair`
2. Mở `Mobile Capture`
3. Nếu backend pair service chưa chạy hoặc token pair không hợp lệ, màn hình phải degrade rõ ràng thay vì trắng màn hình

## 7. Quick sanity checks
- `GET http://127.0.0.1:3000/health` trả 200
- `/login`, `/overview`, `/run-lane`, `/review-queue`, `/session-history`, `/audit-viewer`, `/sync-outbox`, `/reports`, `/mobile-camera-pair`, `/mobile-capture` mở được
- Deep link copy sang tab mới vẫn mở đúng context
- Refresh nested route không trắng màn hình
- Unauthorized/forbidden/degraded/state banner hiển thị nhất quán

## 8. Failure triage nhanh
### Build fail
- Chạy lại `pnpm install`
- Chạy `pnpm build:web`
- Nếu lỗi TypeScript, sửa compile trước rồi mới bàn đến Vite output

### Login fail
- Kiểm tra API có chạy không
- Kiểm tra `/health`
- Kiểm tra credential backend seed/smoke fixture
- Kiểm tra `VITE_API_BASE_URL` có đang trỏ sai origin không

### Stream stale hoặc unauthorized
- Kiểm tra access token hết hạn
- Kiểm tra worker/API đang chạy
- Kiểm tra browser console xem stream có reconnect loop hay 401 không

### Refresh route sâu bị lỗi
- Chạy `pnpm smoke:web:dist`
- Nếu route pass ở smoke nhưng fail sau login thật thì vấn đề nằm ở auth/bootstrap hoặc snapshot context, không phải serve path cơ bản

### API down
- FE phải vẫn render shell/error state
- Không được trắng app
- Banner hoặc page state phải chỉ rõ dependency down thay vì nhầm thành empty

## 9. Known constraints của phase hiện tại
- Auth phase này vẫn là login/password + role contract của backend, chưa phải SSO/OAuth
- Smoke script hiện là route sanity + health probe, chưa phải browser e2e đầy đủ
- Screenshot evidence vẫn cần chụp thủ công
- Warning circular chunk của Vite không phải blocker build/runtime, nhưng nên dọn ở phase performance riêng

## 10. File bàn giao quan trọng
- `apps/web/.env.example`
- `apps/web/docs/frontend/routes.md`
- `apps/web/docs/frontend/runbook.md`
- `apps/web/docs/frontend/acceptance-checklist.md`
- `apps/web/scripts/smoke-web.mjs`
- `apps/web/scripts/collect-evidence.mjs`


## Ghi chú smoke dev mode

- `pnpm smoke:web` phải chạy ở **terminal khác** trong khi `pnpm dev` vẫn đang mở.
- Trên một số máy Windows, Vite bind ổn hơn với `http://localhost:5173` hơn là `http://127.0.0.1:5173`.
- Smoke script hiện tự thử `localhost` fallback và tự dò `api/health` trước khi fallback sang `/health`.
