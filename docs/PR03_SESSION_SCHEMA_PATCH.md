# PR-03 — Session Schema Foundation + Lane/Device Topology + Media Evidence

## Đã làm
- thêm migration `apps/api/db/migrations/V13__gate_media_evidence.sql`
- thêm bảng `gate_read_media`
- mở rộng `gate_read_events` với evidence metadata:
  - `source_media_id`
  - `raw_ocr_text`
  - `camera_frame_ref`
  - `crop_ref`
  - `source_device_code`
  - `source_capture_ts`
- backend capture ingest (`ingest-alpr-read`, `ingest-rfid-read`, `ingest-sensor-read`) giờ persist evidence metadata có chủ đích thay vì chỉ nhét vào `payload_json`
- `getGateSessionDetail()` trả thêm:
  - evidence metadata trong từng read
  - `manualReviews`
  - `incidents`
  - timeline có cả `REVIEW` và `INCIDENT`
- seed `seed_min.sql` và `seed_big.sql` có thêm bước sync `gate_lanes.primary_device_id` theo `gate_lane_devices.is_primary`

## File chính đã sửa
- `apps/api/db/migrations/V13__gate_media_evidence.sql`
- `apps/api/prisma/schema.prisma`
- `apps/api/db/seed/seed_min.sql`
- `apps/api/db/seed/seed_big.sql`
- `apps/api/src/modules/gate/infrastructure/gate-read-events.repo.ts`
- `apps/api/src/modules/gate/application/ingest-alpr-read.ts`
- `apps/api/src/modules/gate/application/ingest-rfid-read.ts`
- `apps/api/src/modules/gate/application/ingest-sensor-read.ts`
- `apps/api/src/modules/gate/application/resolve-session.ts`
- `apps/web/src/lib/api.ts`

## SQL evidence tối thiểu

### 1) lane -> devices
```sql
SELECT
  ps.site_code,
  gl.gate_code,
  gl.lane_code,
  gl.direction,
  gd.device_code,
  gd.device_type,
  gld.device_role,
  gld.is_primary,
  gld.is_required,
  gld.sort_order
FROM parking_sites ps
JOIN gate_lanes gl ON gl.site_id = ps.site_id
LEFT JOIN gate_lane_devices gld ON gld.lane_id = gl.lane_id
LEFT JOIN gate_devices gd ON gd.device_id = gld.device_id
WHERE ps.site_code = 'SITE_HCM_01'
ORDER BY gl.gate_code, gl.sort_order, gld.sort_order, gd.device_code;
```

### 2) session -> reads -> decisions -> barrier -> review -> incidents
```sql
SELECT gps.session_id, gps.status, gl.lane_code, gl.direction, ps.site_code
FROM gate_passage_sessions gps
JOIN gate_lanes gl ON gl.lane_id = gps.lane_id
JOIN parking_sites ps ON ps.site_id = gps.site_id
WHERE gps.session_id = ?;

SELECT gre.read_event_id, gre.read_type, gre.plate_compact, gre.raw_ocr_text,
       gre.source_device_code, gre.source_capture_ts, gre.source_media_id
FROM gate_read_events gre
WHERE gre.session_id = ?
ORDER BY gre.occurred_at, gre.read_event_id;

SELECT decision_id, decision_code, final_action, reason_code, created_at
FROM gate_decisions
WHERE session_id = ?
ORDER BY created_at, decision_id;

SELECT command_id, command_type, status, issued_at, ack_at
FROM gate_barrier_commands
WHERE session_id = ?
ORDER BY issued_at, command_id;

SELECT review_id, status, queue_reason_code, created_at
FROM gate_manual_reviews
WHERE session_id = ?
ORDER BY created_at, review_id;

SELECT incident_id, severity, status, incident_type, created_at
FROM gate_incidents
WHERE session_id = ?
ORDER BY created_at, incident_id;
```

### 3) read event có evidence/media linkage
```sql
SELECT
  gre.read_event_id,
  gre.read_type,
  gre.plate_raw,
  gre.raw_ocr_text,
  gre.camera_frame_ref,
  gre.crop_ref,
  gre.source_device_code,
  gre.source_capture_ts,
  grm.media_id,
  grm.storage_kind,
  grm.media_url,
  grm.file_path,
  grm.mime_type
FROM gate_read_events gre
LEFT JOIN gate_read_media grm ON grm.media_id = gre.source_media_id
WHERE gre.source_media_id IS NOT NULL
ORDER BY gre.read_event_id DESC;
```
