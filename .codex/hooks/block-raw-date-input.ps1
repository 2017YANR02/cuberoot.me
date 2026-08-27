# PreToolUse: date-only UI must reuse DateInput / DateRangeInput.
# Pairs with packages/client/tests/date-input-reuse-guard.test.ts.
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = New-Object System.Text.UTF8Encoding $false

$payload = [Console]::In.ReadToEnd()
if ([string]::IsNullOrEmpty($payload)) { exit 0 }
if ($payload -notmatch '(?i)\bdate\b|yyyy-mm-dd') { exit 0 }

$detector = Join-Path $PSScriptRoot '../../core/packages/client/scripts/hook-detect-raw-date-input.mjs'
if (-not (Test-Path $detector)) { exit 0 }
$payload | & node $detector
exit $LASTEXITCODE
