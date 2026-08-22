# PreToolUse hook: browser-delivered source may not use RegExp lookbehind.
# Older WebKit rejects the whole chunk at parse time; use captured boundaries instead.
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::InputEncoding = [System.Text.Encoding]::UTF8

$payload = [Console]::In.ReadToEnd()
if ([string]::IsNullOrWhiteSpace($payload)) { exit 0 }
if (-not ($payload.Contains('(?<=') -or $payload.Contains('(?<!'))) { exit 0 }

try { $request = $payload | ConvertFrom-Json } catch { exit 0 }
$filePath = "$($request.tool_input.file_path)" -replace '\\', '/'
$isBrowserSource = $filePath -match '/core/packages/client/(?:app|components|data|hooks|i18n|lib|types|wasm)/.+\.(?:[cm]?[jt]sx?)$' -or
  $filePath -match '/core/packages/platform/(?:app|components|data|lib)/.+\.(?:[cm]?[jt]sx?)$' -or
  $filePath -match '/core/packages/(?:shared|visualcube)/src/.+\.(?:[cm]?[jt]sx?)$'
if (-not $isBrowserSource) { exit 0 }

$content = "$($request.tool_input.content)$($request.tool_input.new_string)"
foreach ($edit in $request.tool_input.edits) { $content += "`n$($edit.new_string)" }
if (-not ($content.Contains('(?<=') -or $content.Contains('(?<!'))) { exit 0 }

(@{
  hookSpecificOutput = @{
    hookEventName = 'PreToolUse'
    permissionDecision = 'deny'
    permissionDecisionReason = '浏览器端源码禁用正则后行断言。旧版 WebKit 会在解析 chunk 时整段失败；请改用捕获边界或显式检查前一个字符。'
  }
} | ConvertTo-Json -Compress -Depth 5)
exit 0
