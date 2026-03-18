# Playwright browser runtime

## Muc tieu
Lam ro mot chuyen don gian nhung hay bi bo sot: repo co `@playwright/test` chua co nghia la may da co Chromium runtime.

## Kiem tra
```bash
pnpm --dir apps/web playwright:runtime:check
```

## Cai runtime
```bash
pnpm --dir apps/web playwright:runtime:install
```

## CI
Truoc khi goi `pnpm --dir apps/web test:e2e` hoac `pnpm --dir apps/web release:signoff`, pipeline phai co buoc cai browser runtime.

## Dieu khong duoc lam
- Khong de E2E fail mo ho vi thieu browser runtime
- Khong ky sign-off neu runtime check chua xanh
