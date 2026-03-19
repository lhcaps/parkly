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

# Set environment variables for Windows to avoid PaddleOCR oneDNN/PIR errors
# CRITICAL: These must be set BEFORE Python imports torch/paddle
$env:FLAGS_use_mkldnn = "0"
$env:FLAGS_use_onednn = "0"
$env:FLAGS_enable_pir_in_executor = "0"
$env:FLAGS_enable_pir_api = "0"
$env:FLAGS_use_mkldnn_bfloat16 = "0"
$env:FLAGS_onednn_allow_bf16 = "0"
# Disable model source check to speed up startup
$env:PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK = "True"
# Disable PyTorch shared memory on Windows (can cause DLL errors)
$env:PYTORCH_DISABLE_SHM = "1"
# Force Paddle to use legacy executor (disable PIR)
$env:NEW_EXECUTOR = "0"
$env:GFLAGS_use_pir_mode = "0"

Write-Host "[INFO] Windows flags set: FLAGS_use_onednn=0, FLAGS_enable_pir_in_executor=0, NEW_EXECUTOR=0, PYTORCH_DISABLE_SHM=1"

# Optional: Set CPU mode explicitly if no GPU
# $env:CUDA_DEVICE = "cpu"

# Optional: Enable debug logging
# $env:LOG_LEVEL = "DEBUG"

# Optional: Skip models for debugging
# $env:SKIP_YOLO = "1"
# $env:SKIP_OCR = "1"

& $venvPython $mainPy
