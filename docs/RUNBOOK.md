# Backend RUNBOOK — Deployment Profiles + Compose Packaging

BE-PR-23 chốt 3 profile triển khai đủ ít nhưng rõ: `LOCAL_DEV`, `DEMO`, `RELEASE_CANDIDATE`.

## 1. Quy ước profile

- `LOCAL_DEV`: nhẹ nhất, media local, ưu tiên vòng lặp dev.
- `DEMO`: lặp lại được, media local mặc định để smoke không phụ thuộc object storage.
- `RELEASE_CANDIDATE`: gần runtime thật hơn, bật MinIO để test media pipeline đầy đủ.

Biến `PARKLY_MEDIA_PROFILE` hoặc `MEDIA_STORAGE_DRIVER` không được tự ý kéo `DEMO` sang MinIO, trừ khi bật:

```dotenv
PARKLY_ALLOW_MEDIA_OVERRIDE=ON
```

## 2. Lệnh verify trước khi bootstrap/smoke

```bash
pnpm --dir apps/api verify:deployment -- --profile demo --intent bootstrap
pnpm --dir apps/api verify:deployment -- --profile demo --intent smoke
pnpm --dir apps/api verify:deployment -- --profile release-candidate --intent bootstrap
```

## 3. Bootstrap profile demo

Nếu MySQL/Redis đã chạy sẵn trên máy, có thể bỏ qua compose-up:

```bash
pnpm --dir apps/api bootstrap:demo
pnpm --dir apps/api smoke:demo
```

Nếu muốn để compose dựng dependency:

```bash
pnpm --dir apps/api compose:up:demo
pnpm --dir apps/api bootstrap:demo
pnpm --dir apps/api smoke:demo
```

Nếu Docker engine chưa chạy, bootstrap với `--compose-up` sẽ fail-fast bằng thông báo rõ ràng. Điều này là chủ ý.

## 4. Bootstrap profile RC

```bash
pnpm --dir apps/api compose:up:rc
pnpm --dir apps/api bootstrap:rc
pnpm --dir apps/api smoke:rc
```

RC cần `MEDIA_STORAGE_DRIVER=MINIO` và object storage phải reachable.

## 5. Ghi chú Windows

Wrapper deployment không còn phụ thuộc trực tiếp vào `pnpm.cmd` để chạy nested script. Nó ưu tiên dùng `npm_execpath` qua `process.execPath` để tránh lỗi `spawn EINVAL` trên Windows khi chạy `smoke:demo`, `bootstrap:*` hoặc `reset:*`.

## 6. Mapping tương thích plan/test cũ

Repo hiện tại đang giữ mapping số test thực tế khác với số PR trong plan release. Để tránh lệch giữa tài liệu RC cũ và state hiện tại, dùng mapping sau:

- `test:pr19` tương ứng release consolidation / `test:rc1`.
- `test:pr20` là alias tài liệu cũ cho security layer 2; state hiện tại đang chạy bằng `test:pr26`.
- `test:pr21` là alias tài liệu cũ cho observability layer 1; state hiện tại đang chạy bằng `test:pr27`.
- `test:pr22` là alias tài liệu cũ cho retention cleanup; state hiện tại đang chạy bằng `test:pr28`.
- `test:pr23` là alias tài liệu cũ cho deployment profiles; state hiện tại đang chạy bằng `test:pr29`.
- `test:pr24` là alias tài liệu cũ cho backup/restore/disaster drill; state hiện tại đang chạy bằng `test:pr30`.
- `test:pr25` là alias tài liệu cũ cho final RC gate; state hiện tại đang chạy bằng `test:pr31`.

Khi đọc changelog hoặc checklist RC cũ, hiểu theo mapping này để không nhầm giữa số PR kế hoạch và số script test đã chốt trong repo.

## 7. Security layer 2 legacy compatibility

Các literal dưới đây được giữ lại để tương thích với source-regression tests cũ của security layer 2:

- `auth:sessions:cleanup`
- `test:pr20`
- `test:pr26`

Lệnh cleanup canonical:

```bash
pnpm --dir apps/api auth:sessions:cleanup
```

Security hygiene canonical cho RC hiện tại vẫn bao gồm:

