# Parkly — Evidence Pack

Tài liệu này gom evidence theo hai lớp:

- **backend evidence pack** để chứng minh luồng nghiệp vụ và metrics cốt lõi;
- **frontend smoke / evidence pack** để chứng minh operator flow desktop + iPhone đã đóng được các bug FE-PR-01 đến FE-PR-04.

Không dùng evidence kiểu “nhìn có vẻ chạy”. Mỗi bước phải có screenshot hoặc requestId hoặc log tương ứng.

## 1. Backend evidence pack

### 1.1 Script chính

```text
apps/api/src/scripts/evidence/evidence-pack.ps1
```

### 1.2 Scenarios có sẵn

- `entry-happy`
- `exit-paid`
- `exit-unpaid`
- `low-confidence-review`
- `anti-passback-blocked`
- `barrier-timeout`
- `all`

### 1.3 Cách chạy

Từ root monorepo:

```powershell
pwsh -File .\apps\api\src\scripts\evidence\evidence-pack.ps1 -BaseUrl http://127.0.0.1:3000 -Token <OPS_OR_ADMIN_TOKEN> -Scenario all
```

### 1.4 Kỳ vọng từng scenario

#### entry-happy

- session mở bằng sensor;
- resolve bằng ALPR/RFID;
- decision ra `APPROVE`;
- ticket/presence/barrier được xử lý theo flow ENTRY.

#### exit-paid

- tìm thấy open ticket;
- payment state hợp lệ (`PAID`, `WAIVED`, hoặc `SUBSCRIPTION_COVERED`);
- barrier `OPEN`;
- ticket close;
- active presence clear.

#### exit-unpaid

- payment state là `UNPAID` hoặc `PENDING`;
- barrier không mở;
- session dừng ở `WAITING_PAYMENT` hoặc vào review phù hợp;
- explanation đọc được.

#### low-confidence-review

- decision không silent approve;
- có `reasonCode` rõ;
- queue nhận review item;
- UI đọc được explanation.

#### anti-passback-blocked

- cùng site, cùng plate hoặc RFID đang active presence;
- decision bị block hoặc review;
- explanation nói rõ anti-passback.

#### barrier-timeout

- command đi `PENDING -> SENT -> TIMEOUT`;
- lane aggregate health chuyển `BARRIER_FAULT`;
- metric `gate_barrier_ack_timeout_total` tăng;
- outbox monitor thấy row liên quan.

## 2. Frontend smoke / evidence pack cho Mobile Capture và Review Workflow

### 2.1 Mục tiêu

Chốt bằng chứng cho các bug đã nêu trong status report gần nhất:

- QR pair drift về `localhost`;
- heartbeat/capture ký bằng secret cũ;
- mobile flow gọi nhầm route user-auth;
- device-signed `401` làm auth shell logout giả;
- review/session UI stale sau khi backend đã terminal hoặc state đã đổi.

### 2.2 Preconditions bắt buộc

- desktop và iPhone cùng subnet;
- web bind `0.0.0.0`;
- `VITE_PUBLIC_WEB_ORIGIN` hoặc origin tab hiện tại là origin LAN thực;
- API reachable từ điện thoại;
- device secret đúng;
- operator có user hợp lệ để xem review/session.

### 2.3 One-pass flow chuẩn

1. Desktop tạo pair mới.
2. iPhone mở link pair.
3. Kiểm tra mobile context summary.
4. Heartbeat với context đang hiển thị.
5. Capture với đúng context đó.
6. Trên desktop xác minh session/review detail đổi tương ứng.
7. Thực hiện một review action hợp lệ nếu có.
8. Tạo hoặc mở một case terminal để xác minh terminal lock.

### 2.4 Evidence schema cho từng bước

Mỗi bước phải lưu tối thiểu các trường sau:

