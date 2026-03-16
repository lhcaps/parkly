# Frontend performance budget

## Mục tiêu H07

Không chase benchmark vô nghĩa. Mục tiêu là giữ boot hợp lý, route nặng có lazy fallback rõ, và không để bundle tăng vô kiểm soát sau mỗi vòng hardening.

## Budget hiện tại

- Initial JS entry budget: **180 kB**
- Route chunk budget: **90 kB / chunk**
- Route nặng cần theo dõi riêng:
  - Audit Viewer
  - Session History
  - Reports
  - Mobile Capture
  - Run Lane

## Cách đọc output build

Sau `pnpm build:web`, file `dist/performance-budget.json` sẽ được ghi ra với:

- danh sách chunks
- kích thước từng chunk
- tổng initial JS entry
- warning nào đang vượt budget

## Quy tắc review

- Không merge nếu correctness/hydration vỡ chỉ vì tối ưu.
- Route lazy phải luôn có copy loading rõ, không blank trắng.
- Cache chỉ dùng cho read-mostly topology/system/report summary; không cache mutation.
- Chỉ xem xét virtualization khi log thật cho thấy list lớn gây lag rõ.

## Profiling note tối thiểu

Trong dev mode, metric tương tác được ghi vào `window.__parklyPerfMetrics` và log console dưới prefix `parkly:perf`.
