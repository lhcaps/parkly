# PR-01 Master Data Patch

## Đã chỉnh trong bản zip này

- Chuẩn hóa `packages/contracts` cho:
  - `SiteRow`
  - `GateRow`
  - `LaneRow`
  - `DeviceRow`
  - list response schemas cho `/sites`, `/gates`, `/lanes`, `/devices`
- Backend `/api/gates` và `/api/lanes` parse response theo contract chung trước khi trả ra.
- Backend ưu tiên resolve primary device từ `gate_lane_devices.is_primary = 1`, chỉ fallback sang `gate_lanes.primary_device_id` khi cần.
- `resolveDefaultDeviceCode()` không còn chọn bừa device đầu tiên của site nếu lane foundation đã có; giờ ưu tiên device primary theo lane order.
- Web `GatePage` hiển thị lane rõ hơn: `laneCode · direction · deviceType · primaryDeviceCode`.
- Web `DevicesPage` bỏ phần mô tả sai về backend, chuyển sang đọc thật từ `/api/devices` và render inventory + heartbeat theo từng lane.

## Phạm vi chưa đụng trong patch này

- Không thay migration cũ.
- Không thêm migration mới.
- Không đập lại seed hiện có vì `seed_min.sql` / `seed_big.sql` đã ở trạng thái multi-site và có `ON DUPLICATE KEY UPDATE` cho phần topology chính.
- Chưa làm SSE / aggregate lane health / review queue vì đó là PR sau.
