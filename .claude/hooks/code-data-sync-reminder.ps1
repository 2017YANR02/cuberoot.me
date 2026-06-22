# PostToolUse hook: 改了 server 的 migration / route(源头)后,提醒同步 /code 文档快照页。
# 由 .claude/settings.local.json 调用,stdin 传 JSON {tool_name, tool_input:{file_path, content, new_string, edits[]}}。
# 非阻塞:只注入 additionalContext 提醒,真正的硬拦在 CI(tests/code-schema-api-drift.test.ts)。
# 这两页是手维护的硬编码快照:/code/schema 的 MIGRATIONS 账本、/code/api 的 covers-routes 清单。

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

try { $json = [Console]::In.ReadToEnd() | ConvertFrom-Json } catch { exit 0 }
$path = "$($json.tool_input.file_path)"
if ([string]::IsNullOrEmpty($path)) { exit 0 }
$p = $path -replace '\\','/'

# 收新增内容(Write:content / Edit:new_string / MultiEdit:edits[].new_string)
$content = "$($json.tool_input.content)$($json.tool_input.new_string)"
foreach ($e in $json.tool_input.edits) { $content += "`n$($e.new_string)" }

$msg = $null
if ($p -match 'packages/server/migrations/[0-9]{4}_.*\.sql$') {
  $msg = "你刚动了 server migration。同步 /code/schema 的账本:在 packages/client/app/[lang]/code/schema/page.tsx 的 MIGRATIONS 数组加一行 { n: <编号>, slug, desc };新表顺手加进 TABLES。CI 守卫 tests/code-schema-api-drift.test.ts 会卡漏改。"
}
elseif ($p -match 'packages/server/src/index\.ts$' -and $content -match 'app\.route\(') {
  $msg = "你刚改了 index.ts 的路由挂载。若新挂了 route,同步 /code/api:在 packages/client/app/[lang]/code/api/page.tsx 的 covers-routes 清单加文件名 + 在 ENDPOINTS 补端点。CI 守卫 tests/code-schema-api-drift.test.ts 会卡漏改。"
}
elseif ($p -match 'packages/server/src/routes/[a-z0-9_]+\.ts$' -and $content -match '\.(get|post|put|patch|delete)\(') {
  $msg = "你刚改了 server route 文件(含端点定义)。若增删了对外端点,同步 /code/api 的 ENDPOINTS(packages/client/app/[lang]/code/api/page.tsx);新 route 文件还要进 covers-routes 清单。CI 守卫 tests/code-schema-api-drift.test.ts 会卡新挂载的 route。"
}

if ($msg) {
  $out = @{ hookSpecificOutput = @{ hookEventName = 'PostToolUse'; additionalContext = $msg } } | ConvertTo-Json -Compress
  Write-Output $out
}
exit 0
