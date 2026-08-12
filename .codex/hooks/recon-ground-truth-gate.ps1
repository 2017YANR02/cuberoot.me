# PreToolUse hook: a commit that stages reconstruction logic or recon ground-truth
# fixtures must match a successful full ground-truth run for the exact current content.
# Registered in .codex/hooks.json for Codex command calls.
# CI still runs the ground-truth test as the final fallback.
$ErrorActionPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::InputEncoding = [System.Text.Encoding]::UTF8

$payload = [Console]::In.ReadToEnd()
if ([string]::IsNullOrWhiteSpace($payload)) { exit 0 }
try { $request = $payload | ConvertFrom-Json } catch { exit 0 }

$command = "$($request.tool_input.command)"
if ($command -notmatch '(?i)(?:^|\s)git(?:\.exe)?(?:\s+-C\s+(?:"[^"]+"|''[^'']+''|\S+))?\s+commit\b') { exit 0 }

$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$workdir = "$($request.tool_input.workdir)"
if ([string]::IsNullOrWhiteSpace($workdir)) { $workdir = "$($request.tool_input.cwd)" }
if ([string]::IsNullOrWhiteSpace($workdir)) { $workdir = "$($request.cwd)" }

$inRepo = $false
if (-not [string]::IsNullOrWhiteSpace($workdir)) {
  try {
    $resolvedWorkdir = [System.IO.Path]::GetFullPath($workdir)
    $inRepo = $resolvedWorkdir.Equals($repoRoot, [System.StringComparison]::OrdinalIgnoreCase) -or
      $resolvedWorkdir.StartsWith($repoRoot + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)
  } catch { exit 0 }
} else {
  $normalizedCommand = $command -replace '\\', '/'
  $normalizedRoot = $repoRoot -replace '\\', '/'
  $inRepo = $normalizedCommand.IndexOf($normalizedRoot, [System.StringComparison]::OrdinalIgnoreCase) -ge 0
}
if (-not $inRepo) { exit 0 }

$gate = Join-Path $repoRoot 'core/packages/client/scripts/recon-ground-truth-gate.mjs'
if (-not (Test-Path $gate)) { exit 0 }
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { exit 0 }

$detail = (& node $gate check-staged 2>&1 | Out-String).Trim()
if ($LASTEXITCODE -eq 0) { exit 0 }

$reason = '提交已拦截：复盘算法或 ground-truth 集合有改动，但当前内容尚无有效的全集测试凭证。先运行 pnpm --filter @cuberoot/client test:recon-ground-truth；新增多少条 fixture 都会由同一入口全部测试。'
if (-not [string]::IsNullOrWhiteSpace($detail)) { $reason += " 检查结果：$detail" }
(@{
  hookSpecificOutput = @{
    hookEventName = 'PreToolUse'
    permissionDecision = 'deny'
    permissionDecisionReason = $reason
  }
} | ConvertTo-Json -Compress)
exit 0
