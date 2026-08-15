# PreToolUse hook: require an explicit exactness contract for puzzle-image fallbacks.
# Pairs with CI tests/puzzle-image-state-parity-guard.test.ts.
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = New-Object System.Text.UTF8Encoding $false

$payload = [Console]::In.ReadToEnd()
if ([string]::IsNullOrEmpty($payload)) { exit 0 }
if ($payload -notmatch 'PuzzleImageStudio|renderSpecSvg') { exit 0 }

$detector = Join-Path $PSScriptRoot '../../core/packages/client/scripts/hook-detect-puzzle-image-state-parity.mjs'
if (-not (Test-Path $detector)) { exit 0 } # fail open; CI is authoritative

$payload | & node $detector
exit $LASTEXITCODE
