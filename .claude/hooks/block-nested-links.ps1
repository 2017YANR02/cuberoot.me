# PreToolUse hook: block JSX links nested inside another link. React only reports
# this at runtime; typecheck remains green. The detector reconstructs the proposed
# file in memory so an added PersonLink is checked against an existing outer <a>.
# Registered for Claude Edit/Write/MultiEdit and Codex apply_patch; CI is authoritative.
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = New-Object System.Text.UTF8Encoding $false

$payload = [Console]::In.ReadToEnd()
if ([string]::IsNullOrEmpty($payload)) { exit 0 }

# Fast gate: only JSX-bearing writes need the AST. Do not gate on fixed link tag
# names: an existing import may alias AppLink as Foo, and the detector resolves it.
if ($payload -notmatch '<[A-Za-z]') { exit 0 }

$detector = Join-Path $PSScriptRoot '../../core/packages/client/scripts/hook-detect-nested-links.mjs'
if (-not (Test-Path $detector)) { exit 0 } # fail open; CI is authoritative

$payload | & node $detector
exit $LASTEXITCODE
