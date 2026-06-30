# SessionStart check (local-only, informational): warns if the global PreToolUse
# hooks registered in ~/.claude/settings.json have drifted from what
# core/packages/client/app/[lang]/code/guards/_guards.ts documents on /code/guards.
#
# Why local-only: CI runs on a cloud runner with no access to this machine's
# ~/.claude — only this script, running here, can actually see both sides. It never
# blocks (SessionStart hooks can't deny); stdout becomes session-start context for
# the assistant, who can then flag it and update _guards.ts.
#
# Registered in .claude/settings.local.json (gitignored, this machine only) — not
# in the global ~/.claude/settings.json, so it doesn't touch other projects.

$ErrorActionPreference = 'SilentlyContinue'

$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..') -ErrorAction SilentlyContinue).Path
if (-not $repoRoot) { exit 0 }

$globalSettingsPath = Join-Path $env:USERPROFILE '.claude\settings.json'
$guardsDataPath = Join-Path $repoRoot 'core\packages\client\app\[lang]\code\guards\_guards.ts'

if (-not (Test-Path -LiteralPath $globalSettingsPath) -or -not (Test-Path -LiteralPath $guardsDataPath)) { exit 0 }

try {
    $settings = Get-Content -LiteralPath $globalSettingsPath -Raw | ConvertFrom-Json -ErrorAction Stop
} catch { exit 0 }

# Every *.ps1 / *.mjs / *.cjs hook script basename referenced anywhere in the
# PreToolUse hook commands (all matcher groups: Edit|Write|MultiEdit, Bash|PowerShell,
# the playwright screenshot matcher, etc — every group is a guard /code/guards should know about).
$registered = New-Object System.Collections.Generic.HashSet[string]
foreach ($group in $settings.hooks.PreToolUse) {
    foreach ($h in $group.hooks) {
        if (-not $h.command) { continue }
        foreach ($m in [regex]::Matches($h.command, '[\w-]+\.(ps1|mjs|cjs)')) {
            [void]$registered.Add($m.Value)
        }
    }
}

# Every hook filename _guards.ts documents (PAIRED_GUARDS.hook + PROCESS_GUARDS.hook).
# Fields like "block-handwritten-trad.ps1 → hook-detect-traditional.mjs" use "→" to
# show what the registered hook delegates to internally — only the part BEFORE "→"
# is the thing actually registered in settings.json, so only that part is checked.
$guardsSrc = Get-Content -LiteralPath $guardsDataPath -Raw
$documented = New-Object System.Collections.Generic.HashSet[string]
foreach ($m in [regex]::Matches($guardsSrc, "hook:\s*'([^']+)'")) {
    $registeredPart = ($m.Groups[1].Value -split '→')[0]
    foreach ($f in [regex]::Matches($registeredPart, '[\w-]+\.(ps1|mjs|cjs)')) {
        [void]$documented.Add($f.Value)
    }
}

$missing = $documented | Where-Object { -not $registered.Contains($_) }
$undocumented = $registered | Where-Object { -not $documented.Contains($_) }

if ($missing.Count -eq 0 -and $undocumented.Count -eq 0) { exit 0 }

Write-Output '/code/guards drift check (local, vs ~/.claude/settings.json):'
if ($missing.Count -gt 0) {
    Write-Output "  documented on the page but no longer registered globally (renamed/removed?): $($missing -join ', ')"
}
if ($undocumented.Count -gt 0) {
    Write-Output "  registered globally but missing from the page (forgot to document?): $($undocumented -join ', ')"
}
Write-Output '  -> review core/packages/client/app/[lang]/code/guards/_guards.ts'
exit 0
