param(
  [string]$BaseUrl = 'http://127.0.0.1:3000',
  [string]$Token = 'ops_dev_token_change_me',
  [string]$SiteCode = 'SITE_HCM_01'
)

$headers = @{ Authorization = "Bearer $Token"; 'Content-Type' = 'application/json' }

function New-Rid {
  "ui_$(Get-Date -Format yyyyMMddHHmmssfff)_$([guid]::NewGuid().ToString('N').Substring(0,8))"
}

Write-Host '1) Review queue'
$queue = Invoke-RestMethod -Method Get -Uri "$BaseUrl/api/gate-review-queue?siteCode=$SiteCode" -Headers @{ Authorization = "Bearer $Token" }
$queue | ConvertTo-Json -Depth 8

if (-not $queue.data.rows -or $queue.data.rows.Count -eq 0) {
  Write-Host 'Queue trống. Hãy tạo trước một session REVIEW/PAYMENT_HOLD rồi chạy lại.'
  exit 0
}

$review = $queue.data.rows[0]
$reviewId = $review.reviewId
$sessionId = $review.session.sessionId

Write-Host "2) Claim review $reviewId"
$claimBody = @{
  requestId = New-Rid
  idempotencyKey = New-Rid
  occurredAt = (Get-Date).ToUniversalTime().ToString('o')
  reasonCode = 'REVIEW_CLAIMED_BY_OPERATOR'
  note = 'Operator nhận xử lý review queue'
} | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/gate-review-queue/$reviewId/claim" -Headers $headers -Body $claimBody | ConvertTo-Json -Depth 8

Write-Host "3) Manual approve session $sessionId"
$approveBody = @{
  requestId = New-Rid
  idempotencyKey = New-Rid
  occurredAt = (Get-Date).ToUniversalTime().ToString('o')
  reasonCode = 'MANUAL_APPROVE_EVIDENCE'
  note = 'Operator đã kiểm tra lane và approve thủ công.'
} | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/gate-sessions/$sessionId/manual-approve" -Headers $headers -Body $approveBody | ConvertTo-Json -Depth 8

Write-Host "4) Session detail để xem audit before/after"
Invoke-RestMethod -Method Get -Uri "$BaseUrl/api/gate-sessions/$sessionId" -Headers @{ Authorization = "Bearer $Token" } | ConvertTo-Json -Depth 20
