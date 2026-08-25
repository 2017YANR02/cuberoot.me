# PostToolUse hook: 改了 server 的 migration / route(源头)后,提醒同步 /dev 文档快照页。
# 由 .codex/hooks.json 调用;兼容 Codex 的补丁字符串与结构化写入参数。
# 非阻塞:只注入 additionalContext 提醒,真正的硬拦在 CI(tests/dev-schema-api-drift.test.ts)。
# 这两页是手维护的硬编码快照:/dev/schema 的 MIGRATIONS 账本、/dev/api 的 covers-routes 清单。

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

try { $json = [Console]::In.ReadToEnd() | ConvertFrom-Json } catch { exit 0 }
$rawInput = if ($json.tool_input -is [string]) { "$($json.tool_input)" } else { $json.tool_input | ConvertTo-Json -Compress -Depth 8 }
if ([string]::IsNullOrWhiteSpace($rawInput)) { exit 0 }
$normalized = $rawInput -replace '\\','/'

# 收集本次 Codex 写入的新增内容。
$content = $rawInput

$msg = $null
if ($normalized -match 'apps/api/migrations/[0-9]{4}_.*\.sql') {
  $msg = "你刚动了 server migration。同步 /dev/schema 的账本:在 packages/client/app/[lang]/dev/schema/page.tsx 的 MIGRATIONS 数组加一行 { n: <编号>, slug, desc };新表顺手加进 TABLES。CI 守卫 tests/dev-schema-api-drift.test.ts 会卡漏改。"
}
elseif ($normalized -match 'apps/api/src/index\.ts' -and $content -match 'app\.route\(') {
  $msg = "你刚改了 index.ts 的路由挂载。若新挂了 route,同步 /dev/api:在 packages/client/app/[lang]/dev/api/page.tsx 的 covers-routes 清单加文件名 + 在 ENDPOINTS 补端点。CI 守卫 tests/dev-schema-api-drift.test.ts 会卡漏改。"
}
elseif ($normalized -match 'apps/api/src/routes/[a-z0-9_]+\.ts' -and $content -match '\.(get|post|put|patch|delete)\(') {
  $msg = "你刚改了 server route 文件(含端点定义)。若增删了对外端点,同步 /dev/api 的 ENDPOINTS(packages/client/app/[lang]/dev/api/page.tsx);新 route 文件还要进 covers-routes 清单。CI 守卫 tests/dev-schema-api-drift.test.ts 会卡新挂载的 route。"
}

if ($msg) {
  $out = @{ hookSpecificOutput = @{ hookEventName = 'PostToolUse'; additionalContext = $msg } } | ConvertTo-Json -Compress
  Write-Output $out
}
exit 0
