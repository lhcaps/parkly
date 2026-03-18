# Parkly ALPR Service Launcher
# Chạy: .\run.ps1
# Kill port 8765 trước nếu process cũ chưa thoát
Get-NetTCPConnection -LocalPort 8765 -ErrorAction SilentlyContinue | ForEach-Object {
    Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
    Write-Host "[cleaned] Killed PID $($_.OwningProcess) on port 8765"
}
Start-Sleep 1

$venvPython = Join-Path $PSScriptRoot ".venv\Scripts\python.exe"
$mainPy = Join-Path $PSScriptRoot "main.py"

if (-not (Test-Path $venvPython)) {
    Write-Host "[ERROR] Khong tim thay venv Python tai: $venvPython"
    Write-Host "Chay: .\.venv\Scripts\pip.exe install -r requirements.txt"
    exit 1
}

Write-Host "[START] Khoi dong ALPR service tren http://localhost:8765 ..."
Write-Host "Dung process: Ctrl+C hoac tat cua so"
Write-Host ""

& $venvPython $mainPy
