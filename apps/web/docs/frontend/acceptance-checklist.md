# Frontend acceptance checklist

## 1. Bootstrap gate
- [ ] `pnpm install` chay sach tren may sach
- [ ] `pnpm build` thanh cong
- [ ] `docs/frontend/runbook.md` khop voi script that trong repo
- [ ] `docs/frontend/routes.md` khop voi runtime query params thuc te

## 2. Role policy + landing gate
- [ ] Policy registry la single source-of-truth cho guard/sidebar/topbar/landing
- Role landing dung matrix: ADMIN/OPS -> `/overview`, GUARD -> `/run-lane`, CASHIER -> `/reports`, WORKER -> `/lane-monitor`
- [ ] Direct URL vao route forbidden luon di qua `/forbidden`
- [ ] Forbidden page hien thi role hien tai, route yeu cau, allowed roles va fallback route

## 3. Canonical routes gate
- [ ] `/overview` mo duoc
- [ ] `/run-lane` deep link mo duoc
- [ ] `/review-queue` deep link mo duoc
- [ ] `/session-history` deep link mo duoc
- [ ] `/sync-outbox` deep link mo duoc
- [ ] `/reports` deep link mo duoc
- [ ] `/subscriptions` deep link mo duoc
- [ ] `/parking-live` deep link mo duoc
- [ ] `/mobile-camera-pair` mo duoc
- [ ] `/mobile-capture` mo duoc
- [ ] Refresh nested route khong trang man hinh
- [ ] Browser back/forward khong lam mat filter state cot loi

## 4. Auth + session gate
- [ ] Login thanh cong bang account local hop le
- [ ] Refresh `/login` khi da authenticated se redirect ve landing dung role
- [ ] Logout don runtime state sach
- [ ] Token het han quay ve `/login` voi notice ro rang
- [ ] UI khong tao cam giac frontend tu cap role

## 5. Subscriptions gate
- [ ] Deep-link `/subscriptions?...&id=...&tab=...` survive reload
- [ ] Click row nao detail mo row do, khong can click lai lan hai
- [ ] Filter doi lam selected id bien mat se clear selection co chu dong
- [ ] List empty, empty selection, detail error, dependency degraded la bon state khac nhau
- [ ] Overview tab hien thi primary vehicle va primary spot
- [ ] Role read-only van doc duoc detail nhung khong thay CTA mutate
- [ ] Mutation thanh cong resync authoritative detail va list summary

## 6. Parking Live gate
- [ ] Board scan duoc trong 5 giay: floor/zone/attention ro rang
- [ ] Search chi spotlight slot khop, khong lam bien mat board context
- [ ] Floor tab hoac summary strip chi ra noi co stale/violation/blocked
- [ ] Empty filter result hien thi empty-state cuc bo, khong trong nhu hong du lieu
- [ ] SSE fail khong lam board trang neu da co snapshot truoc do
- [ ] Banner phan biet ro loading / retrying / stale / error
- [ ] Force refresh hoac reconcile cap nhap freshness timestamp
- [ ] Detail panel cho biet freshness cua slot va lan update gan nhat

## 7. Shared page-state gate
- [ ] Loading / empty / degraded / forbidden / error co semantic ro rang
- [ ] Empty business data khong bi dung chung wording voi dependency down
- [ ] Error state quan trong hien thi requestId hoac hint du de triage
- [ ] Query param sai dinh dang cua `/subscriptions` va `/parking-live` bi normalize ve safe default, khong crash

## 8. Automated regression gate
- [ ] `pnpm test:unit` pass
- [ ] `pnpm test:e2e` pass
- [ ] `pnpm smoke:web:dev` pass (port 5173)
- [ ] `pnpm smoke:web:dist` pass (port 4173)
- [ ] Smoke output cap nhap vao `docs/frontend/evidence/latest-smoke-dev.json`
- [ ] Smoke output cap nhap vao `docs/frontend/evidence/latest-smoke-dist.json`

## 9. Manual QA sign-off gate
- [ ] Login landing theo role da duoc ky tay
- [ ] Forbidden direct URL da duoc ky tay
- [ ] Subscriptions detail/deep-link recovery da duoc ky tay
- [ ] Parking Live stale fallback da duoc ky tay
- [ ] Screenshot checklist toi thieu da duoc chup
- [ ] `docs/frontend/manual-qa-signoff.md` da duoc dien

## 10. Release gate cuoi wave
Khong merge neu con mot trong cac loi sau:
- [ ] Docs va runtime lech nhau
- [ ] May sach bootstrap khong lap lai duoc
- [ ] Regression suite fail d build van xanh
- [ ] Evidence bundle chua co build/test/smoke output
- [ ] FE chi chay on tren may nguoi viet
