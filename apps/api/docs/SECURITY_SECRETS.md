# Security Secrets — Baseline Hardening

BE-PR-32 chốt lớp nền secret hygiene cho hai channel nhạy cảm nhất của backend runtime.
BE-PR-33 mở rộng cùng hai channel đó sang rotation-aware runtime với cặp `ACTIVE` / `NEXT`.


- `API_INTERNAL_SERVICE_TOKEN`
- `DEVICE_CAPTURE_DEFAULT_SECRET`

Mục tiêu của PR này là fail-fast đúng chỗ, giữ demo/local còn chạy được, và chặn hẳn cấu hình ngu khi nâng lên `RELEASE_CANDIDATE` hoặc intent `pilot`.

## 1. Secret nào dùng cho việc gì

### `API_INTERNAL_SERVICE_TOKEN`

Dùng cho internal service calls đi vào API theo trusted channel. Token này không được reuse với capture/device secret. Ở runtime mới, nên ưu tiên dùng:

- `API_INTERNAL_SERVICE_TOKEN_ACTIVE`
- `API_INTERNAL_SERVICE_TOKEN_NEXT`

Legacy alias `API_INTERNAL_SERVICE_TOKEN` vẫn được chấp nhận như primary để không làm gãy môi trường cũ.

### `DEVICE_CAPTURE_DEFAULT_SECRET`

Dùng làm fallback secret để verify device signature cho capture flow khi chưa khai báo per-device secret riêng. Ở runtime mới, nên ưu tiên dùng:

- `DEVICE_CAPTURE_SECRET_ACTIVE`
- `DEVICE_CAPTURE_SECRET_NEXT`

Legacy alias `DEVICE_CAPTURE_DEFAULT_SECRET` vẫn được chấp nhận như primary để không làm gãy môi trường cũ.

## 2. Rule baseline đã chốt

Hai secret trên phải thỏa các điều kiện sau:

- tối thiểu `32` ký tự;
- không placeholder literal;
- không pattern kiểu `changeme`, `placeholder`, `replace-me`, `__SET_ME_*__`;
- không có leading/trailing whitespace;
- không có khoảng trắng hoặc newline ở giữa;
- không reuse cùng một giá trị giữa internal channel và device channel;
- không dùng pattern entropy yếu kiểu lặp một ký tự hoặc block ngắn lặp đi lặp lại.

## 3. Behavior theo profile / intent

### `local-dev` và `demo`

- placeholder hoặc missing secret có thể được giữ ở mức `WARN` để không phá flow local/demo quá sớm;
- nhưng secret quá ngắn, có whitespace, entropy yếu hoặc reuse giữa hai channel vẫn bị coi là cấu hình lỗi.

### `release-candidate`

- `bootstrap` và đặc biệt là `pilot` phải fail nếu còn placeholder hoặc secret trống;
- secret hygiene bẩn phải chặn deploy verify.

## 4. Rotation contract (BE-PR-33)

### Internal service token

```dotenv
API_INTERNAL_SERVICE_TOKEN_ACTIVE=__SET_ME_INTERNAL_TOKEN__
API_INTERNAL_SERVICE_TOKEN_NEXT=
```

### Device capture fallback secret

```dotenv
DEVICE_CAPTURE_SECRET_ACTIVE=__SET_ME_DEVICE_SECRET__
DEVICE_CAPTURE_SECRET_NEXT=
```

Rule runtime:

- chỉ `ACTIVE` => runtime bình thường;
- `ACTIVE` + `NEXT` => rotation window đang bật, cả hai secret đều được accept;
- chỉ `NEXT` => vẫn pass để phục vụ cutover ngắn, nhưng nên promote lại về `ACTIVE` ngay sau khi rollout xong;
- `ACTIVE` và `NEXT` không được trùng nhau;
- nếu vừa set `*_ACTIVE` vừa set legacy alias với giá trị khác nhau thì coi là cấu hình lỗi.

Command canonical cho rotation topology:

```bash
pnpm --dir apps/api secrets:rotation:check
pnpm --dir apps/api secrets:rotation:check -- --format json
```

## 5. Command canonical

Kiểm tra riêng secret hygiene:

```bash
pnpm --dir apps/api secrets:check -- --profile demo --intent smoke
pnpm --dir apps/api secrets:check -- --profile release-candidate --intent bootstrap
pnpm --dir apps/api secrets:check -- --profile release-candidate --intent pilot --format json
```

