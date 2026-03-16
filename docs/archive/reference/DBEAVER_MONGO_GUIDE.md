# DBeaver & MongoDB Compass Guide

## A) DBeaver (MySQL)

Khuyến nghị tạo **2 connection profile**:

### 1) ROOT (parking_root — schema admin)

Dùng để:

- chạy `db/scripts/bootstrap.sql` (chỉ lần đầu trên máy sạch)
- chạy `db/scripts/grants_parking_app.sql` (đổi profile quyền cho parking_app)
- kill sessions khi kẹt pool
- quan sát dữ liệu (SELECT)

### 2) APP (parking_app — runtime user)

Dùng để:

- chứng minh **least-privilege** (LOG-ONLY)
- chạy scripts Node theo đúng user runtime

> Tip thực tế: khi chạy scripts Node (tsx), hạn chế mở nhiều tab query bằng **APP** để tránh tình trạng pool contention/P2028.

## B) MongoDB Compass

Sau khi chạy `pnpm outbox:drain`, xem:

- DB: `parking_logs` (theo `.env` / `.env.example`)
- Collection: `device_events`

Document sẽ chứa:

- `mysql_event_id`, `site_id`, `event_time`
- `payload` (raw JSON, linh hoạt để demo log telemetry)
