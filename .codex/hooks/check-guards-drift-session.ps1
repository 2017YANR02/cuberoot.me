# SessionStart check (local-only, informational):warns if the project PreToolUse
# hooks registered in .codex/hooks.json have drifted from what
# core/packages/client/app/[lang]/code/guards/_guards.ts documents on /code/guards.
# It never blocks;stdout becomes session-start context for the assistant.

$ErrorActionPreference = 'SilentlyContinue'

$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..') -ErrorAction SilentlyContinue).Path
if (-not $repoRoot) { exit 0 }

$hooksConfigPath = Join-Path $repoRoot '.codex\hooks.json'
$guardsDataPath = Join-Path $repoRoot 'core\packages\client\app\[lang]\code\guards\_guards.ts'

if (-not (Test-Path -LiteralPath $hooksConfigPath) -or -not (Test-Path -LiteralPath $guardsDataPath)) { exit 0 }

try {
    $settings = Get-Content -LiteralPath $hooksConfigPath -Raw | ConvertFrom-Json -ErrorAction Stop
} catch { exit 0 }

# Every *.ps1 / *.mjs / *.cjs hook script basename referenced anywhere in the
# PreToolUse hook commands in the repository Codex configuration.
$registered = New-Object System.Collections.Generic.HashSet[string]
foreach ($group in $settings.hooks.PreToolUse) {
    foreach ($h in $group.hooks) {
        if (-not $h.command) { continue }
        foreach ($m in [regex]::Matches($h.command, '[\w-]+\.(ps1|mjs|cjs)')) {
            [void]$registered.Add($m.Value)
        }
    }
}

# Payload adapters are transport helpers,not guards shown on /code/guards.
[void]$registered.Remove('adapt-codex-write-payload.mjs')
[void]$registered.Remove('adapt-codex-command-payload.mjs')

# Every project-scoped hook filename _guards.ts documents
# (PAIRED_GUARDS.hook + PROCESS_GUARDS.hook). User-scoped hooks live in the
# workstation configuration and must not be compared with this repo's hooks.json.
# Fields like "block-handwritten-trad.ps1 → hook-detect-traditional.mjs" use "→" to
# show what the registered hook delegates to internally — only the part BEFORE "→"
# is the thing actually registered in hooks.json, so only that part is checked.
$guardsSrc = Get-Content -LiteralPath $guardsDataPath -Raw
$documented = New-Object System.Collections.Generic.HashSet[string]
foreach ($m in [regex]::Matches($guardsSrc, "(?s)\{\s*id:\s*'[^']+',\s*scope:\s*'project',\s*hook:\s*'([^']+)'")) {
    $registeredPart = ($m.Groups[1].Value -split '→')[0]
    foreach ($f in [regex]::Matches($registeredPart, '[\w-]+\.(ps1|mjs|cjs)')) {
        [void]$documented.Add($f.Value)
    }
}

$missing = $documented | Where-Object { -not $registered.Contains($_) }
$undocumented = $registered | Where-Object { -not $documented.Contains($_) }

if ($missing.Count -eq 0 -and $undocumented.Count -eq 0) { exit 0 }

Write-Output '/code/guards drift check (local, vs .codex/hooks.json):'
if ($missing.Count -gt 0) {
    Write-Output "  documented on the page but not registered for Codex (renamed/removed?): $($missing -join ', ')"
}
if ($undocumented.Count -gt 0) {
    Write-Output "  registered for Codex but missing from the page (forgot to document?): $($undocumented -join ', ')"
}
Write-Output '  -> review core/packages/client/app/[lang]/code/guards/_guards.ts'
exit 0
