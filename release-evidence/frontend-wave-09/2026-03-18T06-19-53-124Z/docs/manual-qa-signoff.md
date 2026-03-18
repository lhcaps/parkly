# Manual QA sign-off — frontend wave parking-live + subscriptions + RBAC

- Owner:
- Reviewer:
- Date:
- Web commit / patch:
- Backend profile: local-dev / demo / rc
- Web base URL:
- API base URL:
- Device / browser:

## Preconditions
- [ ] `pnpm build` pass
- [ ] `pnpm test:unit` pass
- [ ] `pnpm test:e2e` pass
- [ ] `SMOKE_WEB_PORT=5173 pnpm smoke:web` pass
- [ ] `docs/frontend/evidence/latest-smoke.json` đã cập nhật

## Section A — Login landing theo role
- [ ] ADMIN vào `/overview`
- [ ] OPS vào `/overview`
- [ ] GUARD vào `/run-lane`
- [ ] CASHIER vào `/reports`
- [ ] WORKER vào `/lane-monitor`
- [ ] Refresh `/login` khi đã authenticated tự redirect đúng role home
- Notes:

## Section B — Forbidden direct URL
- [ ] Direct URL vào `/subscriptions` bằng role không đủ quyền đi qua `/forbidden`
- [ ] Fallback route hiển thị đúng role hiện tại
- [ ] Direct URL vào `/parking-live` bằng role không đủ quyền không render nửa trang
- Notes:

## Section C — Subscriptions workspace
- [ ] Deep-link mở đúng subscription và đúng tab
- [ ] Reload giữ được selected item khi `id` còn hợp lệ
- [ ] Đổi filter làm `id` biến mất sẽ clear selection có chủ đích
- [ ] Detail 500 hiển thị requestId/hint, pane trái vẫn còn
- [ ] Role read-only không thấy CTA mutate
- [ ] Mutation thành công resync lại authoritative detail
- Notes:

## Section D — Parking Live monitoring
- [ ] Board scan được floor/zone/attention trong vài giây
- [ ] Empty filter result hiển thị empty-state cục bộ
- [ ] Stale fallback vẫn giữ snapshot cuối
- [ ] Banner hiển thị đúng stale/error/retrying semantics
- [ ] Reconcile làm mới freshness timestamp
- [ ] Detail panel hiển thị updatedAt/requestId/hint khi cần
- Notes:

## Section E — Evidence attachments
- [ ] Screenshot set tối thiểu đã lưu theo naming convention
- [ ] Build log đã đính kèm
- [ ] Unit log đã đính kèm
- [ ] E2E log đã đính kèm
- [ ] Smoke log đã đính kèm
- [ ] latest-smoke.json đã đính kèm

## Final sign-off
- Status: PASS / FAIL
- Blocking issues:
- Follow-up items:
