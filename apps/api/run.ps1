# Parkly API Launcher
# Chay: .\run.ps1 (trong thu muc apps/api)
Write-Host "[START] Khoi dong Parkly API ..."

# Dọn port 3000 (API chính)
$p = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | Select-Object -First 1
if ($p) {
    Write-Host "[WARN] Port 3000 dang su dung boi PID $($p.OwningProcess). Killing..."
    Stop-Process -Id $p.OwningProcess -Force -ErrorAction SilentlyContinue
    Start-Sleep 2
}

# Dọn port 3001 (backup)
$p2 = Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue | Select-Object -First 1
if ($p2) {
    Write-Host "[WARN] Port 3001 dang su dung boi PID $($p2.OwningProcess). Killing..."
    Stop-Process -Id $p2.OwningProcess -Force -ErrorAction SilentlyContinue
    Start-Sleep 1
}

Write-Host "[OK] Ports clear. Khoi dong API tren http://localhost:3000 ..."
Write-Host "Dung process: Ctrl+C hoac tat cua so"
Write-Host ""
pnpm run dev
