param(
  [string]$BaseUrl = 'http://127.0.0.1:3000',
  [string]$Token = $(if ($env:API_OPS_TOKEN) { $env:API_OPS_TOKEN } else { 'ops_dev_token_change_me' }),
  [ValidateSet('entry-happy','exit-paid','exit-unpaid','low-confidence-review','anti-passback-blocked','barrier-timeout','all')]
  [string]$Scenario = 'all',
  [string]$SiteCode = 'SITE_HCM_01',
  [string]$EntryLaneCode = 'GATE_01_ENTRY',
  [string]$ExitLaneCode = 'GATE_01_EXIT',
  [string]$EntryDeviceCode = 'GATE_01_ENTRY_CAMERA',
  [string]$ExitDeviceCode = 'GATE_01_EXIT_CAMERA',
  [string]$EntrySensorDeviceCode = 'GATE_01_ENTRY_LOOP',
  [string]$ExitRfidDeviceCode = 'GATE_01_EXIT_RFID',
  [string]$PlateRaw = '51A12345',
  [string]$RfidUid = 'TAG-0001',
  [string]$PaidRfidUid = 'TAG-PAID-001',
  [string]$UnpaidRfidUid = 'TAG-UNPAID-001',
  [int]$AckTimeoutSeconds = 17
)

$ErrorActionPreference = 'Stop'

function New-Rid {
  [guid]::NewGuid().ToString('N').Substring(0, 16)
}

function Write-Section([string]$Text) {
  Write-Host "`n=== $Text ===" -ForegroundColor Cyan
}

function Invoke-JsonApi {
  param(
    [ValidateSet('GET','POST')][string]$Method,
    [string]$Path,
    [object]$Body
  )

  $headers = @{ Authorization = "Bearer $Token" }
  $uri = "$BaseUrl$Path"
  if ($Method -eq 'GET') {
    return Invoke-RestMethod -Method Get -Uri $uri -Headers $headers
  }

  $headers['Content-Type'] = 'application/json'
  $json = if ($null -eq $Body) { '{}' } else { $Body | ConvertTo-Json -Depth 20 }
  return Invoke-RestMethod -Method Post -Uri $uri -Headers $headers -Body $json
}

function Open-SensorSession {
  param(
    [string]$LaneCode,
    [string]$Direction
  )

  Invoke-JsonApi -Method POST -Path '/api/gate-sessions/open' -Body @{
    requestId      = New-Rid
    idempotencyKey = New-Rid
    siteCode       = $SiteCode
    laneCode       = $LaneCode
    direction      = $Direction
    readType       = 'SENSOR'
    sensorState    = 'PRESENT'
    deviceCode     = $EntrySensorDeviceCode
    occurredAt     = [DateTime]::UtcNow.ToString('o')
    correlationId  = "$SiteCode/$LaneCode/$(New-Rid)"
  }
}

function Resolve-Read {
  param(
    [string]$SessionId,
    [string]$LaneCode,
    [string]$Direction,
    [string]$ReadType,
    [string]$DeviceCode,
    [string]$Plate,
    [string]$Uid,
    [double]$Confidence = 0.96
  )

  $body = @{
    requestId      = New-Rid
    idempotencyKey = New-Rid
    sessionId      = $SessionId
    siteCode       = $SiteCode
    laneCode       = $LaneCode
    direction      = $Direction
    readType       = $ReadType
    deviceCode     = $DeviceCode
    occurredAt     = [DateTime]::UtcNow.ToString('o')
    ocrConfidence  = $Confidence
  }
  if ($Plate) { $body['plateRaw'] = $Plate }
  if ($Uid) { $body['rfidUid'] = $Uid }
  Invoke-JsonApi -Method POST -Path '/api/gate-sessions/resolve' -Body $body
}

function Get-SessionDetail([string]$SessionId) {
  Invoke-JsonApi -Method GET -Path "/api/gate-sessions/$SessionId"
}

function Get-Outbox {
  Invoke-JsonApi -Method GET -Path '/api/outbox?limit=20'
}

function Run-EntryHappy {
  Write-Section 'ENTRY happy path'
  $open = Open-SensorSession -LaneCode $EntryLaneCode -Direction 'ENTRY'
  $sessionId = "$($open.session.sessionId)"
  $resolve = Resolve-Read -SessionId $sessionId -LaneCode $EntryLaneCode -Direction 'ENTRY' -ReadType 'ALPR' -DeviceCode $EntryDeviceCode -Plate $PlateRaw -Uid $RfidUid
  $detail = Get-SessionDetail -SessionId $sessionId
  [pscustomobject]@{
    scenario      = 'entry-happy'
    sessionId     = $sessionId
    finalStatus   = $detail.status
    decisionCode  = $resolve.decision.decisionCode
    reasonCode    = $resolve.decision.reasonCode
    allowedActions = ($detail.allowedActions -join ',')
  }
}

