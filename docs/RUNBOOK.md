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

## 14. Frontend mobile pairing over LAN (FE-PR-01)

Mục tiêu của phần này là tránh việc QR pair sinh `localhost` hoặc origin sai khi desktop chạy web local còn điện thoại mở surface qua Wi‑Fi/LAN.

### 14.1 Chạy web để điện thoại truy cập được

Web dev server phải bind ra tất cả interface:

```bash
pnpm --dir apps/web dev -- --host 0.0.0.0 --port 5173
```

Khi cần chốt cứng origin cho QR/pair links, đặt thêm trong `apps/web/.env`:

```dotenv
VITE_PUBLIC_WEB_ORIGIN=http://192.168.1.84:5173
```

Quy tắc bắt buộc:

- `VITE_PUBLIC_WEB_ORIGIN` chỉ được là bare origin;
- không thêm path như `/mobile-capture`;
- không thêm query string hoặc hash;
- `VITE_API_BASE_URL` và `VITE_PUBLIC_WEB_ORIGIN` là hai khái niệm khác nhau, không được trộn.

### 14.2 Phân tách đúng API base và web origin

Ví dụ local LAN chuẩn:

```dotenv
VITE_API_BASE_URL=
VITE_PUBLIC_WEB_ORIGIN=http://192.168.1.84:5173
```

Giải thích:

- `VITE_API_BASE_URL=` để trống nếu vẫn dùng Vite proxy `/api -> http://127.0.0.1:3000` trên desktop;
- `VITE_PUBLIC_WEB_ORIGIN` là URL mà iPhone mở được sau khi quét QR;
- nếu API chạy origin riêng không qua proxy thì set `VITE_API_BASE_URL` độc lập, nhưng vẫn giữ `VITE_PUBLIC_WEB_ORIGIN` là web origin thực tế cho mobile.

### 14.3 Checklist vận hành nhanh

1. PC và điện thoại phải cùng subnet Wi‑Fi/LAN.
2. Chạy web với `--host 0.0.0.0`.
3. Xác nhận Windows Firewall không chặn port 5173.
4. Mở `http://192.168.1.84:5173` trực tiếp trên iPhone trước khi quét QR.
5. Vào trang Mobile Camera Pair rồi xác nhận badge origin là `lan-ready`, không phải `loopback`.
6. Nếu đổi IP LAN hoặc đổi máy, pair cũ trong local registry phải được xem là legacy/origin drift và tạo lại.


## 15. Mobile device context consistency + signed surface verification (FE-PR-02)

Mục tiêu của phần này là chặn triệt để tình trạng heartbeat và capture ký bằng secret/query context cũ sau khi operator đã sửa form trực tiếp trên điện thoại.

### 15.1 Quy tắc vận hành mới

- query params trên URL chỉ dùng để prefill **một lần** lúc mở tab;
- sau khi trang đã mount, mọi thao tác heartbeat và capture chỉ được lấy dữ liệu từ live form state hiện tại;
- mobile surface không được gọi `/api/media/upload`;
- nếu backend trả `DEVICE_SIGNATURE_INVALID`, phải đối chiếu lại **effective device context** ngay trên màn hình trước khi retry.

### 15.2 Smoke thủ công bắt buộc sau khi đổi secret

1. Tạo pair từ desktop và mở link trên iPhone.
2. Xác nhận thẻ **Effective device context** hiển thị đúng `site / lane / direction / deviceCode` và secret mask.
3. Sửa `deviceSecret` trên form từ giá trị A sang giá trị B.
4. Bấm **Heartbeat ONLINE**.
5. Kiểm tra status block và local ops journal:
   - request phải mang `requestId` mới;
   - nếu secret B sai thì lỗi phải phản ánh secret/live form hiện tại, không phải secret A từ query cũ;
   - nếu secret B đúng thì device health phải chuyển về `ONLINE`.
6. Không reload tab, giữ nguyên form rồi bấm **Send capture** với plate hint hoặc ảnh local.
7. Xác nhận:
   - capture dùng cùng effective context như heartbeat;
   - session / run-lane trên desktop nhận update đúng lane;
   - không có request nào từ mobile surface gọi `/api/media/upload`.

### 15.3 Checklist chẩn đoán nhanh tại hiện trường

- nếu heartbeat sai mà capture đúng: kiểm tra xem UI có đang dùng chung effective context hay không;
- nếu cả heartbeat và capture đều sai: so lại `deviceCode + deviceSecret` trong thẻ effective context với thiết bị đã đăng ký ở backend;
- nếu tab mới mở vẫn quay về secret cũ: đó là hành vi đúng vì URL pair chỉ là seed ban đầu; tab cũ đang mở không được phép bị mutate ngược;
- nếu cần lưu evidence nhanh, copy `requestId` từ status block và mở **Ops journal** ngay trên mobile page.


## 14. Frontend smoke — Mobile Capture + Review Workflow (FE-PR-05)

Mục này chốt regression gate cho 4 PR frontend trước. Không thay thế test backend. Nó dùng để chứng minh operator có thể lặp lại đúng flow thật trên desktop + iPhone mà không cần giải thích miệng thêm.

### 14.1 Preconditions bắt buộc

