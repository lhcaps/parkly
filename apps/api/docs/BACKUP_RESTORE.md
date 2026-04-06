# Backup / Restore / Disaster Drill — BE-PR-24

Mục tiêu của PR này là đưa backend ra khỏi kiểu vận hành “reset tiện tay” và bổ sung đường khôi phục tối thiểu sau sự cố dữ liệu mức vừa.

## 1. RPO / RTO mục tiêu

- Local / demo: **RPO 60 phút**, **RTO 15 phút**.
- Release candidate: **RPO 60 phút**, **RTO 15 phút**.

Đây không phải cam kết enterprise. Nó là baseline hợp lý cho môi trường dự án và demo vận hành local.

## 2. Artifact backup được tạo ra như thế nào

Mỗi lần backup sẽ tạo **một thư mục artifact có timestamp** dưới `BACKUP_ROOT_DIR`.

Ví dụ:

```text
.backups/
  demo-backup-20260313T101112Z/
    manifest.json
    README.txt
    mysql/parking_mgmt.sql
    media/... (nếu driver local)
```

`manifest.json` luôn chốt:

- profile đã tạo backup
- timestamp UTC
- DB artifact path
- media strategy
- retention days
- RPO / RTO mục tiêu
- DB notes để biết backup này có tắt routines/events hay không

## 3. Khi nào dùng reset, khi nào dùng restore

### Dùng `release:reset`

Khi bạn chỉ cần:

- quay về baseline demo sạch;
- replay smoke bundle;
- tự chữa drift dữ liệu nhẹ trong local/demo.

### Dùng `restore:apply`

Khi bạn cần:

- phục hồi **đúng state đã backup**;
- rollback bản demo sau khi dữ liệu bị ghi nhầm;
- khôi phục sau sự cố mất DB / reset nhầm / xóa nhầm artifact local.

Nói ngắn gọn: **reset = về baseline seed**, còn **restore = quay lại một snapshot đã lưu**.

## 4. Lệnh canonical

Tạo backup:

```bash
pnpm --dir apps/api backup:create -- --profile demo
```

Restore từ artifact:

```bash
pnpm --dir apps/api restore:apply -- --profile demo --source .backups/demo-backup-20260313T101112Z --confirm
```

Đừng giữ nguyên placeholder kiểu `.backups/<artifact-dir>`. Hãy thay bằng thư mục thật vừa được `backup:create` in ra.

Verify sau restore:

```bash
pnpm --dir apps/api restore:verify
```

Chạy disaster drill tối thiểu:

```bash
pnpm --dir apps/api drill:disaster:demo
```

## 5. Chiến lược media

### Media local

Khi `MEDIA_STORAGE_DRIVER=LOCAL`, script backup sẽ snapshot:

- `uploads/gate-media`
- `.runtime/observability`

hoặc danh sách path override qua `BACKUP_LOCAL_ARTIFACT_PATHS`.

### MinIO / S3

Khi profile đang dùng `MINIO`, script **không** cố snapshot bucket từ filesystem. Lúc đó manifest sẽ đánh dấu `MINIO_EXTERNAL` và operator phải dùng chiến lược backup bucket riêng ở tầng object storage.

## 6. Lưu ý privilege của mysqldump

Mặc định script chạy theo hướng **portable trước**:

- luôn bật `--no-tablespaces` để không vấp `PROCESS privilege` trên MySQL 8 local;
- mặc định **không** dump routines/events nếu bạn chưa chủ động bật.

Biến môi trường liên quan:

```dotenv
BACKUP_MYSQL_INCLUDE_ROUTINES=OFF
BACKUP_MYSQL_INCLUDE_EVENTS=OFF
```

Lý do là nhiều máy local có user admin vừa đủ cho migrate/grant nhưng vẫn thiếu `SHOW CREATE PROCEDURE` hoặc quyền liên quan tablespace. Với project này, restore sau `release:reset` vẫn an toàn vì schema/procedure đã nằm trong migration baseline; backup ở đây chủ yếu giữ **data state + media state**.

## 7. Verify tối thiểu sau restore

`restore:verify` đi qua 4 điểm:

- `POST /api/auth/login`
- `GET /api/ops/dashboard/summary`
- `GET /api/ops/incidents`
- `GET /api/ops/audit`

Đây là checklist đủ để trả lời ba câu hỏi:

- auth còn dùng được không
- read-model dashboard còn sống không
- operational lists còn đọc được không

## 8. Naming / retention / nơi lưu

- root mặc định: `BACKUP_ROOT_DIR=.backups`
- naming: `<profile>-backup-YYYYMMDDTHHMMSSZ`
- retention demo mặc định: `7` ngày
- retention RC mặc định: `14` ngày

Backup mới tạo sẽ tự prune artifact quá hạn trong `BACKUP_ROOT_DIR` theo retention tương ứng.


## Ghi chú runtime

- nếu `mysql` đóng STDIN sớm trong quá trình restore, script sẽ bỏ qua lỗi `EPIPE` ở tầng stream và surfacing stderr/exit code thật của `mysql`;
- `restore:verify` chỉ có giá trị sau khi `restore:apply` trả `OK`; nếu `restore:apply` fail thì verify chỉ phản ánh trạng thái hiện tại của hệ thống, không chứng minh restore thành công.


## Ghi chú portability của restore

Trong một số máy local MySQL 8, dump có thể chứa `DEFINER=...` hoặc `SET @@SESSION.SQL_LOG_BIN=0` làm lệnh restore bị chặn bởi `SUPER` / `SET_USER_ID`.

Vì vậy `restore:apply` sẽ tự tạo bản SQL portable tạm thời trước khi import:

- strip `DEFINER=...` trong view/trigger metadata;
- strip `SET @@SESSION.SQL_LOG_BIN=0`;
- vẫn giữ nguyên phần schema/data nghiệp vụ chính để restore state dùng được.

Mục tiêu của bước này là **phục hồi được state vận hành local/demo** thay vì cố bám chặt từng metadata privilege-sensitive của dump gốc.
