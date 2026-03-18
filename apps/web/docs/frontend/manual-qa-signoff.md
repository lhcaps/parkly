# Manual QA sign-off — frontend release baseline freeze

- Owner:
- Reviewer:
- Date:
- Web commit / patch:
- Backend profile: local-dev / demo / rc
- Web base URL dev:
- Web base URL dist:
- API base URL:
- Device / browser:

## Preconditions
- [ ] `pnpm build` pass
- [ ] `pnpm test:unit` pass
- [ ] `pnpm playwright:runtime:check` pass
- [ ] `pnpm test:e2e` pass
- [ ] `pnpm smoke:web:dev` pass
- [ ] `pnpm smoke:web:dist` pass
- [ ] `docs/frontend/evidence/latest-smoke-dev.json` da cap nhat
- [ ] `docs/frontend/evidence/latest-smoke-dist.json` da cap nhat

## Section A — Login landing theo role
| Role | Expected route | Pass | Screenshot | Notes |
| --- | --- | --- | --- | --- |
| ADMIN | `/overview` | [ ] | [ ] | |
| OPS | `/overview` | [ ] | [ ] | |
| GUARD | `/run-lane` | [ ] | [ ] | |
| CASHIER | `/reports` | [ ] | [ ] | |
| WORKER | `/lane-monitor` | [ ] | [ ] | |

## Section B — Forbidden direct URL
- [ ] Direct URL vao `/subscriptions` bang role khong du quyen di qua `/forbidden`
- [ ] Fallback route hien thi dung role hien tai
- [ ] Direct URL vao `/parking-live` bang role khong du quyen khong render nua trang
- [ ] Screenshot `forbidden-fallback.png` da luu
- Notes:

## Section C — Subscriptions workspace
- [ ] Deep-link mo dung subscription va dung tab
- [ ] Reload giu duoc selected item khi `id` con hop le
- [ ] Doi filter lam `id` bien mat se clear selection co chu dong
- [ ] Detail 500 hien thi requestId/hint, pane trai van con
- [ ] Role read-only khong thay CTA mutate
- [ ] Mutation thanh cong resync lai authoritative detail
- [ ] Screenshot `subscriptions-deeplink.png` da luu
- Notes:

## Section D — Parking Live monitoring
- [ ] Board scan duoc floor/zone/attention trong vai giay
- [ ] Empty filter result hien thi empty-state cuc bo
- [ ] Stale fallback van giu snapshot cuoi
- [ ] Banner hien thi dung stale/error/retrying semantics
- [ ] Reconcile lam moi freshness timestamp
- [ ] Detail panel hien thi updatedAt/requestId/hint khi can
- [ ] Screenshot `parking-live-stale-fallback.png` da luu
- Notes:

## Section E — Evidence attachments
- [ ] `landing-admin.png` da dinh kem
- [ ] `landing-ops.png` da dinh kem
- [ ] `landing-guard.png` da dinh kem
- [ ] `landing-cashier.png` da dinh kem
- [ ] `landing-worker.png` da dinh kem
- [ ] `forbidden-fallback.png` da dinh kem
- [ ] `subscriptions-deeplink.png` da dinh kem
- [ ] `parking-live-stale-fallback.png` da dinh kem
- [ ] Build log da dinh kem
- [ ] Unit log da dinh kem
- [ ] E2E log da dinh kem
- [ ] Smoke dev log da dinh kem
- [ ] Smoke dist log da dinh kem
- [ ] latest-smoke-dev.json da dinh kem
- [ ] latest-smoke-dist.json da dinh kem
- [ ] release-signoff.md da dinh kem
- [ ] signoff-manifest.json da dinh kem

## Final sign-off
- Status: PASS / FAIL
- Blocking issues:
- Follow-up items:
