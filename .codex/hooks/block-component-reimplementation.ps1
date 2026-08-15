# PreToolUse hook: block high-confidence reimplementations of cataloged UI components.
# Registered for Codex apply_patch through adapt-codex-write-payload.mjs. The detector scans
# only newly written client TSX and points to the exact shared component to reuse.
# Pairs with CI guard tests/component-reuse-guard.test.ts.
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = New-Object System.Text.UTF8Encoding $false

$payload = [Console]::In.ReadToEnd()
if ([string]::IsNullOrEmpty($payload)) { exit 0 }

# Cheap gate for the current registry: close/clear buttons, project selectors, BackHome placement,
# and the canonical algorithm case-detail layout.
if ($payload -notmatch '<button|<select|<X\b|<BackHome\b|<CaseThumb\b|<AlgPlayer\b|inlinePlayer|multiOri|multi-ori|is-paired-player|grid-template-columns|is-without-thumb|×|✕|关闭|close|clear|dismiss|EventIcon|CubingIcon|EventPicker|PuzzlePicker|PuzzleTypeSelect|eventPickerOpen|puzzlePickerOpen') { exit 0 }

$detector = Join-Path $PSScriptRoot '../../core/packages/client/scripts/hook-detect-component-reimplementation.mjs'
if (-not (Test-Path $detector)) { exit 0 } # fail open; CI is authoritative

$payload | & node $detector
exit $LASTEXITCODE