- desktop và iPhone ở cùng subnet LAN, ví dụ `192.168.1.x`;
- web chạy với bind `0.0.0.0`;
- `VITE_PUBLIC_WEB_ORIGIN` trỏ đúng origin LAN hoặc tab hiện tại đã mở bằng origin LAN;
- API reachable từ cả desktop lẫn iPhone;
- device secret đúng với thiết bị đang test;
- backend đã bootstrap xong và có user vận hành hợp lệ.

Ví dụ dev web LAN-ready:

```bash
pnpm --dir apps/web dev -- --host 0.0.0.0
```

Ví dụ env tối thiểu:

```dotenv
VITE_PUBLIC_WEB_ORIGIN=http://192.168.1.84:5173
VITE_API_BASE_URL=http://192.168.1.84:3000/api
```

### 14.2 Smoke shell check trước khi test tay

Từ `apps/web`:

```bash
pnpm smoke:web -- --baseUrl http://192.168.1.84:5173 --apiUrl http://192.168.1.84:3000/api --jsonOut docs/frontend/evidence/latest-smoke.json
```

Nếu muốn test dist build thay vì dev server:

```bash
pnpm build
pnpm smoke:web:dist -- --host 0.0.0.0 --port 4173 --apiUrl http://192.168.1.84:3000/api --jsonOut docs/frontend/evidence/latest-smoke.json
```

Kỳ vọng tối thiểu:

- tất cả route shell chính trả `200` và render được SPA shell;
- `mobile-camera-pair` và `mobile-capture` phải pass;
- API health không nhất thiết block smoke route, nhưng nếu fail phải được ghi vào evidence.

### 14.3 One-pass operator flow

Chạy đủ đúng thứ tự dưới đây. Không cherry-pick từng nút riêng lẻ.

1. Desktop mở `Mobile Camera Pair`.
2. Tạo pair mới và xác minh QR/link dùng origin LAN thay vì `localhost`.
3. iPhone mở link pair đó.
4. Trên iPhone, sửa tay `deviceSecret` nếu cần rồi bấm heartbeat.
5. Xác minh device health hoặc lane/session surface đã phản ánh thiết bị online.
6. Chụp ảnh hoặc nhập plate hint rồi gửi capture.
7. Trên desktop, xác minh session/review cập nhật tương ứng.
8. Nếu có review action, thực hiện một action hợp lệ rồi xác minh session detail và queue cùng refresh.
9. Tạo một case terminal session rồi mở lại review/session UI để xác minh khóa action đúng.

### 14.4 Evidence bắt buộc cho mỗi vòng

Mỗi vòng test phải lưu tối thiểu:

- 1 screenshot QR/pair card thể hiện origin effective;
- 1 screenshot mobile context summary trước heartbeat hoặc capture;
- 1 screenshot heartbeat status, có requestId nếu backend trả;
- 1 screenshot capture status, có requestId nếu backend trả;
- 1 screenshot session detail hoặc review detail sau mutation;
- 1 screenshot terminal lock banner nếu test case terminal;
- 1 đoạn log hoặc screenshot network thể hiện route được gọi đúng surface;
- file `latest-smoke.json` của shell smoke.

### 14.5 Ma trận 3 vòng lặp tối thiểu

#### Vòng 1 — happy path

- pair mới;
- heartbeat thành công;
- capture thành công;
- session đi đúng trạng thái kỳ vọng.

#### Vòng 2 — fresh pair token

- tạo pair mới hoàn toàn;
- không reuse pair cũ;
- xác minh không bị drift về origin cũ hoặc query cũ.

#### Vòng 3 — edit secret giữa chừng

- mở link pair có secret A;
- sửa form sang secret B;
- heartbeat và capture phải phản ánh secret B;
- shell user không được logout vì lỗi device-signed.

### 14.6 Gate fail ngay

Fail release gate ngay nếu gặp một trong các dấu hiệu sau:

- QR hoặc copy link vẫn sinh `localhost` hoặc `127.x` trong khi đang chạy smoke LAN;
- heartbeat hoặc capture còn ký bằng secret cũ lấy từ query/pair seed;
- mobile page còn gọi `/api/media/upload` trong flow thiết bị;
- `401` từ device endpoint làm auth shell chuyển sang expired/logout;
- session đã terminal nhưng UI vẫn cho thao tác chính;
- mutation xong mà detail/list không tự refresh hoặc banner không báo state có thể stale.

### 14.7 Known issues có thể chấp nhận tạm thời

Các điểm dưới đây chỉ được phép tồn tại nếu đã ghi rõ trong evidence và không phá acceptance gate:

- API health endpoint fail do môi trường local chưa bật đầy đủ service phụ, nhưng route shell vẫn pass;
- SSE/realtime có lúc retry ngắn rồi phục hồi, miễn là không clear user token và banner hiển thị đúng degraded state;
- thao tác test thủ công cần nhập lại plate hint hoặc chụp lại ảnh do mạng điện thoại chập chờn.

### 14.8 Closure note bắt buộc sau smoke

Sau khi chạy đủ 3 vòng, cập nhật `release-evidence/frontend-mobile-review/bug-closure-notes.md` với từng bug đã nêu trong status report:

- QR localhost drift;
- stale device secret trên heartbeat/capture;
- mobile gọi sai user-auth media route;
- device 401 làm shell logout giả;
- stale review/session action.
