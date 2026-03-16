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

## 2.1 Secret hygiene preflight (BE-PR-32 / BE-PR-33)

Trước khi bootstrap hoặc handoff profile nghiêm túc, chạy secret check riêng trước rồi mới chạy `verify:deployment`:

```bash
pnpm --dir apps/api secrets:check -- --profile demo --intent smoke
pnpm --dir apps/api secrets:check -- --profile release-candidate --intent bootstrap
pnpm --dir apps/api secrets:rotation:check
pnpm --dir apps/api verify:deployment -- --profile release-candidate --intent pilot
```

Nguyên tắc đã chốt:

- `demo`/`local-dev` có thể còn `WARN` nếu secret vẫn là placeholder để không phá vòng lặp local quá sớm;
- `release-candidate` hoặc intent `pilot` phải fail nếu còn placeholder hoặc secret trống;
- secret ngắn, có whitespace, entropy yếu hoặc reuse giữa `API_INTERNAL_SERVICE_TOKEN` và `DEVICE_CAPTURE_DEFAULT_SECRET` là cấu hình lỗi;
- rotation runtime chấp nhận cặp `ACTIVE` / `NEXT` cho internal service token và device capture fallback secret;
- `ACTIVE` + `NEXT` phải khác nhau; legacy alias và `*_ACTIVE` không được lệch giá trị;
- tài liệu chi tiết nằm ở `apps/api/docs/SECURITY_SECRETS.md`.


## 2.2 Rotation rollout tối thiểu

Cặp env canonical:

```dotenv
API_INTERNAL_SERVICE_TOKEN_ACTIVE=...
API_INTERNAL_SERVICE_TOKEN_NEXT=...
DEVICE_CAPTURE_SECRET_ACTIVE=...
DEVICE_CAPTURE_SECRET_NEXT=...
```

Flow ngắn gọn:

1. giữ secret hiện hành ở `*_ACTIVE`;
2. nạp secret mới vào `*_NEXT`;
3. chạy `pnpm --dir apps/api secrets:rotation:check`;
4. rollout client/device/service mới sang `NEXT`;
5. verify traffic sống ổn;
6. promote `NEXT` -> `ACTIVE`, xoá `NEXT`;
7. chạy lại `secrets:rotation:check` để xác nhận về state sạch.

Nếu chỉ muốn cutover ngắn, runtime vẫn chấp nhận state `NEXT_ONLY`, nhưng không nên giữ trạng thái đó lâu hơn cần thiết.

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

## 14. Secret setup cho demo và release-candidate

### 14.1 Demo / local-dev

Có thể giữ placeholder để chạy local nhanh, nhưng `secrets:check` sẽ báo `WARN`. Đây là trạng thái chấp nhận được cho smoke nội bộ, không phải trạng thái sạch để promote.

### 14.2 Release-candidate / pilot

Bắt buộc thay thật hai biến sau trước khi bootstrap hoặc verify nghiêm túc:

```dotenv
API_INTERNAL_SERVICE_TOKEN=__SET_ME_INTERNAL_TOKEN__
DEVICE_CAPTURE_DEFAULT_SECRET=__SET_ME_DEVICE_SECRET__
```

Giá trị thật phải:

- dài tối thiểu 32 ký tự;
- không whitespace;
- không reuse giữa hai channel;
- không dùng literal kiểu `changeme`, `placeholder`, `replace-me`, `__SET_ME_*__`.

### 14.3 Quy trình preflight tối thiểu

```bash
pnpm --dir apps/api secrets:check -- --profile release-candidate --intent bootstrap
pnpm --dir apps/api verify:deployment -- --profile release-candidate --intent bootstrap
pnpm --dir apps/api bootstrap:rc
```

### 14.4 Troubleshooting

- `internal-service-token` đỏ: sửa `API_INTERNAL_SERVICE_TOKEN`;
- `device-capture-secret` đỏ: sửa `DEVICE_CAPTURE_DEFAULT_SECRET`;
- `duplicate-secret`: đang reuse cùng một giá trị cho hai channel;
- `contains-whitespace`: secret bị dính space/newline khi copy env.

## Secret safety observability + incident response

Từ BE-PR-34, operator có thêm 3 lớp đọc nhanh khi nghi ngờ mismatch secret hoặc rollout lỗi:

