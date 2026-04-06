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

# Hien thi dia chi bind (LAN khi API_HOST=0.0.0.0)
$apiHost = (Get-Content .env -ErrorAction SilentlyContinue | Where-Object { $_ -match '^\s*API_HOST=' }) -replace '^[^=]+=', '' | ForEach-Object { $_.Trim() }
$lanUrl = $null
if ($apiHost -eq '0.0.0.0') {
    $ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notmatch 'Loopback' -and $_.IPAddress -match '^192\.168\.' } | Select-Object -First 1).IPAddress
    if ($ip) { $lanUrl = "http://${ip}:3000" }
}
Write-Host "[OK] Ports clear. Khoi dong API ..."
Write-Host "  Local: http://localhost:3000"
if ($lanUrl) { Write-Host "  LAN:   $lanUrl  (mobile/tablet dung URL nay)" }
Write-Host "Dung process: Ctrl+C hoac tat cua so"
Write-Host ""
pnpm run dev
