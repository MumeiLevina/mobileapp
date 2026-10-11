param([ValidateSet('disabled', 'mock', 'azure')][string]$Voice = 'azure')
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$pythonPath = Join-Path $repoRoot '.mori-live/upstream/.venv/Scripts/python.exe'
$entrypoint = Join-Path $repoRoot 'apps/live-desktop/python/launch.py'
$apiEntrypoint = Join-Path $repoRoot 'apps/api/dist/apps/api/src/live.main.js'
if (!(Test-Path -LiteralPath $pythonPath) -or !(Test-Path -LiteralPath $apiEntrypoint)) {
  throw 'Run setup-mori-live.ps1 -SyncPython and npm run build:api first.'
}
if ($Voice -eq 'azure' -and (!$env:MORI_TTS_KEY -or !$env:MORI_TTS_REGION)) {
  Write-Output 'Azure credentials missing: using explicitly labelled MOCK tone. No cloud request.'
  $Voice = 'mock'
}
$previous = @{}
$keys = @('MORI_LIVE_API_TOKEN','MORI_LIVE_OPERATOR_TOKEN','MORI_LIVE_MODE','MORI_TTS_PROVIDER')
foreach ($key in $keys) { $previous[$key] = [Environment]::GetEnvironmentVariable($key, 'Process') }
Push-Location $repoRoot
try {
  if (!$env:MORI_LIVE_MODE) { $env:MORI_LIVE_MODE = 'MOCK' }
  if (!$env:MORI_LIVE_API_TOKEN) {
    $env:MORI_LIVE_API_TOKEN = & node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))"
    if ($LASTEXITCODE -ne 0) { throw 'Cannot generate API credential.' }
  }
  if (!$env:MORI_LIVE_OPERATOR_TOKEN) {
    $operatorSecret = Read-Host 'Choose a separate local operator login code (at least 32 ASCII characters)' -AsSecureString
    $env:MORI_LIVE_OPERATOR_TOKEN = [System.Net.NetworkCredential]::new('', $operatorSecret).Password
  }
  if ($env:MORI_LIVE_OPERATOR_TOKEN -notmatch '^[A-Za-z0-9_-]{32,256}$' -or $env:MORI_LIVE_OPERATOR_TOKEN -eq $env:MORI_LIVE_API_TOKEN) {
    throw 'Use a separate 32-256 character ASCII operator code.'
  }
  $env:MORI_TTS_PROVIDER = $Voice
  # Tokens remain inherited process environment, never command-line arguments.
  Write-Output 'Open http://127.0.0.1:4320 and enter your operator code. Ctrl+C stops this run. Default is MOCK.'
  & node (Join-Path $repoRoot 'scripts/start-mori-live.mjs')
  if ($LASTEXITCODE -ne 0) { throw 'Python runtime exited with an error.' }
} finally {
  foreach ($key in $keys) { [Environment]::SetEnvironmentVariable($key, $previous[$key], 'Process') }
  Pop-Location
}
