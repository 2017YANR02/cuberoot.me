# PreToolUse hook: i18n 写入守卫 for client-next 源码 (.ts/.tsx)。委托 node 检测器跑两条规则:
#   1. 裸 isZh CJK 文案三目(应走 tr()/三路)  2. 手写繁体字(OpenCC 生成物,禁手敲)。
# 由全局 ~/.claude/settings.json 的 PreToolUse(Edit|Write|MultiEdit)注册;stdin 收 {tool_name, tool_input}。
# 快速门:整段 payload 无 CJK 表意文字 → 直接放行(零 node 开销);有 CJK 才转 node 精判。
# 拦截走 node 打到 stdout 的 JSON permissionDecision=deny(exit 2 在 auto 权限模式下会被忽略,
# 2026-06-14 实测;JSON deny 各模式都生效)。本脚本原样透传 node 的 stdout 再 exit 0。
# 详见 packages/client-next/scripts/ZHHANT_RECIPE.md。

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = New-Object System.Text.UTF8Encoding $false  # 管道给 node 用无 BOM UTF-8

$payload = [Console]::In.ReadToEnd()
if ([string]::IsNullOrEmpty($payload)) { exit 0 }

# 无任何 CJK 表意文字 → 两条规则都不可能命中,放行
if ($payload -notmatch '[㐀-䶿一-鿿豈-﫿]') { exit 0 }

# 按脚本自身位置解析 (<repo>/.claude/hooks/ → <repo>/core/...),不依赖 CLAUDE_PROJECT_DIR —
# 会话可能根在仓库根或 core/,后者下用 PROJECT_DIR 拼会 fail-open(2026-06-09 实翻车:core 会话繁体写入未被拦)
$detector = Join-Path $PSScriptRoot '../../core/packages/client-next/scripts/hook-detect-handwritten-trad.mjs'
if (-not (Test-Path $detector)) { exit 0 }  # fail open

# node 命中时把 deny JSON 打到 stdout(本脚本透传给 Claude Code)并 exit 0;放行时无输出 exit 0。
$payload | & node $detector
exit $LASTEXITCODE
