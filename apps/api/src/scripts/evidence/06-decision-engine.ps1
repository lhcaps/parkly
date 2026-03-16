param(
  [string]$BaseUrl = "http://127.0.0.1:3000",
  [string]$Token = ""
)

$headers = @{ "Content-Type" = "application/json" }
if ($Token) { $headers["Authorization"] = "Bearer $Token" }

function New-Rid {
  "rid-" + [guid]::NewGuid().ToString("N").Substring(0, 16)
}

Write-Host "PR06 evidence starter"
Write-Host "BaseUrl: $BaseUrl"
Write-Host "Token attached:" ([bool]$Token)
Write-Host ""
Write-Host "1) Mở session bằng sensor"
$openBody = @{
  requestId = New-Rid
  idempotencyKey = New-Rid
  siteCode = "SITE_HCM_01"
  laneCode = "GATE_01_EXIT"
  direction = "EXIT"
  occurredAt = [DateTime]::UtcNow.ToString("o")
  deviceCode = "GATE_01_EXIT_LOOP"
  readType = "SENSOR"
  sensorState = "PRESENT"
  rawPayload = @{ source = "pr06-evidence.ps1" }
} | ConvertTo-Json -Depth 10

$open = Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/gate-sessions/open" -Headers $headers -Body $openBody
$sessionId = $open.data.session.sessionId
$open | ConvertTo-Json -Depth 10

Write-Host ""
Write-Host "2) Resolve bằng ALPR để nhận decision thật"
$resolveBody = @{
  requestId = New-Rid
  idempotencyKey = New-Rid
  sessionId = $sessionId
  occurredAt = [DateTime]::UtcNow.ToString("o")
  deviceCode = "GATE_01_EXIT_CAMERA"
  readType = "ALPR"
  plateRaw = "51A12345"
  ocrConfidence = 0.62
  rawPayload = @{ source = "pr06-evidence.ps1" }
} | ConvertTo-Json -Depth 10

$resolved = Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/gate-sessions/resolve" -Headers $headers -Body $resolveBody
$resolved | ConvertTo-Json -Depth 12

Write-Host ""
Write-Host "3) Đọc session detail để xem decisions + timeline"
$detail = Invoke-RestMethod -Method Get -Uri "$BaseUrl/api/gate-sessions/$sessionId" -Headers $headers
$detail | ConvertTo-Json -Depth 20
