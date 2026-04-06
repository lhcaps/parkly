# Release sign-off runbook

## Muc tieu
Day la checklist chuan de bien wave FE v7 tu implemented-but-pending-verification thanh baseline co evidence va sign-off that.

## Lenh chuan
Tu `apps/web`:
```bash
pnpm release:signoff -- --apiUrl http://127.0.0.1:3000/api --backendProfile local-dev --commitHash <commit>
```

## Thu tu thuc thi bat buoc
1. Build
2. Unit tests
3. Playwright runtime check
4. E2E
5. Smoke dev tren 5173
6. Smoke dist tren 4173
7. Collect evidence
8. Dien manual QA matrix
9. Reviewer ky `release-signoff.md`

## Definition of done
- Build, unit, E2E, smoke dev, smoke dist deu pass lai tu baseline hien tai
- Bundle evidence co du log, screenshot, manifest
- Manual QA matrix theo role duoc dien
- `release-signoff.md` khong con cau chu kieu pending rerun
- Reviewer moi co the lap lai sign-off khong can hoi mieng
