$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '../stats_progress.ps1')
$scratch = Join-Path $PSScriptRoot '../../../../.tmp/png/stats-progress-test'
[IO.Directory]::CreateDirectory($scratch) | Out-Null
$log = Join-Path $scratch 'analyzer.log'
$script:seen = [Collections.Generic.List[string]]::new()
$script:ends = 0
function Write-Prog { param([string]$Text) $script:seen.Add($Text) }
function Write-ProgEnd { $script:ends++ }
$node = (Get-Command node).Source
$env:ANALYZER_PROGRESS_FILE = Join-Path $scratch 'progress.log'
[IO.File]::WriteAllText($env:ANALYZER_PROGRESS_FILE, '')
$code = Invoke-StatsAnalyzer -Executable $node -LogPath $log -InputText @'
console.log('CUBE ROOT LOGO');
if (process.env.ANALYZER_PROGRESS_FILE) require('fs').appendFileSync(process.env.ANALYZER_PROGRESS_FILE, '[PROG] 2/3\n');
else console.error('[PROG] 2/3');
console.error('fixture failure');
console.error('[MONSTER] fixture timeout');
process.exitCode = 23;
'@
if ($code -ne 23) { throw "Exit code lost: $code" }
if ($seen.Count -ne 2 -or $seen[1] -ne '正在计算 SQ1 2/3') { throw 'Progress missing or noisy' }
$saved = [IO.File]::ReadAllText($log)
foreach ($expected in @('CUBE ROOT LOGO', '[PROG] 2/3', 'fixture failure')) {
  if (-not $saved.Contains($expected)) { throw "Log missing $expected" }
}
if ($ends -ne 1) { throw 'Progress not closed' }
if ($env:ANALYZER_PROGRESS_FILE -ne (Join-Path $scratch 'progress.log')) { throw 'Progress environment not restored' }
if (-not [IO.File]::ReadAllText($env:ANALYZER_PROGRESS_FILE).Contains('[PROG] 2/3')) { throw 'Progress file not preserved' }
if (-not [IO.File]::ReadAllText($env:ANALYZER_PROGRESS_FILE).Contains('[MONSTER] fixture timeout')) { throw 'Timeout event lost' }
$code = Invoke-StatsAnalyzer -Executable $node -LogPath $log -InputText 'console.error("[PROG] 3/3");'
if ($code -ne 0 -or $ends -ne 2) { throw 'Success handling failed' }
try {
  Invoke-StatsAnalyzer -Executable (Join-Path $scratch 'missing.exe') -LogPath $log -InputText ''
  throw 'Missing executable accepted'
} catch {
  if ($_.Exception.Message -eq 'Missing executable accepted') { throw }
}
if ($ends -ne 3) { throw 'Exception did not close progress' }
# The log must be closed even when process startup fails.
$handle = [IO.File]::Open($log, 'Open', 'ReadWrite', 'None')
$handle.Dispose()
Write-Host 'PASS: progress, logs, success, failure, cleanup'