| Bước | Screenshot | RequestId | Log / network | Expected result |
|---|---|---|---|---|
| Pair | QR card hoặc pair card | Không bắt buộc | Copy link hoặc active pairs table | Origin LAN đúng, không phải localhost |
| Mobile preflight | Context summary card | Không bắt buộc | Nếu có debug panel thì chụp thêm | Context đang hiển thị khớp form |
| Heartbeat | Status card sau heartbeat | Có nếu backend trả | Network/log route device-signed | Không dùng secret cũ |
| Capture | Status card sau capture | Có nếu backend trả | Network/log route capture | Không gọi `/api/media/upload` |
| Session / review | Detail panel sau mutation | Nếu mutation trả | Log hoặc banner state-changed | Detail và list cùng refresh |
| Terminal lock | Lock banner | Không bắt buộc | Nếu có 409 thì chụp banner lỗi | UI khóa đúng khi session terminal |

### 2.5 Gate criteria

#### Fail gate ngay

- QR/link sinh `localhost`, `127.0.0.1`, hoặc origin sai subnet khi đang test LAN;
- heartbeat/capture còn dùng secret cũ sau khi user đã sửa form;
- bất kỳ request nào từ mobile flow đi vào `/api/media/upload`;
- `401` từ device-signed endpoint làm shell logout hoặc báo auth expired;
- session terminal nhưng UI vẫn cho thao tác chính;
- mutation xong mà không refresh lại detail/list hoặc không báo state có thể stale khi refresh lỗi.

#### Có thể chấp nhận tạm thời nếu đã ghi rõ evidence

- SSE/realtime retry ngắn rồi phục hồi, miễn là không clear user token;
- API health local fail do môi trường chưa bật hết dependency, miễn là route shell và flow cần test vẫn hoạt động;
- cần chụp lại ảnh hoặc chạy lại capture do điều kiện mạng/thiết bị chập chờn nhưng context và auth surface vẫn đúng.

### 2.6 Chu kỳ 3 vòng lặp tối thiểu

- **Lần 1:** happy path đầy đủ đến session hoặc review expected state.
- **Lần 2:** pair mới hoàn toàn để chặn reuse state cũ sai origin.
- **Lần 3:** edit secret giữa chừng để chứng minh live effective context thắng query seed.

Ba vòng này là tối thiểu. Ít hơn thì evidence không đủ mạnh để đóng bug regression.

### 2.7 Bug closure note template

Dùng mẫu dưới đây cho `release-evidence/frontend-mobile-review/bug-closure-notes.md`:

```md
## <bug-name>
- Status: CLOSED / OPEN / PARTIAL
- Verified on: <date-time>
- Build / patch: <id>
- Evidence:
  - screenshot: <file>
  - requestId: <id or n/a>
  - smoke run: <run id>
- Notes:
  - <ngắn gọn, không vòng vo>
```

### 2.8 Day-2 operator checklist

Trước khi báo bug mới, operator phải tự check 5 câu này:

1. Link pair hiện tại có còn là origin LAN đúng không?
2. Context summary trên mobile có khớp form thật không?
3. Lỗi đang xảy ra ở user-auth surface hay device-signed surface?
4. Session hiện tại đã terminal chưa?
5. Có requestId hoặc screenshot nào chứng minh lỗi thuộc FE, BE, hay môi trường chưa?

## 3. Artifact layout đề xuất

```text
docs/RUNBOOK.md
apps/web/scripts/smoke-web.mjs
apps/web/docs/frontend/evidence/latest-smoke.json
release-evidence/frontend-mobile-review/manual-run-sheet.md
release-evidence/frontend-mobile-review/bug-closure-notes.md
release-evidence/frontend-mobile-review/round-1/
release-evidence/frontend-mobile-review/round-2/
release-evidence/frontend-mobile-review/round-3/
```

## 4. Lưu ý cho reviewer nội bộ

- Không tranh cãi bằng mô tả miệng. Mở artifact và xem requestId/screenshot tương ứng.
- Nếu chỉ có một lần pass nhưng không có vòng 2, vòng 3 thì chưa gọi là đóng regression.
- Nếu shell smoke pass nhưng operator flow fail, kết luận đúng phải là “route shell ổn nhưng flow nghiệp vụ FE chưa đóng”, không được trộn hai loại evidence với nhau.
