# Frontend acceptance checklist

## 1. Bootstrap gate
- [ ] `pnpm install` chạy sạch trên máy sạch
- [ ] `pnpm build` thành công
- [ ] `docs/frontend/runbook.md` khớp với script thật trong repo
- [ ] `docs/frontend/routes.md` khớp với runtime query params thực tế

## 2. Role policy + landing gate
- [ ] Policy registry là single source-of-truth cho guard/sidebar/topbar/landing
- [ ] Role landing đúng matrix: ADMIN/OPS -> `/overview`, GUARD -> `/run-lane`, CASHIER -> `/reports`, WORKER -> `/lane-monitor`
- [ ] Direct URL vào route forbidden luôn đi qua `/forbidden`
- [ ] Forbidden page hiển thị role hiện tại, route yêu cầu, allowed roles và fallback route

## 3. Canonical routes gate
- [ ] `/overview` mở được
- [ ] `/run-lane` deep link mở được
- [ ] `/review-queue` deep link mở được
- [ ] `/session-history` deep link mở được
- [ ] `/sync-outbox` deep link mở được
- [ ] `/reports` deep link mở được
- [ ] `/subscriptions` deep link mở được
- [ ] `/parking-live` deep link mở được
- [ ] `/mobile-camera-pair` mở được
- [ ] `/mobile-capture` mở được
- [ ] Refresh nested route không trắng màn hình
- [ ] Browser back/forward không làm mất filter state cốt lõi

## 4. Auth + session gate
- [ ] Login thành công bằng account local hợp lệ
- [ ] Refresh `/login` khi đã authenticated sẽ redirect về landing đúng role
- [ ] Logout dọn runtime state sạch
- [ ] Token hết hạn quay về `/login` với notice rõ ràng
- [ ] UI không tạo cảm giác frontend tự cấp role

## 5. Subscriptions gate
- [ ] Deep-link `/subscriptions?...&id=...&tab=...` survive reload
- [ ] Click row nào detail mở row đó, không cần click lại lần hai
- [ ] Filter đổi làm selected id biến mất sẽ clear selection có chủ đích
- [ ] List empty, empty selection, detail error, dependency degraded là bốn state khác nhau
- [ ] Overview tab hiển thị primary vehicle và primary spot
- [ ] Role read-only vẫn đọc được detail nhưng không thấy CTA mutate
- [ ] Mutation thành công resync authoritative detail và list summary

## 6. Parking Live gate
- [ ] Board scan được trong 5 giây: floor/zone/attention rõ ràng
- [ ] Search chỉ spotlight slot khớp, không làm biến mất board context
- [ ] Floor tab hoặc summary strip chỉ ra nơi có stale/violation/blocked
- [ ] Empty filter result hiển thị empty-state cục bộ, không trông như hỏng dữ liệu
- [ ] SSE fail không làm board trắng nếu đã có snapshot trước đó
- [ ] Banner phân biệt rõ loading / retrying / stale / error
- [ ] Force refresh hoặc reconcile cập nhật freshness timestamp
- [ ] Detail panel cho biết freshness của slot và lần update gần nhất

## 7. Shared page-state gate
- [ ] Loading / empty / degraded / forbidden / error có semantic rõ ràng
- [ ] Empty business data không bị dùng chung wording với dependency down
- [ ] Error state quan trọng hiển thị requestId hoặc hint đủ để triage
- [ ] Query param sai định dạng của `/subscriptions` và `/parking-live` bị normalize về safe default, không crash

## 8. Automated regression gate
- [ ] `pnpm test:unit` pass
- [ ] `pnpm test:e2e` pass
- [ ] `SMOKE_WEB_PORT=5173 pnpm smoke:web` pass
- [ ] Smoke output cập nhật vào `docs/frontend/evidence/latest-smoke.json`

## 9. Manual QA sign-off gate
- [ ] Login landing theo role đã được ký tay
- [ ] Forbidden direct URL đã được ký tay
- [ ] Subscriptions detail/deep-link recovery đã được ký tay
- [ ] Parking Live stale fallback đã được ký tay
- [ ] Screenshot checklist tối thiểu đã được chụp
- [ ] `docs/frontend/manual-qa-signoff.md` đã được điền

## 10. Release gate cuối wave
Không merge nếu còn một trong các lỗi sau:
- [ ] Docs và runtime lệch nhau
- [ ] Máy sạch bootstrap không lặp lại được
- [ ] Regression suite fail dù build vẫn xanh
- [ ] Evidence bundle chưa có build/test/smoke output
- [ ] FE chỉ chạy ổn trên máy người viết