function Run-ExitScenario {
  param(
    [string]$Name,
    [string]$Uid,
    [string]$Plate
  )

  Write-Section $Name
  $open = Open-SensorSession -LaneCode $ExitLaneCode -Direction 'EXIT'
  $sessionId = "$($open.session.sessionId)"
  $resolve = Resolve-Read -SessionId $sessionId -LaneCode $ExitLaneCode -Direction 'EXIT' -ReadType $(if ($Uid) { 'RFID' } else { 'ALPR' }) -DeviceCode $(if ($Uid) { $ExitRfidDeviceCode } else { $ExitDeviceCode }) -Plate $Plate -Uid $Uid
  $detail = Get-SessionDetail -SessionId $sessionId
  [pscustomobject]@{
    scenario       = $Name
    sessionId      = $sessionId
    finalStatus    = $detail.status
    decisionCode   = $resolve.decision.decisionCode
    reasonCode     = $resolve.decision.reasonCode
    paymentStatus  = if ($resolve.decision.inputSnapshot.paymentStatus) { $resolve.decision.inputSnapshot.paymentStatus } else { 'UNKNOWN' }
    recommended    = $resolve.decision.recommendedAction
  }
}

function Run-LowConfidenceReview {
  Write-Section 'low confidence review'
  $open = Open-SensorSession -LaneCode $EntryLaneCode -Direction 'ENTRY'
  $sessionId = "$($open.session.sessionId)"
  $resolve = Resolve-Read -SessionId $sessionId -LaneCode $EntryLaneCode -Direction 'ENTRY' -ReadType 'ALPR' -DeviceCode $EntryDeviceCode -Plate '51A88888' -Uid '' -Confidence 0.41
  [pscustomobject]@{
    scenario      = 'low-confidence-review'
    sessionId     = $sessionId
    decisionCode  = $resolve.decision.decisionCode
    reasonCode    = $resolve.decision.reasonCode
    reviewRequired = $resolve.decision.reviewRequired
    explanation   = $resolve.decision.explanation
  }
}

function Run-AntiPassback {
  Write-Section 'anti-passback blocked'
  $first = Run-EntryHappy
  $secondOpen = Open-SensorSession -LaneCode $EntryLaneCode -Direction 'ENTRY'
  $secondSessionId = "$($secondOpen.session.sessionId)"
  $secondResolve = Resolve-Read -SessionId $secondSessionId -LaneCode $EntryLaneCode -Direction 'ENTRY' -ReadType 'ALPR' -DeviceCode $EntryDeviceCode -Plate $PlateRaw -Uid $RfidUid
  [pscustomobject]@{
    scenario     = 'anti-passback-blocked'
    firstSession = $first.sessionId
    secondSession = $secondSessionId
    decisionCode = $secondResolve.decision.decisionCode
    reasonCode   = $secondResolve.decision.reasonCode
    explanation  = $secondResolve.decision.explanation
  }
}

function Run-BarrierTimeout {
  Write-Section 'barrier timeout'
  $entry = Run-EntryHappy
  Start-Sleep -Seconds $AckTimeoutSeconds
  $outbox = Get-Outbox
  [pscustomobject]@{
    scenario    = 'barrier-timeout'
    sessionId   = $entry.sessionId
    rows        = $outbox.rows.Count
    latestState = if ($outbox.rows.Count -gt 0) { $outbox.rows[0].status } else { 'NONE' }
    note        = 'Kiểm tra thêm /api/stream/lane-status và /api/stream/outbox để thấy BARRIER_FAULT / TIMEOUT realtime.'
  }
}

$results = @()
switch ($Scenario) {
  'entry-happy'           { $results += Run-EntryHappy }
  'exit-paid'             { $results += Run-ExitScenario -Name 'exit-paid' -Uid $PaidRfidUid -Plate '' }
  'exit-unpaid'           { $results += Run-ExitScenario -Name 'exit-unpaid' -Uid $UnpaidRfidUid -Plate '' }
  'low-confidence-review' { $results += Run-LowConfidenceReview }
  'anti-passback-blocked' { $results += Run-AntiPassback }
  'barrier-timeout'       { $results += Run-BarrierTimeout }
  'all' {
    $results += Run-EntryHappy
    $results += Run-ExitScenario -Name 'exit-paid' -Uid $PaidRfidUid -Plate ''
    $results += Run-ExitScenario -Name 'exit-unpaid' -Uid $UnpaidRfidUid -Plate ''
    $results += Run-LowConfidenceReview
    $results += Run-AntiPassback
    $results += Run-BarrierTimeout
  }
}

Write-Section 'evidence summary'
$results | Format-Table -AutoSize
