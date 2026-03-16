# Incident Playbook — Secret Rotation / Secret Compromise

## Trigger tình huống

Playbook này dùng khi có một trong các dấu hiệu sau:

- `summary.secretSafety.hints` báo spike reject hoặc replay suspicion;
- `health.components.secretSafety.status` chuyển sang `DEGRADED` hoặc `MISCONFIGURED`;
- rollout `*_NEXT` vừa bật xong nhưng internal/device traffic bắt đầu 401/403 tăng đột ngột;
- nghi ngờ raw secret bị lộ qua env, shell history, paste nhầm, log hoặc chat.

## Containment ngay lập tức

1. chặn rollout mới; không đổi thêm nhiều biến cùng lúc;
2. chạy ngay:

```bash
pnpm --dir apps/api secrets:check -- --profile release-candidate --intent pilot
pnpm --dir apps/api secrets:rotation:check
```

3. đọc `GET /api/ops/metrics/summary` và tập trung vào `summary.secretSafety`;
4. đọc `GET /api/health` để xem `components.secretSafety` và mode rotation hiện tại.

## Nếu nghi ngờ secret mới (`*_NEXT`) sai

1. giữ `*_ACTIVE` nguyên trạng;
2. xoá hoặc để trống `*_NEXT` cho field lỗi;
3. reload runtime;
4. ghi audit event rollback:

```bash
pnpm --dir apps/api secrets:rotation:audit -- --action rollback --field internal-service
```

hoặc:

```bash
pnpm --dir apps/api secrets:rotation:audit -- --action rollback --field device-capture
```

## Nếu nghi ngờ secret hiện hành (`*_ACTIVE`) đã lộ

1. tạo secret mới sạch;
2. nạp secret mới vào `*_NEXT`;
3. verify bằng `secrets:check` + `secrets:rotation:check`;
4. rollout client/service/device sang secret mới;
5. khi traffic ổn định, promote `*_NEXT` -> `*_ACTIVE`;
6. xoá `*_NEXT` cũ;
7. ghi audit event `started` rồi `completed`.

## Thứ tự verify chuẩn

1. internal service token;
2. device capture fallback secret;
3. internal presence HMAC / API key nếu flow liên quan;
4. smoke bundle hoặc probe route liên quan;
5. metrics summary + health breakdown.

## Rule rollback

Rollback ngay khi:

- reject spike tăng mạnh sau khi bật `*_NEXT`;
- `health.components.secretSafety.status = MISCONFIGURED`;
- `legacy-active-mismatch` hoặc `active-next-duplicate` xuất hiện;
- device/internal traffic 401/403 tăng nhưng business flow trước rollout vẫn ổn.

## Điều tuyệt đối không làm

- không log raw secret;
- không paste raw secret vào ticket/chat;
- không commit raw secret vào `.env.example` hoặc repo tracked file;
- không promote `*_NEXT` khi `secrets:rotation:check` còn lỗi.
