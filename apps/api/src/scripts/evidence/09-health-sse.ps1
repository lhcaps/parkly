param(
  [string]$BaseUrl = 'http://127.0.0.1:3000/api',
  [string]$Token = '',
  [string]$SiteCode = 'SITE_HCM_01',
  [string]$DeviceCode = 'GATE_01_ENTRY_CAMERA'
)

$headers = @{}
if ($Token) {
  $headers['Authorization'] = "Bearer $Token"
}

$authArgs = @()
if ($Token) {
  $authArgs += @('-H', "Authorization: Bearer $Token")
}

Write-Host '=== 1) Device health snapshot ===' -ForegroundColor Cyan
& curl.exe @authArgs -N "$BaseUrl/stream/device-health?siteCode=$SiteCode"

Write-Host '=== 2) Lane status snapshot ===' -ForegroundColor Cyan
& curl.exe @authArgs -N "$BaseUrl/stream/lane-status?siteCode=$SiteCode"

Write-Host '=== 3) Outbox snapshot ===' -ForegroundColor Cyan
& curl.exe @authArgs -N "$BaseUrl/stream/outbox?siteCode=$SiteCode&limit=20"

Write-Host '=== 4) Signed heartbeat sample (replace signature first) ===' -ForegroundColor Yellow
$body = @{
  requestId      = 'hb-pr09-001'
  idempotencyKey = 'idem-hb-pr09-001'
  siteCode       = $SiteCode
  deviceCode     = $DeviceCode
  timestamp      = (Get-Date).ToUniversalTime().ToString('o')
  reportedAt     = (Get-Date).ToUniversalTime().ToString('o')
  status         = 'ONLINE'
  latencyMs      = 21
  firmwareVersion = '1.0.9'
  signature      = 'REPLACE_ME'
} | ConvertTo-Json

$body
Write-Host 'Send with Invoke-RestMethod once signature is valid.' -ForegroundColor Yellow
