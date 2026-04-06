# Parkly API — Chay API cho truy cap LAN (mobile/tablet/may khac)
# Chay tren chinh may co IP ghi trong apps/web/.env (VITE_API_BASE_URL).
# Vi du: may cua ban la 192.168.1.84 thi chay script nay tren may do.

$ErrorActionPreference = "Stop"
$apiRoot = Split-Path $PSScriptRoot -Parent   # apps/api
Set-Location $apiRoot

$envPath = Join-Path $apiRoot ".env"
# Dam bao API_HOST=0.0.0.0
$envContent = Get-Content $envPath -Raw -ErrorAction SilentlyContinue
if ($envContent -notmatch 'API_HOST=0\.0\.0\.0') {
    $envContent = ($envContent -replace '(?m)^API_HOST=.*', 'API_HOST=0.0.0.0')
    if ($envContent -notmatch 'API_HOST=') { $envContent = "API_HOST=0.0.0.0`n" + $envContent }
    Set-Content $envPath $envContent -NoNewline
    Write-Host "[OK] Da set API_HOST=0.0.0.0 trong .env"
}

# Mo firewall (yeu cau Admin)
$fwScript = Join-Path $PSScriptRoot "allow-api-firewall.ps1"
Write-Host "[?] Mo port 3000 tren Windows Firewall (can quyen Administrator)..."
Start-Process powershell -ArgumentList "-ExecutionPolicy","Bypass","-File","`"$fwScript`"" -Verb RunAs -Wait

# Khoi dong API
Write-Host ""
& (Join-Path $PSScriptRoot "..\run.ps1")
