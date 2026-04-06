# PR-10 — Review Queue + Manual Override + Role-based Control

## Đã chốt

- Thêm queue APIs:
  - `GET /api/gate-review-queue`
  - `POST /api/gate-review-queue/:reviewId/claim`
- Thêm manual override APIs:
  - `POST /api/gate-sessions/:sessionId/manual-approve`
  - `POST /api/gate-sessions/:sessionId/manual-reject`
  - `POST /api/gate-sessions/:sessionId/manual-open-barrier`
- Role guard:
  - queue/claim: `GUARD | OPS | ADMIN`
  - manual approve/reject: `GUARD | OPS | ADMIN`
  - manual open barrier: `OPS | ADMIN`
- Audit payload bắt buộc trên manual endpoints:
  - `reasonCode`
  - `note`
  - `actor`
  - `beforeSnapshot`
  - `afterSnapshot`
- Review queue giờ nhận cả case `PAYMENT_HOLD` thay vì chỉ `REVIEW_REQUIRED`
- Session detail trả thêm `manualReviews[].snapshot`
- Web thêm `ReviewQueuePage` riêng để claim/override
- Vá luôn relation Prisma còn thiếu:
  - `parking_sites.gate_active_presence`

## Lưu ý

- `manual-open-barrier` được triển khai như hardware override có audit đậm, đồng thời sync session về `APPROVED` để review không treo mãi.
- Luồng này **không thay thế** `manual-approve`; nếu cần cập nhật ticket/presence theo nghiệp vụ đầy đủ thì dùng `manual-approve`.
