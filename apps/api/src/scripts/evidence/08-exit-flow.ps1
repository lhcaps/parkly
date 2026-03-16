$base = "http://127.0.0.1:3000"
$now = (Get-Date).ToUniversalTime().ToString("o")

Write-Host "=== PR08 evidence: EXIT happy path (expected PAID/SUBSCRIPTION_COVERED -> PASSED) ==="
$exitPaid = Invoke-RestMethod -Method Post -Uri "$base/api/gate-sessions/resolve" -ContentType "application/json" -Body (@{
  requestId = "pr08-exit-paid-001"
  idempotencyKey = "pr08-exit-paid-001"
  siteCode = "SITE_HCM_01"
  laneCode = "GATE_01_EXIT"
  direction = "EXIT"
  occurredAt = $now
  readType = "RFID"
  rfidUid = "RFID-0001"
  presenceActive = $true
} | ConvertTo-Json)
$exitPaid | ConvertTo-Json -Depth 20

Write-Host "=== PR08 evidence: EXIT unpaid (expected WAITING_PAYMENT / PAYMENT_REQUIRED) ==="
$exitUnpaid = Invoke-RestMethod -Method Post -Uri "$base/api/gate-sessions/resolve" -ContentType "application/json" -Body (@{
  requestId = "pr08-exit-unpaid-001"
  idempotencyKey = "pr08-exit-unpaid-001"
  siteCode = "SITE_HCM_01"
  laneCode = "GATE_01_EXIT"
  direction = "EXIT"
  occurredAt = (Get-Date).ToUniversalTime().ToString("o")
  readType = "ALPR"
  plateRaw = "51A12345"
  ocrConfidence = 0.98
  presenceActive = $true
} | ConvertTo-Json)
$exitUnpaid | ConvertTo-Json -Depth 20

Write-Host "=== PR08 evidence: EXIT ticket not found (expected REVIEW / TICKET_NOT_FOUND) ==="
$exitMissing = Invoke-RestMethod -Method Post -Uri "$base/api/gate-sessions/resolve" -ContentType "application/json" -Body (@{
  requestId = "pr08-exit-missing-001"
  idempotencyKey = "pr08-exit-missing-001"
  siteCode = "SITE_HCM_01"
  laneCode = "GATE_01_EXIT"
  direction = "EXIT"
  occurredAt = (Get-Date).ToUniversalTime().ToString("o")
  readType = "RFID"
  rfidUid = "RFID-NOT-FOUND"
  presenceActive = $true
} | ConvertTo-Json)
$exitMissing | ConvertTo-Json -Depth 20

Write-Host "=== PR08 evidence: legacy /api/gate-events EXIT adapter ==="
$legacyExit = Invoke-RestMethod -Method Post -Uri "$base/api/gate-events" -ContentType "application/json" -Body (@{
  siteCode = "SITE_HCM_01"
  laneCode = "GATE_01_EXIT"
  deviceCode = "GATE_01_EXIT_CAMERA"
  direction = "EXIT"
  eventTime = (Get-Date).ToUniversalTime().ToString("o")
  idempotencyKey = "pr08-legacy-exit-001"
  licensePlateRaw = "51A12345"
  rawPayload = @{ source = "PR08_EVIDENCE" }
} | ConvertTo-Json -Depth 10)
$legacyExit | ConvertTo-Json -Depth 20