Kiểm tra preflight đầy đủ có kèm secret hygiene:

```bash
pnpm --dir apps/api verify:deployment -- --profile demo --intent bootstrap
pnpm --dir apps/api verify:deployment -- --profile release-candidate --intent bootstrap
pnpm --dir apps/api verify:deployment -- --profile release-candidate --intent pilot
```

## 6. Generate secret đúng cách

Node.js:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

OpenSSL:

```bash
openssl rand -hex 32
```

## 7. Ví dụ env contract

```dotenv
API_INTERNAL_SERVICE_TOKEN=__SET_ME_INTERNAL_TOKEN__
DEVICE_CAPTURE_DEFAULT_SECRET=__SET_ME_DEVICE_SECRET__
```

Ý nghĩa của ví dụ trên là: đây chỉ là marker để người cấu hình thay thật. Không được mang nguyên literal này vào runtime nghiêm túc.

## 8. Troubleshooting ngắn gọn

### `placeholder-literal`

Bạn đang để nguyên marker hoặc dev token. Hãy thay secret thật.

### `too-short`

Secret chưa đạt ngưỡng tối thiểu 32 ký tự. Tạo lại secret mới.

### `duplicate-secret`

Bạn đang reuse cùng một value cho hai channel. Tách riêng từng channel.

### `leading-trailing-whitespace` hoặc `contains-whitespace`

Secret bị copy dính space/newline. Paste lại sạch hoặc trim tại nơi inject env.

## 9. Rotation rollout ngắn gọn

1. set `*_ACTIVE` bằng secret hiện hành;
2. set `*_NEXT` bằng secret mới;
3. chạy `secrets:check` và `secrets:rotation:check`;
4. rollout client/device/service mới để dùng `NEXT`;
5. verify traffic pass với cả hai;
6. promote `NEXT` -> `ACTIVE`, xoá `NEXT`;
7. chạy lại `secrets:rotation:check` để xác nhận quay về state sạch.

## 10. Những gì BE-PR-33 chưa làm

PR này chưa xử lý các phần sau:

- incident playbook khi nghi ngờ leak secret;
- metrics/health breakdown riêng cho secret mismatch;
- Vault / KMS / secret manager ngoài hạ tầng.

Các phần đó thuộc BE-PR-33 trở đi.

## 8. Secret safety observability

BE-PR-34 bổ sung thêm lớp metrics + health breakdown cho secret mismatch:

- `summary.secretSafety.rejects`: reject counters theo channel/reason;
- `summary.secretSafety.missingAuthHeaders`: đếm request quên auth header;
- `summary.secretSafety.replaySuspicions`: đếm replay/idempotency suspicion;
- `summary.secretSafety.rotationEvents`: đếm event `STARTED` / `COMPLETED` / `ROLLBACK`;
- `summary.secretSafety.hints`: spike hint để operator triage nhanh.

Env threshold mặc định:

```bash
OBS_SECRET_REJECT_SPIKE_THRESHOLD=5
```

Khi rollout hoặc rollback secret, ghi audit event bằng command:

```bash
pnpm --dir apps/api secrets:rotation:audit -- --action started --field internal-service
pnpm --dir apps/api secrets:rotation:audit -- --action completed --field internal-service
pnpm --dir apps/api secrets:rotation:audit -- --action rollback --field internal-service
```

Các snapshot audit chỉ chứa `masked` + `fingerprint`, không chứa raw secret.

## 9. Pilot gate hardening

BE-PR-35 thêm lớp gate nghiêm hơn cho runtime `release-candidate`:

- `pilot:gate` sẽ không chỉ check hygiene mà còn bắt `ACTIVE` env phải hiện diện rõ ràng;
- `secrets:rotation:check -- --require-active` fail nếu primary vẫn đi qua legacy alias;
- `verify:deployment -- --intent pilot` bây giờ có thêm `securityRotation` để phản ánh topology rotation trong report.

Command chuẩn:

```bash
pnpm --dir apps/api secrets:rotation:check -- --require-active --format json
pnpm --dir apps/api pilot:gate
```

Mục tiêu của lớp này là chặn hẳn các case sau trước khi handoff pilot:

- placeholder/dev literal còn lọt vào runtime;
- `*_ACTIVE` còn trống;
- `ACTIVE` / `NEXT` trùng nhau;
- `legacy` và `ACTIVE` lệch nhau;
- evidence artifact không được tạo.
