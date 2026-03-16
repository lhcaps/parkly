# PR-02 Patch Notes

## Những gì đã làm
- thêm helper `src/server/plate-authority.ts` để chặn client gửi canonical plate fields giả
- `POST /api/gate-events` reject các field authoritative như `plateDisplay`, `plateValidity`, ... nếu client cố gửi lên
- `POST /api/gate-reads/alpr` cũng reject canonical plate fields do client tự nhét vào
- `POST /api/gate-sessions/open` và `POST /api/gate-sessions/resolve` chỉ nhận `plateRaw`; canonical fields phải do backend tự derive

## Cần copy thêm ở monorepo root
- `packages/gate-core`
- `packages/contracts`
