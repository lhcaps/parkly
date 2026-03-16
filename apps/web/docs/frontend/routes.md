# Frontend route + query param contract

## Mục tiêu
Các route vận hành trọng yếu phải mở lại đúng context khi:
- refresh route sâu
- copy/paste URL sang tab mới
- browser back/forward
- handoff giữa Review Queue, Session History, Audit Viewer, Sync Outbox, Reports, Run Lane

## Quy ước chung
- Chỉ đưa vào URL các state đủ bền để share hoặc reopen.
- Không public secret, token runtime, draft note nhạy cảm, hoặc state ephemeral.
- Query param sai định dạng phải bị normalize về safe default, không được crash page.

## Review Queue `/review-queue`
- `siteCode`: site hiện hành
- `status`: `OPEN | CLAIMED | RESOLVED | CANCELLED`
- `q`: keyword local filter
- `from`: `datetime-local`
- `to`: `datetime-local`
- `reviewId`: review đang được chọn

### Handoff
- Review Queue -> Session History truyền `siteCode`, `sessionId`, và `q` theo plate/session.
- Review Queue -> Audit Viewer truyền `siteCode` + `correlationId` khi session đang có lineage.

## Session History `/session-history`
- `siteCode`: site hiện hành
- `laneCode`: lane filter
- `status`: session status backend support
- `direction`: `ENTRY | EXIT`
- `q`: keyword/filter server-side
- `from`: `datetime-local`
- `to`: `datetime-local`
- `sessionId`: session đang được chọn trong detail panel

### Handoff
- Session History -> Audit Viewer truyền `siteCode`, `correlationId`, `q=sessionId`.
- Session History -> Review Queue truyền `siteCode`, `q=sessionId`.

## Audit Viewer `/audit-viewer`
- `siteCode`: site filter
- `quick`: `request | correlation | manual | gate-session | barrier`
- `action`: action filter
- `q`: keyword local filter
- `correlationId`: exact filter
- `requestId`: exact filter
- `entityTable`: exact filter
- `entityId`: exact filter
- `actorUserId`: exact filter
- `auditId`: record đang được chọn

### Handoff
- Audit Viewer nhận context từ Session History hoặc Sync Outbox.
- Cursor pagination không được persist vào URL; khi query filter đổi hoặc back/forward thì cursor reset về root để tránh mồ côi snapshot.

## Sync Outbox `/sync-outbox`
- `siteCode`: site filter
- `status`: `PENDING | SENT | FAILED`
- `quick`: `failed | pending | retrying | sent | barrier | review`
- `q`: keyword local filter
- `correlationId`: exact filter
- `requestId`: exact filter
- `entity`: match `entityTable` hoặc `entityId`
- `outboxId`: record đang được chọn trong triage detail

### Handoff
- Sync Outbox -> Audit Viewer dùng `correlationId` hoặc `requestId`.
- Sync Outbox -> Session History dùng `sessionId` nếu payload có lineage.

## Reports `/reports`
- `siteCode`: site summary đang mở
- `days`: `1 | 3 | 7 | 14 | 30`

## Run Lane `/run-lane`
- `siteCode`: site context
- `gateCode`: gate context
- `laneCode`: lane context

### Lưu ý
- Capture draft, preview result, override plate, submit result không đưa lên URL.
- URL chỉ giữ đủ context để bootstrap lại topology đúng lane khi refresh.

## Mobile Capture `/mobile-capture`
Mobile capture vẫn nhận context từ pair link hoặc query string đã có sẵn của pair flow. Sau khi capture thành công, handoff button mở:
- `/session-history?siteCode=...&sessionId=...&q=...`
- `/run-lane?siteCode=...&laneCode=...`

## Smoke sanity tối thiểu
1. Copy URL từ Review Queue, Session History, Audit Viewer, Sync Outbox sang tab mới phải mở đúng context.
2. Refresh route sâu không trắng màn hình.
3. Query param sai định dạng phải tự normalize.
4. Browser back/forward phải restore lại filter state cốt lõi.
