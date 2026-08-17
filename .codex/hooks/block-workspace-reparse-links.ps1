# PreToolUse guard: disposable verification trees must never link into a live workspace.
# A temporary worktree gets its own pnpm install; pnpm's store provides safe deduplication.
$ErrorActionPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$workspaceReparseGuardRepoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))

function Invoke-WorkspaceReparseLinkGuard {
  param([Parameter(Mandatory = $true)][string]$Payload)

  try { $request = $Payload | ConvertFrom-Json } catch { return $null }
  $command = "$($request.tool_input.command)"
  if ([string]::IsNullOrWhiteSpace($command)) { return $null }

  $repoRoot = $workspaceReparseGuardRepoRoot
  $workdir = "$($request.tool_input.workdir)"
  if ([string]::IsNullOrWhiteSpace($workdir)) { $workdir = "$($request.tool_input.cwd)" }
  if ([string]::IsNullOrWhiteSpace($workdir)) { $workdir = "$($request.cwd)" }

  $inRepo = $false
  if (-not [string]::IsNullOrWhiteSpace($workdir)) {
    try {
      $resolvedWorkdir = [System.IO.Path]::GetFullPath($workdir)
      $inRepo = $resolvedWorkdir.Equals($repoRoot, [System.StringComparison]::OrdinalIgnoreCase) -or
        $resolvedWorkdir.StartsWith($repoRoot + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)
    } catch { $inRepo = $false }
  }
  if (-not $inRepo) {
    $normalizedCommand = $command -replace '\\', '/'
    $normalizedRoot = $repoRoot -replace '\\', '/'
    $inRepo = $normalizedCommand.IndexOf($normalizedRoot, [System.StringComparison]::OrdinalIgnoreCase) -ge 0
  }
  if (-not $inRepo) { return $null }

  $segments = $command -split '(?:&&|\|\||[;|\r\n])'
  foreach ($rawSegment in $segments) {
    $segment = $rawSegment.Trim()
    if (-not $segment) { continue }

    # Searching or printing the forbidden syntax is read-only and must stay usable.
    if ($segment -match '(?i)^(?:rg|grep|Select-String|Get-Content|Write-Output|Write-Host|echo|git\s+(?:grep|diff|show|status))\b') {
      continue
    }

    $newItemLink = $segment -match '(?i)\bNew-Item\b[^;\r\n]{0,600}-(?:ItemType|Type)\s+(?:''|\")?(?:Junction|SymbolicLink)\b'
    $mklink = $segment -match '(?i)(?:^|\s)mklink(?:\.exe)?\b'
    $junctionTool = $segment -match '(?i)^\s*(?:&\s*)?(?:junction|junction64)(?:\.exe)?\b'
    $unixLink = $segment -match '(?i)^\s*(?:sudo\s+)?ln\s+[^\r\n;]*-[^\s]*s'
    $apiLink = $segment -match '(?i)(?:CreateSymbolicLink|(?:^|\.)symlink(?:Sync)?|os\.symlink)\s*\('

    if ($newItemLink -or $mklink -or $junctionTool -or $unixLink -or $apiLink) {
      return (@{
        hookSpecificOutput = @{
          hookEventName = 'PreToolUse'
          permissionDecision = 'deny'
          permissionDecisionReason = 'BLOCKED: CubeRoot 禁止用 Junction/SymbolicLink 让临时目录或 worktree 复用真实工作区。临时验证目录请独立运行 pnpm install --offline --frozen-lockfile；pnpm store 会安全去重。'
        }
      } | ConvertTo-Json -Compress)
    }
  }

  return $null
}

if ($MyInvocation.InvocationName -ne '.') {
  $payload = [Console]::In.ReadToEnd()
  $decision = Invoke-WorkspaceReparseLinkGuard -Payload $payload
  if ($decision) { Write-Output $decision }
  exit 0
}
