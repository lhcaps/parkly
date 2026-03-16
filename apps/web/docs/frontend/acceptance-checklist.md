# Frontend acceptance checklist

## 1. Build + bootstrap
- [ ] `pnpm install` chạy sạch trên máy sạch
- [ ] `pnpm build:web` thành công
- [ ] `apps/web/.env.example` đủ để bootstrap mà không cần hỏi lại người viết
- [ ] `docs/frontend/runbook.md` khớp với script thật trong repo

## 2. Route sanity + deep link
- [ ] `/login` mở được
- [ ] `/overview` mở được
- [ ] `/run-lane` deep link mở được
- [ ] `/review-queue` deep link mở được
- [ ] `/session-history` deep link mở được
- [ ] `/audit-viewer` deep link mở được
- [ ] `/sync-outbox` deep link mở được
- [ ] `/reports` deep link mở được
- [ ] `/mobile-camera-pair` mở được
- [ ] `/mobile-capture` mở được
- [ ] Refresh nested route không trắng màn hình
- [ ] Browser back/forward không làm mất filter state cốt lõi

## 3. Auth + session
- [ ] Login thành công bằng account local hợp lệ
- [ ] Route guard chặn role không hợp lệ ở cả nav và direct URL
- [ ] 401 từ REST và realtime cho UX nhất quán
- [ ] Logout dọn runtime state sạch

## 4. Realtime + degraded handling
- [ ] Khi stream down tạm thời, UI hiện stale/degraded rõ
- [ ] Khi token hết hạn lúc đang stream, UI hiện unauthorized rõ
- [ ] Reconnect không inflate list/card do duplicate event
- [ ] Mutate xong detail được resync bằng snapshot authoritative

## 5. Page-state discipline
- [ ] Loading/ready/empty/degraded/forbidden/error có render hợp lý ở page chính
- [ ] 422 validation không rơi vào generic error toàn cục
- [ ] 500/internal có requestId hoặc hint đủ để triage
- [ ] Empty state không bị nhầm với dependency down

## 6. Operational UX
- [ ] Không còn dev jargon hoặc wording nội bộ dư thừa ở flow chính
- [ ] Review Queue scan được trong 5–10 giây
- [ ] Session History scan được trong 5–10 giây
- [ ] Sync Outbox scan được trong 5–10 giây
- [ ] Audit Viewer scan được trong 5–10 giây
- [ ] Keyboard navigation đi được luồng cơ bản
- [ ] Drawer/table/filter bar không overflow vô lý ở viewport phổ biến

## 7. Smoke + evidence
- [ ] `pnpm smoke:web -- --baseUrl http://127.0.0.1:5173 --apiUrl http://127.0.0.1:3000` pass
- [ ] `pnpm smoke:web:dist -- --apiUrl http://127.0.0.1:3000` pass
- [ ] `docs/frontend/evidence/latest-smoke.json` đã được tạo
- [ ] Build log đã được lưu lại hoặc dán vào evidence bundle
- [ ] Screenshot set tối thiểu đã được chụp thủ công
- [ ] `docs/frontend/evidence/manual-qa-signoff.md` đã được điền

## 8. Merge gate kết luận
Không merge nếu còn một trong các lỗi sau:
- [ ] Docs và runtime lệch nhau
- [ ] Máy sạch bootstrap không lặp lại được
- [ ] Smoke route không đi qua được các route critical
- [ ] FE chỉ chạy ổn trên máy người viết
