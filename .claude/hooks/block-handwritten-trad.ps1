# PreToolUse hook: guard client-next i18n on write (.ts/.tsx). Blocks (1) Traditional
# Chinese (Simplified-only site; Traditional removed 2026-06-14) and (2) inline UI-language
# text ternaries (isZh ? '中' : 'EN' / i18n.language ? : ) — those must use tr()/<T>/useT()/t().
# Registered by global ~/.claude/settings.json PreToolUse(Edit|Write|MultiEdit); stdin = {tool_name, tool_input}.
# Quick gate: payload with no CJK AND no i18n.language/isZh token -> allow (zero node cost); else delegate to node.
# Deny via node's stdout JSON permissionDecision=deny (exit 2 is ignored in auto mode; JSON deny works everywhere).
# Pairs with CI guards tests/i18n-removal-guard.test.ts + tests/i18n-no-isz-text-ternary.test.ts.
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = New-Object System.Text.UTF8Encoding $false  # pipe to node as BOM-less UTF-8

$payload = [Console]::In.ReadToEnd()
if ([string]::IsNullOrEmpty($payload)) { exit 0 }

# No CJK ideograph AND no i18n-language token -> nothing to check, allow without node.
if (($payload -notmatch '[㐀-䶿一-鿿豈-﫿]') -and ($payload -notmatch 'i18n\.language|isZh')) { exit 0 }

# Resolve detector by script location (<repo>/.claude/hooks -> <repo>/core/...),
# not CLAUDE_PROJECT_DIR (sessions may root at repo or core/; that fails open).
$detector = Join-Path $PSScriptRoot '../../core/packages/client-next/scripts/hook-detect-traditional.mjs'
if (-not (Test-Path $detector)) { exit 0 }  # fail open

# node prints deny JSON to stdout on a hit (passed through) and exit 0; else no output.
$payload | & node $detector
exit $LASTEXITCODE
