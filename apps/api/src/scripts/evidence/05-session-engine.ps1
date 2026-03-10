param(
  [string]$BaseUrl = "http://127.0.0.1:3000",
  [string]$Token = "dev-admin-token"
)

$headers = @{ Authorization = "Bearer $Token"; 'Content-Type' = 'application/json' }
$ts1 = (Get-Date).ToUniversalTime().ToString('o')
$ts2 = (Get-Date).ToUniversalTime().ToString('o')
$rid1 = "pr05_sensor_$([DateTimeOffset]::UtcNow.ToUnixTimeSeconds())"
$idem1 = "idem_pr05_sensor_$([DateTimeOffset]::UtcNow.ToUnixTimeSeconds())"
$rid2 = "pr05_alpr_$([DateTimeOffset]::UtcNow.ToUnixTimeSeconds())"
$idem2 = "idem_pr05_alpr_$([DateTimeOffset]::UtcNow.ToUnixTimeSeconds())"

Write-Host '== 1) SENSOR PRESENT => WAITING_READ =='
$open = Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/gate-sessions/open" -Headers $headers -Body (@{
  requestId = $rid1
  idempotencyKey = $idem1
  siteCode = 'SITE_HCM_01'
  laneCode = 'GATE_01_ENTRY'
  direction = 'ENTRY'
  occurredAt = $ts1
  deviceCode = 'GATE_01_ENTRY_LOOP'
  readType = 'SENSOR'
  sensorState = 'PRESENT'
  presenceActive = $true
  rawPayload = @{ source = 'pr05-evidence' }
} | ConvertTo-Json -Depth 10)
$open | ConvertTo-Json -Depth 10
$sessionId = $open.data.session.sessionId

Write-Host "`n== 2) ALPR => WAITING_DECISION cùng session =="
$resolve = Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/gate-sessions/resolve" -Headers $headers -Body (@{
  requestId = $rid2
  idempotencyKey = $idem2
  sessionId = $sessionId
  occurredAt = $ts2
  deviceCode = 'GATE_01_ENTRY_CAMERA'
  readType = 'ALPR'
  plateRaw = '51A12345'
  ocrConfidence = 0.98
  reasonCode = 'EVIDENCE_CAPTURED'
  reasonDetail = 'PR05 evidence flow'
} | ConvertTo-Json -Depth 10)
$resolve | ConvertTo-Json -Depth 12

Write-Host "`n== 3) Session detail =="
$detail = Invoke-RestMethod -Method Get -Uri "$BaseUrl/api/gate-sessions/$sessionId" -Headers @{ Authorization = "Bearer $Token" }
$detail | ConvertTo-Json -Depth 20
