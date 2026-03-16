# PR-02 Patch Notes

## Những gì đã làm
- bỏ logic plate local khỏi web app; `src/lib/plate-parser.ts` và `src/lib/plate-rules.ts` giờ chỉ còn adapter re-export từ `@parkly/gate-core`
- thêm workspace deps `@parkly/gate-core` và `@parkly/contracts`
- `PlateCanonicalDto` trong `src/lib/api.ts` lấy từ contracts package thay vì tự khai báo tại web
- UI vẫn preview bằng shared core, nhưng authoritative result vẫn lấy từ backend response như cũ

## Cần copy thêm ở monorepo root
- `packages/gate-core`
- `packages/contracts`
