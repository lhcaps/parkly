# RC1 release checklist — backend senior sign-off

## 1. Clean machine matrix

- [ ] verify deployment chạy được cho profile mục tiêu
- [ ] bootstrap chạy được mà không cần hỏi người viết repo
- [ ] migrate / validate / prisma / grant / seed đi đủ thứ tự
- [ ] login user smoke thật thành công
- [ ] dashboard summary thành công
- [ ] media upload thành công
- [ ] internal intake thành công
- [ ] reconcile refresh thành công
- [ ] incident list + resolve thành công
- [ ] audit list đọc ra row liên quan

## 2. Repeatability

- [ ] `release:reset + smoke:bundle` lặp ít nhất 3 vòng liên tục
- [ ] role smoke không drift
- [ ] `siteCode=SITE_HCM_01` không drift
- [ ] `spotCode=HCM-VIP-01` không drift
- [ ] audit rows tối thiểu vẫn đọc được
- [ ] incident baseline không vỡ do seed/reset

## 3. Release artifacts

- [ ] `.env.example` phản ánh runtime thật
- [ ] `RUNBOOK.md` phản ánh lệnh thật
- [ ] changelog RC đã cập nhật
- [ ] evidence archive đã ghi ra file JSON/MD

## 4. Ready / not-ready decision

### Ready to handoff

- [ ] frontend team có thể chạy smoke/demo mà không cần người viết backend ngồi cạnh
- [ ] dev khác có thể bootstrap từ runbook

### Not claimed

- [ ] enterprise SSO/MFA
- [ ] cloud DR đa vùng
- [ ] production orchestration ngoài local/RC scope
