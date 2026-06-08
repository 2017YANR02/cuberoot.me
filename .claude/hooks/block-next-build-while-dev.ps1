# PreToolUse guard: block `next build` (client-next) while a Next dev server is
# live on :3000 — concurrent writes to the shared .next/ tear its manifest JSON
# and 500 the whole site. dev stopped -> allowed (local prod-repro stays usable).
$ErrorActionPreference = 'SilentlyContinue'
$raw = [Console]::In.ReadToEnd()
try { $j = $raw | ConvertFrom-Json } catch { exit 0 }
$cmd = "$($j.tool_input.command)"
if (-not $cmd) { exit 0 }

# Match only a real Next prod-build invocation — direct `next build`, or a
# package-manager run targeting client-next with a standalone `build` token.
# Standalone token `(^|\s)build(\s|$)` excludes paths like build-manifest.json /
# foo-build.ts, so read/ls commands under client-next aren't false-blocked.
# visualcube/shared/vite-client build untouched (no .next).
$isNextBuild = ($cmd -match '(^|[\s/])next\s+build(\s|$)') -or `
  (($cmd -match 'client-next') -and ($cmd -match '(^|\s)build(\s|$)') -and ($cmd -match '\b(pnpm|npm|yarn|turbo|nr)\b'))
if (-not $isNextBuild) { exit 0 }

$devUp = $false
try {
  $c = New-Object System.Net.Sockets.TcpClient
  $iar = $c.BeginConnect('127.0.0.1', 3000, $null, $null)
  if ($iar.AsyncWaitHandle.WaitOne(500)) { $devUp = $c.Connected }
  $c.Close()
} catch {}

if ($devUp) {
  [Console]::Error.WriteLine("BLOCKED: Next dev 正在 :3000 运行。build 会写坏共享的 .next manifest -> 全站 500。验证类型用 typecheck（不碰 .next）；真要本地 build 先停 dev。")
  exit 2
}
exit 0
