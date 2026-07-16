# PreToolUse hook: block NEW anchored dropdown panels (position:absolute/fixed + top:~100%)
# written to client CSS without an `anchored-panel:` viewport-clamp declaration (issue #29:
# panels anchored left:0 under a right-leaning trigger get clipped at the viewport edge).
# Registered by global ~/.claude/settings.json PreToolUse(Edit|Write|MultiEdit); stdin = {tool_name, tool_input}.
# Quick gate: payload without "100%" -> allow (zero node cost); else delegate to node.
# Deny via node's stdout JSON permissionDecision=deny (exit 2 is ignored in auto mode).
# Pairs with CI guard tests/anchored-panel-clamp.test.ts (authoritative).
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = New-Object System.Text.UTF8Encoding $false  # pipe to node as BOM-less UTF-8

$payload = [Console]::In.ReadToEnd()
if ([string]::IsNullOrEmpty($payload)) { exit 0 }

# No "100%" token -> can't contain top:~100%, allow without node.
if ($payload -notmatch '100%') { exit 0 }

# Resolve detector by script location (<repo>/.claude/hooks -> <repo>/core/...),
# not CLAUDE_PROJECT_DIR (sessions may root at repo or core/; that fails open).
$detector = Join-Path $PSScriptRoot '../../core/packages/client/scripts/hook-detect-unclamped-anchored-panel.mjs'
if (-not (Test-Path $detector)) { exit 0 }  # fail open

# node prints deny JSON to stdout on a hit (passed through) and exit 0; else no output.
$payload | & node $detector
exit $LASTEXITCODE
