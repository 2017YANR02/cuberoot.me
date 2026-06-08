# PreToolUse guard: 在写入瞬间拦裸 history.pushState/replaceState + popstate 监听。
# 全站 URL 状态走 nuqs（useQueryState / useQueryStates）。只管 client-next 的页面/源码 TS(X)。
# 真正特殊的走 ALLOWLIST（与 tests/url-state-no-raw-history.test.ts 的 ALLOWLIST 保持一致）。
# 这是即时反馈层；CI 的 vitest 守卫是任何机器/来源的最终兜底。
$ErrorActionPreference = 'SilentlyContinue'
$raw = [Console]::In.ReadToEnd()
try { $j = $raw | ConvertFrom-Json } catch { exit 0 }

$fp = "$($j.tool_input.file_path)" -replace '\\', '/'
if (-not $fp) { exit 0 }

# 只管 client-next 下 app/components/lib/hooks/i18n 的 .ts/.tsx
if ($fp -notmatch '/packages/client-next/') { exit 0 }
if ($fp -notmatch '\.(ts|tsx)$') { exit 0 }
if ($fp -notmatch '/(app|components|lib|hooks|i18n)/') { exit 0 }
# 另一团队的 roux 实验 WIP 不管
if ($fp -match '/(roux|_roux|roux-smoke)(/|$)') { exit 0 }

# 豁免清单（与 vitest 守卫一致 —— 改这里也要改那里）
$allow = @(
  'i18n/i18n-client.ts',
  'app/[lang]/wca/globe/GlobeMapClient.tsx',
  'app/[lang]/calc/_components/stores/calc_store.ts',
  'app/[lang]/recon/submit/ReconSubmitForm.tsx',
  'app/[lang]/code/stack/_tools/react-router.tsx'
)
foreach ($a in $allow) { if ($fp.EndsWith($a)) { exit 0 } }

# 收集本次写入的新内容（Edit: new_string / Write: content / MultiEdit: edits[].new_string）
$content = ''
if ($j.tool_input.content) { $content += "`n$($j.tool_input.content)" }
if ($j.tool_input.new_string) { $content += "`n$($j.tool_input.new_string)" }
if ($j.tool_input.edits) { foreach ($e in $j.tool_input.edits) { $content += "`n$($e.new_string)" } }
if (-not $content) { exit 0 }

$hits = @()
if ($content -match '\bhistory\s*\.\s*pushState\s*\(') { $hits += 'history.pushState()' }
if ($content -match '\bhistory\s*\.\s*replaceState\s*\(') { $hits += 'history.replaceState()' }
if ($content -match "addEventListener\s*\(\s*['""]popstate") { $hits += "addEventListener('popstate')" }
if ($content -match '\bwindow\s*\.\s*onpopstate\b') { $hits += 'window.onpopstate' }

if ($hits.Count -gt 0) {
  [Console]::Error.WriteLine("BLOCKED: 检测到裸 $($hits -join ', ')。全站 URL 状态走 nuqs(useQueryState/useQueryStates):视图/tab/模式/浮层用 .withOptions({ history: 'push' }),筛选/搜索/子开关用默认 replace。约定见 CLAUDE.md 的「URL 状态 / 后退导航」。若确属特殊(zustand data-blob / 自定义编码 / 全局非 React infra),把文件加进 tests/url-state-no-raw-history.test.ts 的 ALLOWLIST 与本 hook 的 allow 列表,并在调用处加 eslint-disable + 理由。")
  exit 2
}
exit 0