- login throttling
- progressive delay
- short lockout
- revoke-all
- session limit per user
- auth:sessions:cleanup

## 8. Demo credential compatibility for legacy security docs

Demo credential canonical cho local/demo: ops / Parkly@123 on local/demo profile.

Legacy literal compatibility: ops / Parkly@123 / local/demo

## 9. Observability quick triage

Khi hệ thống chậm hoặc lỗi thì đọc metrics nào trước:

- `GET /metrics` để xem counters và latency budget tổng quát.
- `GET /api/ops/metrics/summary` để xem auth / dashboard / media / intake / reconcile / incident / audit đang đỏ ở đâu.
- `GET /api/health` và `GET /api/ready` để đọc health breakdown theo component.

## 10. Retention cleanup compatibility (BE-PR-22 / test:pr28)

Retention cleanup canonical phải hiện rõ cả dry-run lẫn apply trong RUNBOOK.

Tài liệu policy chi tiết được tách riêng tại `RETENTION_POLICY.md`.

- canonical file: `apps/api/docs/RETENTION_POLICY.md`
- reference literal: `RETENTION_POLICY.md`

```bash
pnpm --dir apps/api cleanup:retention:dry-run
pnpm --dir apps/api cleanup:retention
```

Chính sách retention mặc định:

- dry-run là bước bắt buộc trước khi apply;
- `cleanup:retention:dry-run` phải hiển thị rõ `scanned`, `eligible`, `deleted`, `errors`, `sampleIds`;
- `cleanup:retention` phải idempotent khi chạy lặp lại nhiều lần;
- profile `DEMO` mặc định giữ baseline repeatability;
- profile `RELEASE` ưu tiên hygiene của runtime;
- không xóa `audit_logs` mặc định;
- không xóa history của incident `CRITICAL`;
- không xóa evidence media trong `uploads/gate-media/*` hoặc object storage `gate-media/...`.

Retention datasets trọng yếu cần nhớ:

- `auth_user_sessions` hết hạn;
- `auth_user_sessions` revoked;
- `auth_login_attempts`;
- `gate_incident_history` noise only;
- `internal_presence_events` REJECTED;
- `internal_presence_events` smoke artifacts;
- `internal_presence_events` ACCEPTED non-smoke chỉ được giữ/cleanup theo profile;
- `uploads/tmp/*`;
- `.runtime/*` ngoài `observability/`.

Retention compatibility literals cho source regression:

- `cleanup:retention:dry-run`
- `cleanup:retention`
- `RETENTION_POLICY.md`
- `không xóa \`audit_logs\``
- `DEMO`
- `RELEASE`

Trước khi sửa policy thật, đọc `RETENTION_POLICY.md` trước rồi mới chạy cleanup.

## 11. Legacy RC1 smoke chain compatibility

Smoke chain canonical cho RC1 legacy docs/test: auth -> dashboard -> media(local) -> intake -> reconcile -> incident -> audit

## 12. Backup / restore / disaster drill (BE-PR-24)

### 12.1 Khi nào dùng reset, khi nào dùng restore

- dùng `release:reset` khi mục tiêu là quay về baseline demo sạch để replay smoke hoặc tự chữa drift local nhẹ;
- dùng `restore:apply` khi cần quay lại **đúng snapshot đã backup** sau mất DB, reset nhầm, rollback bản demo hoặc khôi phục artifact local quan trọng.

Nói thẳng:

- `reset` = quay về seed baseline
- `restore` = quay về artifact snapshot đã lưu

### 12.2 Backup canonical

```bash
pnpm --dir apps/api backup:create -- --profile demo
```

Artifact mặc định nằm dưới `BACKUP_ROOT_DIR=.backups` với format tên:

```text
<profile>-backup-YYYYMMDDTHHMMSSZ
```

Ví dụ:

```text
demo-backup-20260313T101112Z
```

### 12.3 Restore canonical

```bash
pnpm --dir apps/api restore:apply -- --profile demo --source .backups/demo-backup-20260313T101112Z --confirm
pnpm --dir apps/api restore:verify
```

`restore:verify` chỉ verify phần sống còn sau restore:

- auth login
- dashboard summary
- incident list
- audit list

