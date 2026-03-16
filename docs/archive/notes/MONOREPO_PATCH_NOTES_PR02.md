# Monorepo patch notes — PR-02 integrated

Bản này đã được ghép trực tiếp vào full monorepo thay vì tách lẻ API / Web / Packages.

## Đã làm
- thêm đầy đủ `packages/gate-core/src/*`
- giữ `packages/contracts` làm source contract dùng chung
- nối `apps/api` và `apps/web` sang shared packages bằng workspace imports
- thêm TS path mapping trong:
  - `apps/api/tsconfig.json`
  - `apps/web/tsconfig.json`
- sửa web để không còn vỡ build vì thiếu type/export:
  - thêm `AlprRecognizeRes`
  - export lại `PlateCanonicalDto`
  - sửa import type ở `GatePage.tsx`
  - bỏ badge `simulate plate` ở preview card, đổi thành trạng thái trung tính
- chỉnh `package.json` root thành workspace root gọn hơn và thêm script chạy nhanh

## Validate đã làm trong môi trường này
- `apps/web`: TypeScript check chạy qua bằng `node node_modules/typescript/bin/tsc --noEmit`
- `packages/gate-core`: TypeScript check chạy qua
- `packages/contracts`: TypeScript check chạy qua

## Việc bạn nên chạy lại sau khi giải nén
```bash
pnpm install
pnpm --dir apps/web build
pnpm --dir apps/api db:migrate
pnpm --dir apps/api prisma:pull
pnpm --dir apps/api db:grant:app
pnpm --dir apps/api db:seed:min
```

## Lưu ý thật
- Tôi không xác nhận full `apps/api` typecheck sạch toàn bộ vì repo hiện còn phụ thuộc Prisma/client state và môi trường DB local của bạn.
- Patch này tập trung chốt PR-02 vào full monorepo và sửa các chỗ web đang vỡ vì shared package chưa được ghép đúng.
