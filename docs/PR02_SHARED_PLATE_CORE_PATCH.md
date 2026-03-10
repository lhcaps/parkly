# PR-02 — Shared Plate Core + Backend Authoritative Plate Result

## Những gì đã chốt trong patch này
- `packages/gate-core` export rõ public API thay vì wildcard mơ hồ.
- thêm type output rõ cho `normalizePlate()`.
- `packages/contracts` có thêm schema/body/response cho plate-related surfaces.
- backend reject canonical spoof theo kiểu **recursive**, không chỉ ở top-level.
- `reviewRequired` được xem là authoritative field, client không được tự gửi nữa.
- thêm helper `deriveAuthoritativePlateResult()` để chốt:
  - so khớp `licensePlateRaw` và `alprResult.plate`
  - reject plate invalid ở write surfaces
  - backend là authority duy nhất cho canonical result
- `POST /api/gate-events` trả thêm `plate` object authoritative, đồng thời vẫn giữ flatten fields để không phá UI cũ.
- `POST /api/alpr/recognize` trả:
  - `recognizedPlate`
  - flatten canonical fields
  - `plate` object authoritative
- `POST /api/gate-reads/alpr` reject plate invalid và trả thêm `plate` object authoritative.
- `POST /api/gate-sessions/open` và `POST /api/gate-sessions/resolve` trả thêm `plate` object authoritative nếu request có plate.
- web `GatePage` không còn tự đẩy `reviewRequired: true`; giờ lấy authoritative result từ backend rồi submit lại `plateRaw`/evidence để backend tự quyết định.
- thêm test file:
  - `apps/api/src/tests/pr02-shared-plate-core.test.ts`

## Hành vi được khóa lại
- FE chỉ preview bằng shared core.
- BE mới là authority.
- spoof canonical fields trong `rawPayload.plateEngine.*` cũng bị reject.
- mismatch giữa `licensePlateRaw` và `alprResult.plate` bị reject.
- plate invalid ở write surfaces bị reject.

## Validate đã làm trong môi trường này
- `apps/web` TypeScript check pass với `tsc --noEmit`.
- chạy inline checks cho các case:
  - valid plate
  - invalid plate
  - OCR ambiguous -> review
  - nested canonical spoof -> BAD_REQUEST
  - mismatch raw/alpr -> BAD_REQUEST
  - invalid write surface -> BAD_REQUEST

## Thứ chưa xác nhận full trong container này
- full `apps/api` typecheck vẫn đang có sẵn nhiều lỗi Prisma/Express typing cũ ngoài phạm vi PR-02.
- script `node --import tsx --test ...` trong repo local chưa chạy được sạch do local dependency state của `tsx` trong zip đang thiếu `get-tsconfig`.
