# MONOREPO FIX NOTES — DEV ADMIN DB FALLBACK

Bản này vá theo hướng chạy local/dev ổn định hơn khi MySQL account `parking_root` chưa có `WITH GRANT OPTION`
hoặc `parking_app` chưa được GRANT đủ cho gate v4.

## Những gì đã đổi

### API
- `apps/api/src/lib/prisma.ts`
  - thêm `DB_RUNTIME_FALLBACK_TO_ADMIN`
  - mặc định **ON ở local/dev**, **OFF ở production**
  - khi bật, server/scripts dùng Prisma sẽ chạy bằng `DATABASE_ADMIN_*`
- `apps/api/src/scripts/apply-grants-parking-app.ts`
  - không chết cứng ở local/dev nếu `parking_root` không GRANT được nhưng runtime admin fallback đang bật
- `apps/api/src/scripts/db-whoami-app.ts`
  - probe trực tiếp bằng `parking_app`, không bị che bởi runtime fallback
- `apps/api/src/server/app.ts`
  - `/api/alpr/recognize` không còn auto mock plate khi cả `imageUrl` và `plateHint` đều trống

### Web
- `apps/web/src/pages/GatePage.tsx`
  - bỏ text nói rằng để trống vẫn chạy mock plate
  - chặn flow nếu không có ảnh và cũng không có plate hint
  - không còn gửi `simulatePlate` từ UI chính

### Env
- `apps/api/.env`
- `apps/api/.env.example`
  - thêm `DB_RUNTIME_FALLBACK_TO_ADMIN=ON`

## Ý nghĩa thực tế
- Chạy local demo/dev đỡ bị chặn bởi lỗi quyền MySQL host-scoped account.
- `pnpm e2e:full` sẽ không chết ngay chỉ vì `db:grant:app` không chạy được bằng `parking_root`.
- Muốn quay về least-privilege chuẩn, đặt:

```env
DB_RUNTIME_FALLBACK_TO_ADMIN=OFF
```

rồi cấu hình lại MySQL grants cho `parking_app` như thiết kế ban đầu.
