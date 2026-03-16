$ErrorActionPreference = 'Stop'

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$dist = Join-Path $root 'dist'
New-Item -ItemType Directory -Force -Path $dist | Out-Null

$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$outZip = Join-Path $dist "Parkly_submit_$stamp.zip"

# Exclude patterns (submission hygiene)
$exclude = @(
  '.env', '.env.*',
  'node_modules',
  'dist',
  '*.rar',
  '*.log',
  'pnpm-debug.log*',
  'db\flyway.conf'
)

# Collect files
$files = Get-ChildItem -Path $root -Recurse -File | Where-Object {
  $rel = $_.FullName.Substring($root.Length + 1)

  # exclude by directory
  if ($rel -match '^(node_modules|dist)\\') { return $false }

  # exclude flyway.conf (generated)
  if ($rel -ieq 'db\flyway.conf') { return $false }

  # exclude env files
  if ($rel -ieq '.env') { return $false }
  if ($rel -ilike '.env.*' -and $rel -ine '.env.example') { return $false }

  # exclude rar
  if ($rel -ilike '*.rar') { return $false }

  # exclude logs
  if ($rel -ilike '*.log' -or $rel -ilike 'pnpm-debug.log*') { return $false }

  return $true
}

if (Test-Path $outZip) { Remove-Item $outZip -Force }

Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::Open($outZip, 'Create')
try {
  foreach ($f in $files) {
    $rel = $f.FullName.Substring($root.Length + 1)
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $f.FullName, $rel) | Out-Null
  }
} finally {
  $zip.Dispose()
}

Write-Host "[OK] Created submission zip: $outZip"
