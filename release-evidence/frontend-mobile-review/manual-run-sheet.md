# Frontend mobile-review smoke run sheet

- Tester:
- Date:
- Web base:
- API base:
- Device under test:
- Build / patch:

## Round 1 — happy path
- [ ] Pair LAN-ready
- [ ] Heartbeat OK hoặc fail đúng secret hiện tại
- [ ] Capture OK hoặc fail đúng context hiện tại
- [ ] Session/review phản ánh state mới

## Round 2 — fresh pair token
- [ ] Pair mới hoàn toàn
- [ ] Không drift origin cũ
- [ ] Không reuse state cũ

## Round 3 — edit secret giữa chừng
- [ ] Query seed secret A
- [ ] Form sửa secret B
- [ ] Heartbeat theo secret B
- [ ] Capture theo secret B
- [ ] Shell không logout vì device 401

## Terminal lock
- [ ] Session terminal khóa action đúng
- [ ] Banner giải thích rõ terminal/state changed

## File đính kèm
- [ ] latest-smoke.json
- [ ] screenshot-pair-origin.png
- [ ] screenshot-mobile-context.png
- [ ] screenshot-heartbeat-status.png
- [ ] screenshot-capture-status.png
- [ ] screenshot-session-review-detail.png
- [ ] screenshot-terminal-lock.png
