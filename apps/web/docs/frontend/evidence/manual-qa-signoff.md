# Manual QA signoff

- Owner:
- Date:
- Backend profile: local-dev / demo / rc
- Web commit / patch:
- API base:
- Web base:
- Device under test:

## Preconditions
- [ ] Desktop và iPhone cùng subnet
- [ ] Web bind 0.0.0.0 hoặc origin LAN đúng
- [ ] API reachable từ mobile
- [ ] Device secret đúng

## Signoff
- [ ] Pair tạo ra URL LAN-ready, không phải localhost
- [ ] Mobile context summary khớp form hiện tại
- [ ] Heartbeat dùng context hiện tại, không dùng secret cũ
- [ ] Capture đi đúng route device-signed, không gọi media upload user-auth
- [ ] Device 401 không làm shell logout
- [ ] Session/review detail refresh sau mutation
- [ ] Session terminal hiển thị lock banner và khóa action đúng
- [ ] Realtime stale/retry không clear token user
- [ ] Có đủ screenshot, requestId và closure notes

## Notes