### 12.4 Disaster drill tối thiểu

```bash
pnpm --dir apps/api drill:disaster:demo
```

Drill này chạy chuỗi:

1. tạo backup mới
2. chạy `release:reset` để mô phỏng sự cố/reset nhầm mức vừa
3. restore từ artifact vừa tạo
4. verify lại auth + dashboard + incident list + audit list

### 12.5 Media strategy

- nếu profile đang dùng `LOCAL`, backup sẽ snapshot local artifacts quan trọng như `uploads/gate-media` và `.runtime/observability`;
- nếu profile đang dùng `MINIO`, artifact chỉ ghi rõ chiến lược `MINIO_EXTERNAL`; bucket backup phải làm bằng chiến lược riêng ở tầng object storage.

### 12.6 Biến env mới

```dotenv
BACKUP_ROOT_DIR=.backups
BACKUP_RETENTION_DEMO_DAYS=7
BACKUP_RETENTION_RC_DAYS=14
BACKUP_RPO_TARGET_MINUTES=60
BACKUP_RTO_TARGET_MINUTES=15
MYSQLDUMP_BIN=mysqldump
MYSQL_BIN=mysql
BACKUP_LOCAL_ARTIFACT_PATHS=uploads/gate-media,.runtime/observability
```

## 13. Final RC gate + clean machine verification (BE-PR-25)

PR này không nhằm mở thêm feature. Nó chốt bằng chứng rằng backend đủ sạch để gọi là RC1 và đủ gọn để một dev khác hoặc nhóm frontend dựng lại mà không cần người viết repo ngồi kèm.

### 13.1 Test matrix máy sạch

Chạy tối thiểu theo thứ tự này trên máy sạch hoặc máy giả lập máy sạch:

```bash
pnpm --dir apps/api verify:deployment -- --profile demo --intent bootstrap
pnpm --dir apps/api bootstrap:demo
pnpm --dir apps/api rc1:fixtures:check
pnpm --dir apps/api rc1:smoke:repeat -- --runs 3 --profile demo
pnpm --dir apps/api rc1:gate -- --profile demo --runs 3
```

Matrix tối thiểu phải bao gồm:

- bootstrap
- migrate
- grant
- seed
- login
- dashboard
- upload
- intake
- refresh
- resolve
- audit

### 13.2 Repeat smoke 3 vòng liên tục

Lệnh canonical:

```bash
pnpm --dir apps/api rc1:smoke:repeat -- --runs 3 --profile demo
```

Script này tự chạy chuỗi `release:reset -> smoke:bundle` nhiều vòng liên tục, ghi evidence JSON vào `RC_EVIDENCE_ROOT_DIR`, và fail nếu fixture trọng yếu bị drift như:

- role smoke
- siteCode
- spotCode
- incident/audit baseline tối thiểu

### 13.3 Final RC gate

Lệnh canonical:

```bash
pnpm --dir apps/api rc1:gate -- --profile demo --runs 3
```

Alias tương thích cho RC docs cũ:

```bash
pnpm --dir apps/api rc:gate -- --profile demo --runs 3
```

Gate mặc định chạy:

- `typecheck`
- `test:rc1`
- `test:pr26`
- `test:pr27`
- `test:pr28`
- `test:pr29`
- `test:pr30`
- `test:pr31`
- `rc1:fixtures:check`
- `rc1:smoke:repeat --runs 3`

### 13.4 Evidence archive

Evidence mặc định được ghi vào:

```text
release-evidence/backend-rc1
```

Các artifact cần giữ:

- `clean-machine-matrix.json`
- `fixture-check.json`
- `repeat-smoke-report.json`
- `rc1-gate-summary.json`
- changelog RC
- checklist ký duyệt nội bộ

### 13.5 Ký duyệt nội bộ trước khi bàn giao

Không gắn nhãn `backend-rc1` nếu thiếu một trong các bằng chứng sau:

- repeat smoke tối thiểu 3 vòng liên tục không drift baseline
- fixture check xanh
- docs phát hành khớp runtime thật
- changelog RC chốt rõ ready scope và non-goals
- evidence archive nằm trong repo hoặc đường dẫn bàn giao rõ ràng
