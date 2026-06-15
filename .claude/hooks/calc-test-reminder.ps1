# PostToolUse hook: 改 client calc/ 下的文件后提醒跑回归测试
# 由 .claude/settings.local.json 调用，stdin 传 JSON {tool_name, tool_input:{file_path}, ...}

# Windows 默认 OEM 编码 (GBK)，强制 UTF-8 否则中文 system-reminder 乱码
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$json = [Console]::In.ReadToEnd() | ConvertFrom-Json
$path = $json.tool_input.file_path
if ($null -eq $path) { exit 0 }

if ($path -match 'app[/\\][^/\\]+[/\\]calc[/\\]') {
  $msg = "你刚改了 client calc/ 下的文件 — 改完前必须跑 core/packages/client/tests/calc-interactions.mjs 回归测试。流程: (1) browser_navigate http://127.0.0.1:3000/zh/calc?event=333 (2) 把 mjs 内容贴进 browser_evaluate (3) failed > 0 修到全过才能说改完。"
  $out = @{ hookSpecificOutput = @{ hookEventName = 'PostToolUse'; additionalContext = $msg } } | ConvertTo-Json -Compress
  Write-Output $out
}
exit 0
