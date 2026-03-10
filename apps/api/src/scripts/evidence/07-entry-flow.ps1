$base = "http://127.0.0.1:3000"
$now = (Get-Date).ToUniversalTime().ToString("o")

Write-Host "== 1) ENTRY sensor open =="
$open = Invoke-RestMethod -Method Post -Uri "$base/api/gate-sessions/open" -ContentType "application/json" -Body (@{
  requestId = "pr07-open-001"
  idempotencyKey = "pr07-open-001-key"
  siteCode = "SITE_HCM_01"
  laneCode = "GATE_01_ENTRY"
  direction = "ENTRY"
  occurredAt = $now
  deviceCode = "GATE_01_ENTRY_LOOP"
  readType = "SENSOR"
  sensorState = "PRESENT"
  presenceActive = $true
  rawPayload = @{ source = "evidence-pr07" }
} | ConvertTo-Json -Depth 10)
$open | ConvertTo-Json -Depth 10
$sessionId = $open.data.session.sessionId

Write-Host "== 2) ENTRY ALPR resolve happy path =="
$resolve = Invoke-RestMethod -Method Post -Uri "$base/api/gate-sessions/resolve" -ContentType "application/json" -Body (@{
  requestId = "pr07-resolve-001"
  idempotencyKey = "pr07-resolve-001-key"
  sessionId = $sessionId
  occurredAt = (Get-Date).ToUniversalTime().ToString("o")
  readType = "ALPR"
  plateRaw = "51A12345"
  ocrConfidence = 0.98
  reasonCode = "ENTRY_EVIDENCE"
  reasonDetail = "PR07 evidence run"
} | ConvertTo-Json -Depth 10)
$resolve | ConvertTo-Json -Depth 12

Write-Host "== 3) Session detail should show decision + barrier + ticket/presence =="
$detail = Invoke-RestMethod -Method Get -Uri "$base/api/gate-sessions/$sessionId"
$detail | ConvertTo-Json -Depth 20

Write-Host "== 4) Duplicate entry should be blocked =="
$dup = Invoke-RestMethod -Method Post -Uri "$base/api/gate-sessions/resolve" -ContentType "application/json" -Body (@{
  requestId = "pr07-resolve-002"
  idempotencyKey = "pr07-resolve-002-key"
  siteCode = "SITE_HCM_01"
  laneCode = "GATE_01_ENTRY"
  direction = "ENTRY"
  occurredAt = (Get-Date).ToUniversalTime().ToString("o")
  deviceCode = "GATE_01_ENTRY_CAMERA"
  readType = "ALPR"
  plateRaw = "51A12345"
  ocrConfidence = 0.99
  autoOpenIfMissing = $true
} | ConvertTo-Json -Depth 10)
$dup | ConvertTo-Json -Depth 12

Write-Host "== 5) Legacy endpoint adapter =="
$legacy = Invoke-RestMethod -Method Post -Uri "$base/api/gate-events" -ContentType "application/json" -Body (@{
  siteCode = "SITE_HCM_01"
  deviceCode = "GATE_01_ENTRY_CAMERA"
  laneCode = "GATE_01_ENTRY"
  direction = "ENTRY"
  eventTime = (Get-Date).ToUniversalTime().ToString("o")
  idempotencyKey = "pr07-legacy-001"
  licensePlateRaw = "59A99999"
  rawPayload = @{ source = "legacy-evidence" }
} | ConvertTo-Json -Depth 10)
$legacy | ConvertTo-Json -Depth 12
