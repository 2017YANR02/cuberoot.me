# PreToolUse hook: block writing Traditional Chinese into client-next source (.ts/.tsx).
# The site is Simplified-only (en + zh-Hans); Traditional was fully removed 2026-06-14.
# Registered by global ~/.claude/settings.json PreToolUse(Edit|Write|MultiEdit); stdin = {tool_name, tool_input}.
# Quick gate: payload with no CJK ideographs -> allow (zero node cost); else delegate to node.
# Deny via node's stdout JSON permissionDecision=deny (exit 2 is ignored in auto mode; JSON deny works everywhere).
# Pairs with the CI guard tests/i18n-removal-guard.test.ts.
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = New-Object System.Text.UTF8Encoding $false  # pipe to node as BOM-less UTF-8

$payload = [Console]::In.ReadToEnd()
if ([string]::IsNullOrEmpty($payload)) { exit 0 }

# No CJK ideograph at all -> cannot contain Traditional, allow without node.
if ($payload -notmatch '[㐀-䶿一-鿿豈-﫿]') { exit 0 }

# Resolve detector by script location (<repo>/.claude/hooks -> <repo>/core/...),
# not CLAUDE_PROJECT_DIR (sessions may root at repo or core/; that fails open).
$detector = Join-Path $PSScriptRoot '../../core/packages/client-next/scripts/hook-detect-traditional.mjs'
if (-not (Test-Path $detector)) { exit 0 }  # fail open

# node prints deny JSON to stdout on a hit (passed through) and exit 0; else no output.
$payload | & node $detector
exit $LASTEXITCODE
