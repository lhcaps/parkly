# Frontend route + query param contract

## Mục tiêu
Các route vận hành trọng yếu phải reopen đúng context khi:
- refresh route sâu
- copy/paste URL sang tab mới
- browser back/forward
- handoff giữa shell surfaces

## Quy ước chung
- Chỉ đưa vào URL các state đủ bền để share hoặc reopen.
- Không public secret, token runtime, draft note nhạy cảm, hoặc state ephemeral.
- Query param sai định dạng phải bị normalize về safe default, không được crash page.
- URL là source-of-truth cho shareable state. Runtime hook chỉ giữ phần state ephemeral.

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

## Sync Outbox `/sync-outbox`
- `siteCode`: site filter
- `status`: `PENDING | SENT | FAILED`
- `quick`: `failed | pending | retrying | sent | barrier | review`
- `q`: keyword local filter
- `correlationId`: exact filter
- `requestId`: exact filter
- `entity`: match `entityTable` hoặc `entityId`
- `outboxId`: record đang được chọn trong triage detail

## Reports `/reports`
- `siteCode`: site summary đang mở
- `days`: `1 | 3 | 7 | 14 | 30`

## Parking Live `/parking-live`
### Query params
- `siteCode`: site hiện hành
- `floor`: floor đang focus
- `zone`: zone focus trong floor đang mở
- `status`: `EMPTY | OCCUPIED_MATCHED | OCCUPIED_UNKNOWN | OCCUPIED_VIOLATION | SENSOR_STALE | RESERVED | BLOCKED`
- `q`: keyword spotlight theo spot/zone/plate/subscription
- `spot`: slot đang được chọn trong detail panel
- `density`: `comfortable | compact`

### Deep-link examples
- `/parking-live?siteCode=SITE_HCM_01&floor=F1&density=compact`
- `/parking-live?siteCode=SITE_HCM_01&floor=F2&zone=Z-A&status=BLOCKED&spot=A-12`

### Monitoring contract
- Search chỉ spotlight slot khớp, không làm biến mất slot khỏi board.
- `floor`, `zone`, `status`, `spot`, `density` phải recover được khi refresh hoặc paste URL.
- Khi `spot` không còn hợp lệ theo floor/zone/status hiện tại, detail pane phải tự clear có chủ đích thay vì treo data cũ.
- Floor tabs và zone summary phải hiển thị rõ nơi nào có stale/violation/blocked để operator biết cần drill vào đâu trước.
- Snapshot là authoritative source cho board; SSE chỉ advisory delta để trigger reconcile hoặc refresh nhẹ.
- Khi stream fail nhưng snapshot còn giữ được, board phải ở lại trên màn hình cùng freshness banner thay vì clear dữ liệu.
- Header, connection banner, và detail panel phải cho biết ít nhất: `lastFetchedAt`, `reconciledAt` nếu có, `requestId` hoặc hint khi snapshot lỗi, và trạng thái `connected | retrying | stale | error`.
- Query param sai định dạng (`density`, `status`, `floor`, `zone`, `spot`) phải normalize về safe default và không được làm vỡ board-level state.

## Subscriptions `/subscriptions`
### Query params
- `siteCode`: site filter đang áp dụng
- `status`: `ACTIVE | EXPIRED | SUSPENDED | CANCELLED`
- `plate`: plate search server-side, normalize uppercase
- `id`: subscription đang được chọn trong detail pane
- `tab`: `overview | spots | vehicles`

### Deep-link examples
- `/subscriptions?siteCode=SITE_HCM_01&id=sub_demo_01&tab=vehicles`
- `/subscriptions?siteCode=SITE_HCM_01&status=ACTIVE&plate=43A12345&id=sub_demo_02&tab=spots`

### Deep-link contract
- URL là source-of-truth cho state shareable: `siteCode`, `status`, `plate`, `id`, `tab`.
- Nếu `id` hợp lệ và còn trong result set hiện tại thì detail pane phải mở lại đúng record và đúng tab sau refresh/paste URL.
- Nếu `id` không còn hợp lệ theo filter/result set hiện tại thì app phải clear selection có chủ đích, quay `tab` về `overview`, và render empty-selection state thay vì treo detail cũ.
- `plate` luôn normalize uppercase; `tab` sai giá trị phải fallback về `overview`.
- List empty, empty selection, detail error, và dependency degradation phải là bốn trạng thái tách biệt, không dùng chung wording.

### Workspace lifecycle scope
- Overview tab phải hiển thị summary đủ để operator đọc nhanh: customer, plan, validity, primary vehicle, primary spot, active counts.
- Spots tab và Vehicles tab phải hỗ trợ create/edit/primary/status patch cho role `ADMIN | OPS`.
- Role read-only vẫn được xem full detail nhưng không được thấy CTA mutate.
- Sau mọi mutation thành công, frontend phải resync authoritative detail và list summary thay vì tin vào local optimistic state.

## Run Lane `/run-lane`
- `siteCode`: site context
- `gateCode`: gate context
- `laneCode`: lane context

## Mobile Capture `/mobile-capture`
Mobile capture vẫn nhận context từ pair link hoặc query string đã có sẵn của pair flow. Sau khi capture thành công, handoff button mở:
- `/session-history?siteCode=...&sessionId=...&q=...`
- `/run-lane?siteCode=...&laneCode=...`

## Canonical shell surfaces
Các route canonical trong shell hiện tại:
- `/overview`
- `/run-lane`
- `/review-queue`
- `/session-history`
- `/lane-monitor`
- `/device-health`
- `/sync-outbox`
- `/reports`
- `/mobile-camera-pair`
- `/capture-debug`
- `/subscriptions`
- `/parking-live`
- `/settings`

## Role landing contract
- `ADMIN` -> `/overview`
- `OPS` -> `/overview`
- `GUARD` -> `/run-lane`
- `CASHIER` -> `/reports`
- `WORKER` -> `/lane-monitor`

## Forbidden fallback contract
- Forbidden redirect phải đi qua `/forbidden`, không render nửa trang rồi mới văng.
- `/subscriptions` fallback mặc định:
  - `GUARD` -> `/run-lane`
  - `CASHIER` -> `/reports`
  - `WORKER` -> `/lane-monitor`
- `/parking-live` fallback mặc định:
  - `CASHIER` -> `/reports`
  - `WORKER` -> `/lane-monitor`

## Docs/runtime review gate
Trước khi merge, phải đối chiếu docs này với:
- policy registry của app shell
- smoke output `latest-smoke.json`
- manual QA sign-off của wave hiện tại
