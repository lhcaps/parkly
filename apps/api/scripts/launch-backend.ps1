# launch-backend.ps1
param(
  [ValidateSet('local-dev', 'demo', 'release-candidate')]
  [string]$Profile = 'demo',

  [ValidateSet('compose-up', 'compose-down', 'verify', 'bootstrap', 'reset', 'smoke', 'dev', 'worker')]
  [string]$Action = 'bootstrap'
)

$ErrorActionPreference = 'Stop'
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
Set-Location $RepoRoot

switch ($Action) {
  'compose-up' {
    if ($Profile -eq 'release-candidate') {
      pnpm --dir apps/api compose:up:rc
    }
    elseif ($Profile -eq 'local-dev') {
      pnpm --dir apps/api compose:up:local
    }
    else {
      pnpm --dir apps/api compose:up:demo
    }
  }
  'compose-down' { pnpm --dir apps/api compose:down }
  'verify' { pnpm --dir apps/api verify:deployment -- --profile $Profile --intent bootstrap }
  'bootstrap' {
    if ($Profile -eq 'release-candidate') { pnpm --dir apps/api bootstrap:rc }
    elseif ($Profile -eq 'local-dev') { pnpm --dir apps/api bootstrap:local }
    else { pnpm --dir apps/api bootstrap:demo }
  }
  'reset' {
    if ($Profile -eq 'release-candidate') { pnpm --dir apps/api reset:rc }
    elseif ($Profile -eq 'local-dev') { pnpm --dir apps/api reset:local }
    else { pnpm --dir apps/api reset:demo }
  }
  'smoke' {
    if ($Profile -eq 'release-candidate') { pnpm --dir apps/api smoke:rc }
    elseif ($Profile -eq 'local-dev') { pnpm --dir apps/api smoke:local }
    else { pnpm --dir apps/api smoke:demo }
  }
  'dev' {
    pnpm --dir apps/api verify:deployment -- --profile $Profile --intent dev
    pnpm --dir apps/api dev
  }
  'worker' { pnpm --dir apps/api worker:dev }
}
