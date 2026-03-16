# RETENTION_POLICY.md

Tài liệu này chốt policy retention dùng cho backend RC1, đồng thời giữ literal compatibility cho `test:pr28`.

## 1. Mục tiêu

Retention cleanup phải giải quyết 3 việc cùng lúc:

1. giữ baseline repeatability cho `DEMO`;
2. dọn dữ liệu rác cho `RELEASE`;
3. tuyệt đối không xóa nhầm dữ liệu audit, incident nghiêm trọng, hoặc evidence quan trọng.

Lệnh canonical:

```bash
pnpm --dir apps/api cleanup:retention:dry-run
pnpm --dir apps/api cleanup:retention
```

## 2. Nguyên tắc bắt buộc

- luôn chạy `cleanup:retention:dry-run` trước khi apply;
- `cleanup:retention` phải idempotent;
- dry-run phải surfacing rõ `scanned`, `eligible`, `deleted`, `errors`, `sampleIds`;
- policy `DEMO` và `RELEASE` phải khác nhau để tránh drift fixture;
- không xóa `audit_logs` mặc định;
- không xóa history của incident `CRITICAL`;
- không xóa evidence media trong `uploads/gate-media/*` hoặc object storage `gate-media/...`.

## 3. Profile retention

### 3.1 DEMO

`DEMO` ưu tiên repeatability. Chỉ được dọn dữ liệu rác hoặc artifact phụ trợ không ảnh hưởng baseline smoke/replay.

Giữ lại:

- fixture auth demo;
- fixture zone / spot / subscription baseline;
- smoke baseline quan trọng;
- history cần để audit demo còn đọc được.

Chỉ cleanup có kiểm soát:

- session hết hạn;
- session revoked cũ;
- login attempts quá hạn;
- tmp files;
- runtime scratch ngoài `observability/`.

### 3.2 RELEASE

`RELEASE` ưu tiên hygiene runtime. Có thể cleanup mạnh tay hơn nhưng vẫn không được đụng vào:

- `audit_logs`;
- incident `CRITICAL`;
- evidence media;
- dữ liệu đang còn active window.

## 4. Dataset matrix

### 4.1 Auth

Có thể cleanup:

- `auth_user_sessions` hết hạn;
- `auth_user_sessions` revoked;
- `auth_login_attempts`.

Không được làm:

- không xóa session đang active hợp lệ;
- không làm gãy revoke-all trace gần nhất nếu còn nằm trong window cần điều tra.

### 4.2 Gate / incident

Có thể cleanup:

- `gate_incident_history` noise only;
- `internal_presence_events` REJECTED;
- `internal_presence_events` smoke artifacts;
- `internal_presence_events` ACCEPTED non-smoke chỉ theo profile và age window.

Không được làm:

- không xóa history của incident `CRITICAL`;
- không xóa incident đang mở;
- không xóa evidence liên kết tới incident đang active.

### 4.3 File artifacts

Có thể cleanup:

- `uploads/tmp/*`;
- `.runtime/*` ngoài `observability/`.

Không được làm:

- không xóa `uploads/gate-media/*`;
- không xóa `.runtime/observability`;
- không xóa artifact đang được reference bởi report/manifest còn hiệu lực.

## 5. Output contract

Dry-run phải hiển thị tối thiểu:

```json
{
  "scanned": 0,
  "eligible": 0,
  "deleted": 0,
  "errors": 0,
  "sampleIds": []
}
```

Apply chạy lại nhiều lần phải cho ra trạng thái idempotent: không crash, không double-delete, không làm hỏng batch metrics.

## 6. Compatibility literals cho source regression

Các literal dưới đây phải tiếp tục tồn tại trong docs/runtime surface:

- `cleanup:retention:dry-run`
- `cleanup:retention`
- `RETENTION_POLICY.md`
- `DEMO`
- `RELEASE`
- `không xóa \`audit_logs\``

## 7. Quy trình vận hành đề xuất

```bash
pnpm --dir apps/api cleanup:retention:dry-run
pnpm --dir apps/api cleanup:retention
pnpm --dir apps/api test:pr28
```

Nếu `dry-run` cho kết quả bất thường, dừng ngay và review policy trước khi apply.

## 8. Quyết định RC1

RC1 chấp nhận cleanup retention khi thỏa cả 4 điều kiện:

1. `test:pr28` xanh;
2. `cleanup:retention:dry-run` ra output đầy đủ;
3. `cleanup:retention` idempotent;
4. policy giữ đúng nguyên tắc: không xóa `audit_logs`, không xóa incident `CRITICAL`, không xóa evidence media.
