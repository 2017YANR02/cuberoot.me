# PreToolUse hook: 拦「手写繁体字」进 client-next 源码 (.ts/.tsx)。
# 繁体中文在本仓是 OpenCC 生成物(inject-zhhant.mjs / gen-zh-hant.mjs / conv.mjs),禁手敲。
# 由 .claude/settings.local.json 注册;stdin 收 {tool_name, tool_input}。
# 快速门:整段 payload 无 CJK 表意文字 → 直接放行(零 node 开销);有 CJK 才转 node 精判。
# 详见 packages/client-next/scripts/ZHHANT_RECIPE.md。

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = New-Object System.Text.UTF8Encoding $false  # 管道给 node 用无 BOM UTF-8

$payload = [Console]::In.ReadToEnd()
if ([string]::IsNullOrEmpty($payload)) { exit 0 }

# 无任何 CJK 表意文字 → 不可能含繁体,放行
if ($payload -notmatch '[㐀-䶿一-鿿豈-﫿]') { exit 0 }

# 按脚本自身位置解析 (<repo>/.claude/hooks/ → <repo>/core/...),不依赖 CLAUDE_PROJECT_DIR —
# 会话可能根在仓库根或 core/,后者下用 PROJECT_DIR 拼会 fail-open(2026-06-09 实翻车:core 会话繁体写入未被拦)
$detector = Join-Path $PSScriptRoot '../../core/packages/client-next/scripts/hook-detect-handwritten-trad.mjs'
if (-not (Test-Path $detector)) { exit 0 }  # fail open

$payload | & node $detector
exit $LASTEXITCODE