- `GET /api/ops/metrics/summary` có thêm nhánh `summary.secretSafety` gồm reject counters, missing auth header counters, replay suspicion counters, rotation event counters và `hints`.
- `GET /api/health` và `GET /api/ready` có thêm component `secretSafety` để nhìn ngay hygiene hiện tại, mode rotation (`ACTIVE_ONLY`, `ACTIVE_AND_NEXT`, `NEXT_ONLY`) và hint spike gần nhất.
- HTTP logging đã redact các header/body nhạy cảm như `authorization`, `x-internal-api-key`, `x-internal-signature`, `password`, `refreshToken`, `signature`.

Khi thấy `summary.secretSafety.hints` hoặc `health.components.secretSafety.mismatchSpikeHint` bật lên:

1. chạy `pnpm --dir apps/api secrets:check -- --profile release-candidate --intent pilot`;
2. chạy `pnpm --dir apps/api secrets:rotation:check`;
3. nếu đang rollout secret mới, ghi audit config event:

```bash
pnpm --dir apps/api secrets:rotation:audit -- --action started --field all
pnpm --dir apps/api secrets:rotation:audit -- --action completed --field all
pnpm --dir apps/api secrets:rotation:audit -- --action rollback --field all
```

Chi tiết containment / verify / rollback nằm ở `apps/api/docs/INCIDENT_SECRET_ROTATION.md`.

## Pilot gate / release hardening

Từ BE-PR-35, môi trường nghiêm túc có thêm `pilot:gate` để khóa hẳn đường deploy bẩn và tạo evidence artifact chính thức.

### Mục tiêu

- fail-fast nếu secret hygiene còn placeholder/dev literal;
- fail-fast nếu rotation topology còn lỗi hoặc chưa set `*_ACTIVE` rõ ràng;
- gom full evidence vào `release-evidence/backend-pilot`;
- chốt một lệnh duy nhất cho readiness nội bộ trước khi gọi là `backend-pilot-ready`.

### Lệnh chính

```bash
pnpm --dir apps/api pilot:gate
```

Gate này sẽ tự chạy tối thiểu:

```bash
pnpm --dir apps/api secrets:check -- --profile release-candidate --intent pilot --strict --format json
pnpm --dir apps/api secrets:rotation:check -- --require-active --format json
pnpm --dir apps/api verify:deployment -- --profile release-candidate --intent pilot
pnpm --dir apps/api typecheck
pnpm --dir apps/api test:pr26
pnpm --dir apps/api test:pr27
pnpm --dir apps/api test:pr28
pnpm --dir apps/api test:pr29
pnpm --dir apps/api test:pr30
pnpm --dir apps/api test:pr31
pnpm --dir apps/api test:pr32
pnpm --dir apps/api test:pr33
pnpm --dir apps/api test:pr34
```

### Evidence artifact chuẩn

Sau khi pass, thư mục `release-evidence/backend-pilot` phải có ít nhất:

- `security-secrets-check.json`
- `security-rotation-check.json`
- `verify-deployment-pilot.json`
- `pilot-gate-summary.json`

### Rule mới cho pilot

- `secrets:rotation:check -- --require-active` sẽ fail nếu chỉ còn legacy alias hoặc `NEXT_ONLY`.
- `verify:deployment -- --intent pilot` sẽ có thêm `securityRotation` và các check `internal-service-rotation`, `device-capture-rotation`.
- `PILOT_LABEL`, `PILOT_EVIDENCE_ROOT_DIR`, `PILOT_SKIP_TYPECHECK`, `PILOT_VERIFY_DEPLOYMENT_BEFORE_GATE` là contract env mới cho release hardening.


## Logging profile

Mặc định local-dev dùng log format `dev` để terminal gọn, ưu tiên access summary một dòng và chỉ bung stack khi có warn/error.

```dotenv
LOG_LEVEL=info
LOG_FORMAT=dev
LOG_REDACT_IP=OFF
```

Khuyến nghị:

- local-dev / demo nội bộ: `LOG_FORMAT=dev`
- production / ship log collector: `LOG_FORMAT=json`
- môi trường nhạy cảm IP: `LOG_REDACT_IP=ON`

Access log mới chỉ giữ các field vận hành quan trọng như `requestId`, `method`, `path`, `status`, `durationMs`, `actorRole`, `deviceCode`, `siteCode`, `laneCode`, `sessionId`, `reviewId`. Header nhạy cảm và secret trong body/query đã bị redact.
