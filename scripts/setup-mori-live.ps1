param([switch]$FetchUpstream, [switch]$SyncPython)
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$pin = Get-Content -LiteralPath (Join-Path $repoRoot 'apps/live-desktop/upstream.lock.json') -Raw | ConvertFrom-Json

function Invoke-Checked([string]$Executable, [string[]]$Arguments) {
  & $Executable @Arguments
  if ($LASTEXITCODE -ne 0) { throw "$Executable failed with exit code $LASTEXITCODE" }
}

Push-Location $repoRoot
try {
  $nodeVersion = & node --version
  if ($LASTEXITCODE -ne 0 -or $nodeVersion -notmatch '^v(\d+)\.') { throw 'Node.js version check failed.' }
  $nodeMajor = [int]$Matches[1]
  if ($nodeMajor -lt 22) { throw 'Node.js 22 or newer is required.' }
  Invoke-Checked 'npm.cmd' @('ci')
  Invoke-Checked 'npm.cmd' @('run', 'live:smoke')
  if ($FetchUpstream -or $SyncPython) {
    $runtimeRoot = Join-Path $repoRoot '.mori-live'
    $checkout = Join-Path $runtimeRoot 'upstream'
    New-Item -ItemType Directory -Path $runtimeRoot -Force | Out-Null
    if (!(Test-Path -LiteralPath $checkout)) {
      Invoke-Checked 'git' @('clone', '--branch', $pin.release, '--depth', '1', $pin.repository, $checkout)
    }
    $remote = & git -C $checkout remote get-url origin
    if ($LASTEXITCODE -ne 0 -or $remote -ne $pin.repository) { throw 'Unexpected upstream remote.' }
    $dirty = & git -C $checkout status --porcelain
    if ($LASTEXITCODE -ne 0 -or $dirty) { throw 'Upstream checkout has local changes; preserve them and inspect manually.' }
    Invoke-Checked 'git' @('-C', $checkout, 'fetch', '--depth', '1', 'origin', $pin.commit)
    Invoke-Checked 'git' @('-C', $checkout, 'checkout', '--detach', $pin.commit)
    Invoke-Checked 'git' @('-C', $checkout, 'submodule', 'update', '--init', '--depth', '1', 'frontend')
    $runtimeCommit = & git -C $checkout rev-parse HEAD
    $frontendCommit = & git -C (Join-Path $checkout 'frontend') rev-parse HEAD
    $lockHash = (Get-FileHash -LiteralPath (Join-Path $checkout 'uv.lock') -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($runtimeCommit -ne $pin.commit -or $frontendCommit -ne $pin.frontendCommit -or $lockHash -ne $pin.uvLockSha256) {
      throw 'Upstream pin verification failed.'
    }
    if ($SyncPython) {
      Push-Location $checkout
      try { Invoke-Checked 'uv' @('sync', '--frozen', '--python', $pin.python) }
      finally { Pop-Location }
    }
    Write-Output 'Upstream pins verified. Unmodified upstream server is NOT started.'
  }
} finally { Pop-Location }
