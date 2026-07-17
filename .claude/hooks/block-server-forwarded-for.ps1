# PreToolUse hook: block reads of the client-forgeable X-Forwarded-For header as an IP
# source in server source writes (core/packages/server/src/*.ts). Request IP must come
# from getIp(c) (utils/analytics_helpers.ts) — the single source, which reads only nginx's
# trusted x-real-ip. XFF is client-set → IP/visitor_id/country spoofing, rate-limit bypass.
# Registered by global ~/.claude/settings.json PreToolUse(Edit|Write|MultiEdit); stdin = {tool_name, tool_input}.
# Quick gate: payload without "forwarded" -> allow (zero node cost); else delegate to node.
# Deny via node's stdout JSON permissionDecision=deny (exit 2 is ignored in auto mode).
# Pairs with CI guard tests/server-no-forwarded-for.test.ts (authoritative).
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = New-Object System.Text.UTF8Encoding $false  # pipe to node as BOM-less UTF-8

$payload = [Console]::In.ReadToEnd()
if ([string]::IsNullOrEmpty($payload)) { exit 0 }

# No "forwarded" token -> can't contain an x-forwarded-for read, allow without node.
if ($payload -notmatch 'forwarded') { exit 0 }

# Resolve detector by script location (<repo>/.claude/hooks -> <repo>/core/...),
# not CLAUDE_PROJECT_DIR (sessions may root at repo or core/; that fails open).
$detector = Join-Path $PSScriptRoot '../../core/packages/client/scripts/hook-detect-server-forwarded-for.mjs'
if (-not (Test-Path $detector)) { exit 0 }  # fail open

# node prints deny JSON to stdout on a hit (passed through) and exit 0; else no output.
$payload | & node $detector
exit $LASTEXITCODE
