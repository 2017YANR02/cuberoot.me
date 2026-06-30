# PreToolUse hook: block raw <input type="checkbox"> (☑) in client .tsx writes.
# Boolean toggles must use <BoolToggle> (knob left, label right); two-choice → PillToggle.
# Registered by global ~/.claude/settings.json PreToolUse(Edit|Write|MultiEdit); stdin = {tool_name, tool_input}.
# Quick gate: payload without the word "checkbox" -> allow (zero node cost); else delegate to node.
# Deny via node's stdout JSON permissionDecision=deny (exit 2 is ignored in auto mode).
# Pairs with CI guard tests/no-raw-checkbox.test.ts.
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = New-Object System.Text.UTF8Encoding $false  # pipe to node as BOM-less UTF-8

$payload = [Console]::In.ReadToEnd()
if ([string]::IsNullOrEmpty($payload)) { exit 0 }

# No "checkbox" token -> nothing to check, allow without node.
if ($payload -notmatch 'checkbox') { exit 0 }

# Resolve detector by script location (<repo>/.claude/hooks -> <repo>/core/...),
# not CLAUDE_PROJECT_DIR (sessions may root at repo or core/; that fails open).
$detector = Join-Path $PSScriptRoot '../../core/packages/client/scripts/hook-detect-raw-checkbox.mjs'
if (-not (Test-Path $detector)) { exit 0 }  # fail open

# node prints deny JSON to stdout on a hit (passed through) and exit 0; else no output.
$payload | & node $detector
exit $LASTEXITCODE
