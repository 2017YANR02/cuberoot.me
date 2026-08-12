# PreToolUse hook: block hand-rolled "strip the trailing year off a comp name" regexes
# in client source (issue #65). Single source = lib/comp-localize.ts stripCompYear, reached
# via localizeCompName(..., { date }) / <CompCell date={…} />.
# Registered by .codex/hooks.json PreToolUse;stdin = {tool_name, tool_input}.
# Quick gate: payload without ".replace(" -> allow (zero node cost); else delegate to node.
# Deny via node's stdout JSON permissionDecision=deny (exit 2 is ignored in auto mode).
# Pairs with CI guard tests/comp-year-single-source.test.ts.
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = New-Object System.Text.UTF8Encoding $false  # pipe to node as BOM-less UTF-8

$payload = [Console]::In.ReadToEnd()
if ([string]::IsNullOrEmpty($payload)) { exit 0 }

# No ".replace(" token -> nothing to check, allow without node.
if ($payload -notmatch '\.replace\(') { exit 0 }

# Resolve detector by script location (<repo>/.codex/hooks -> <repo>/core/...),
# not a session cwd variable (sessions may root at repo or core/; that fails open).
$detector = Join-Path $PSScriptRoot '../../core/packages/client/scripts/hook-detect-comp-year-regex.mjs'
if (-not (Test-Path $detector)) { exit 0 }  # fail open

# node prints deny JSON to stdout on a hit (passed through) and exit 0; else no output.
$payload | & node $detector
exit $LASTEXITCODE
