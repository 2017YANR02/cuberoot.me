<#
.SYNOPSIS
    Validates the repository-local contract of the upstream sync PowerShell entrypoints.
#>
[CmdletBinding()]
param(
    [string]$RepoRoot = (Join-Path $PSScriptRoot '..\..\..')
)

$ErrorActionPreference = 'Stop'
$RepoRoot = [System.IO.Path]::GetFullPath($RepoRoot)

$contracts = @(
    [ordered]@{
        Id = 'all'
        Candidates = @('sync_upstream.ps1', 'scripts/upstream/sync-all.ps1')
        Parameters = @('Only', 'SkipPull', 'DryRun', 'RepoRoot', 'ValidateOnly')
    }
    [ordered]@{
        Id = 'cstimer'
        Candidates = @('_sync_cstimer.ps1', 'scripts/upstream/sync-cstimer.ps1')
        Parameters = @('CstimerDir', 'ProjectDir', 'SkipPull', 'RepoRoot', 'ValidateOnly')
    }
    [ordered]@{
        Id = 'cstimer-scramble'
        Candidates = @('_sync_cstimer_scramble.ps1', 'scripts/upstream/sync-cstimer-scramble.ps1')
        Parameters = @('CstimerDir', 'ProjectDir', 'SkipPull', 'RepoRoot', 'ValidateOnly')
    }
    [ordered]@{
        Id = 'solver'
        Candidates = @('_sync_RubiksSolverDemo.ps1', 'scripts/upstream/sync-rubiks-solver-demo.ps1')
        Parameters = @('UpstreamDir', 'LocalDir', 'DryRun', 'RepoRoot', 'ValidateOnly')
    }
    [ordered]@{
        Id = 'alg-trainers'
        Candidates = @('sync_alg_trainers.ps1', 'scripts/upstream/sync-alg-trainers.ps1')
        Parameters = @('UpstreamDir', 'LocalDir', 'DryRun', 'RepoRoot', 'ValidateOnly')
    }
    [ordered]@{
        Id = 'blddb'
        Candidates = @('scripts/upstream/sync-blddb.ps1')
        Parameters = @('BlddbDir', 'ProjectDir', 'SkipPull', 'SkipInstall', 'RepoRoot', 'ValidateOnly')
    }
    [ordered]@{
        Id = 'recordranks'
        Candidates = @('_sync_recordranks.ps1', 'scripts/upstream/sync-recordranks.ps1')
        Parameters = @(
            'RecordRanksDir', 'ProjectDir', 'SkipPull', 'DryRun', 'SkipInstall', 'RepoRoot', 'ValidateOnly'
        )
    }
)

$blockedCommands = @(
    'git', 'npm', 'pnpm', 'node', 'bash', 'java', 'php', 'mingw32-make', 'pwsh', 'powershell',
    'Start-Process', 'Invoke-WebRequest', 'Invoke-RestMethod', 'New-Item', 'Copy-Item', 'Move-Item',
    'Remove-Item', 'Set-Content', 'Add-Content', 'Out-File', 'Tee-Object'
)

$validateWrapper = @'
$ErrorActionPreference = 'Stop'
foreach ($commandName in @($env:CUBEROOT_BLOCKED_COMMANDS | ConvertFrom-Json)) {
    $body = [scriptblock]::Create("throw 'VALIDATE_ONLY_SIDE_EFFECT_COMMAND:$commandName'")
    Set-Item -LiteralPath "Function:\global:$commandName" -Value $body
}
$beforePath = $env:PATH
$invokeParams = $env:CUBEROOT_SCRIPT_PARAMS | ConvertFrom-Json -AsHashtable
& $env:CUBEROOT_SCRIPT @invokeParams
if ($env:PATH -cne $beforePath) {
    throw 'VALIDATE_ONLY_CHANGED_PATH'
}
Write-Output 'VALIDATE_ONLY_RETURNED'
'@

$recordRanksDryRunWrapper = @'
$ErrorActionPreference = 'Stop'
function global:git {
    $gitArgs = @($args | ForEach-Object { "$_" })
    if ($gitArgs.Count -lt 3 -or $gitArgs[0] -ne '-C') {
        throw "UNEXPECTED_GIT_CALL:$($gitArgs -join ' ')"
    }
    $operation = $gitArgs[2]
    $global:LASTEXITCODE = 0
    switch ($operation) {
        'branch' { 'main'; return }
        'status' { return }
        'remote' {
            if ($gitArgs[-1] -eq 'origin') { 'https://github.com/2017YANR02/RecordRanks.git'; return }
            if ($gitArgs[-1] -eq 'upstream') { 'https://github.com/mintydev789/RecordRanks.git'; return }
            throw "UNEXPECTED_REMOTE:$($gitArgs -join ' ')"
        }
        'fetch' { return }
        'merge-base' {
            if ($gitArgs[4] -eq 'origin/main' -and $gitArgs[5] -eq 'HEAD') {
                $global:LASTEXITCODE = 1
                return
            }
            if ($gitArgs[4] -eq 'HEAD' -and $gitArgs[5] -eq 'origin/main') { return }
            throw "UNEXPECTED_MERGE_BASE:$($gitArgs -join ' ')"
        }
        'rev-list' { '2'; return }
        'log' { 'abc1234 fixture upstream commit'; return }
        'merge' { throw "DRYRUN_CALLED_MERGE:$($gitArgs -join ' ')" }
        default { throw "UNEXPECTED_GIT_CALL:$($gitArgs -join ' ')" }
    }
}
$invokeParams = $env:CUBEROOT_SCRIPT_PARAMS | ConvertFrom-Json -AsHashtable
& $env:CUBEROOT_SCRIPT @invokeParams
Write-Output 'DRY_RUN_RETURNED'
'@

$flagContractWrapper = @'
$ErrorActionPreference = 'Stop'
function global:git { throw "FLAG_CONTRACT_CALLED_GIT:$($args -join ' ')" }
function global:npm { throw "FLAG_CONTRACT_CALLED_NPM:$($args -join ' ')" }
function global:pnpm { throw "FLAG_CONTRACT_CALLED_PNPM:$($args -join ' ')" }
function global:node { throw "FLAG_CONTRACT_CALLED_NODE:$($args -join ' ')" }
$invokeParams = $env:CUBEROOT_SCRIPT_PARAMS | ConvertFrom-Json -AsHashtable
try {
    & $env:CUBEROOT_SCRIPT @invokeParams
    Write-Output 'FLAG_CONTRACT_RETURNED'
}
catch {
    Write-Output "FLAG_CONTRACT_STOPPED:$($_.Exception.Message)"
}
'@

$orchestrationWrapper = @'
$ErrorActionPreference = 'Stop'
function global:Join-Path {
    param(
        [Parameter(Position = 0)] [string]$Path,
        [Parameter(Position = 1)] [string]$ChildPath
    )
    if ($Path -match '^[A-Za-z]:\\cube\\') { return "$Path/$ChildPath" }
    return Microsoft.PowerShell.Management\Join-Path -Path $Path -ChildPath $ChildPath
}
function global:Test-Path {
    [CmdletBinding(DefaultParameterSetName = 'Path')]
    param(
        [Parameter(ParameterSetName = 'Path', Position = 0)] [string[]]$Path,
        [Parameter(ParameterSetName = 'LiteralPath')] [string[]]$LiteralPath,
        [Microsoft.PowerShell.Commands.TestPathType]$PathType = [Microsoft.PowerShell.Commands.TestPathType]::Any
    )
    $candidate = if ($PSCmdlet.ParameterSetName -eq 'LiteralPath') { $LiteralPath } else { $Path }
    if ("$candidate" -match '(?i)(cstimer|RubiksSolverDemo|mihlefeld-alg-trainers|blddb)[\\/]\.git$') { return $true }
    if ($PSCmdlet.ParameterSetName -eq 'LiteralPath') {
        return Microsoft.PowerShell.Management\Test-Path -LiteralPath $LiteralPath -PathType $PathType
    }
    return Microsoft.PowerShell.Management\Test-Path -Path $Path -PathType $PathType
}
$invokeParams = $env:CUBEROOT_SCRIPT_PARAMS | ConvertFrom-Json -AsHashtable
& $env:CUBEROOT_SCRIPT @invokeParams
Write-Output 'ORCHESTRATION_CONTRACT_RETURNED'
'@

$nativeFailureWrapper = @'
$ErrorActionPreference = 'Stop'
function global:git {
    $global:LASTEXITCODE = 23
}
$invokeParams = $env:CUBEROOT_SCRIPT_PARAMS | ConvertFrom-Json -AsHashtable
& $env:CUBEROOT_SCRIPT @invokeParams
'@

$temporaryRoots = [System.Collections.Generic.List[string]]::new()

function Assert-True
{
    param(
        [bool]$Condition,
        [string]$Message
    )

    if (-not $Condition) { throw $Message }
}

function Resolve-ContractScript
{
    param(
        [System.Collections.IDictionary]$Contract,
        [string]$Root
    )

    foreach ($candidate in $Contract.Candidates)
    {
        $path = Join-Path $Root $candidate
        if (Test-Path -LiteralPath $path -PathType Leaf) { return $path }
    }
    throw "缺少 $($Contract.Id) 同步脚本：$($Contract.Candidates -join ', ')"
}

function Resolve-ContractScripts
{
    param(
        [System.Collections.IDictionary]$Contract,
        [string]$Root
    )

    $paths = @($Contract.Candidates | ForEach-Object {
        $path = Join-Path $Root $_
        if (Test-Path -LiteralPath $path -PathType Leaf) { $path }
    })
    if ($paths.Count -eq 0)
    {
        throw "缺少 $($Contract.Id) 同步脚本：$($Contract.Candidates -join ', ')"
    }
    return $paths
}

function Get-ScriptAst
{
    param([string]$Path)

    $tokens = $null
    $errors = $null
    $ast = [System.Management.Automation.Language.Parser]::ParseFile($Path, [ref]$tokens, [ref]$errors)
    if ($errors.Count -gt 0)
    {
        throw "$Path PowerShell 语法错误：$($errors.Message -join '; ')"
    }
    return $ast
}

function Assert-ParameterSurface
{
    param(
        [System.Collections.IDictionary]$Contract,
        [string]$Path
    )

    $ast = Get-ScriptAst -Path $Path
    $parameters = @($ast.ParamBlock.Parameters)
    $actual = @($parameters | ForEach-Object { $_.Name.VariablePath.UserPath })
    $expected = @($Contract.Parameters)
    Assert-True (($actual -join ',') -ceq ($expected -join ',')) "$($Contract.Id) 参数顺序/名称契约漂移：expected=$($expected -join ','); actual=$($actual -join ',')"

    $switchNames = @('SkipPull', 'DryRun', 'SkipInstall', 'ValidateOnly')
    foreach ($parameter in $parameters)
    {
        $name = $parameter.Name.VariablePath.UserPath
        $expectedType = if ($name -eq 'Only') { 'System.String[]' }
        elseif ($switchNames -contains $name) { 'System.Management.Automation.SwitchParameter' }
        else { 'System.String' }
        Assert-True ($parameter.StaticType.FullName -eq $expectedType) "$($Contract.Id).$name 类型应为 $expectedType，实际为 $($parameter.StaticType.FullName)。"
    }

    if ($Contract.Id -eq 'all')
    {
        $onlyParameter = $parameters | Where-Object { $_.Name.VariablePath.UserPath -eq 'Only' }
        $validateSet = $onlyParameter.Attributes | Where-Object { $_.TypeName.Name -eq 'ValidateSet' }
        Assert-True ($null -ne $validateSet) '-Only 必须保留 ValidateSet。'
        $actualTargets = @($validateSet.PositionalArguments | ForEach-Object { $_.SafeGetValue() })
        $expectedTargets = @('cstimer', 'solver', 'algtrainers', 'blddb', 'recordranks')
        Assert-True (($actualTargets -join ',') -ceq ($expectedTargets -join ',')) "-Only ValidateSet 漂移：$($actualTargets -join ',')"
    }
}

function Assert-RepositoryTopology
{
    $expectedRootScripts = @('sync_upstream.ps1')
    $actualRootScripts = @(
        Get-ChildItem -LiteralPath $RepoRoot -Filter '*.ps1' -File |
            ForEach-Object { $_.Name } |
            Sort-Object
    )
    Assert-True (($actualRootScripts -join "`n") -ceq ($expectedRootScripts -join "`n")) "根目录 PowerShell 入口漂移：expected=$($expectedRootScripts -join ', '); actual=$($actualRootScripts -join ', ')"

    $canonicalScripts = @(
        'scripts/upstream/sync-all.ps1'
        'scripts/upstream/sync-cstimer.ps1'
        'scripts/upstream/sync-cstimer-scramble.ps1'
        'scripts/upstream/sync-rubiks-solver-demo.ps1'
        'scripts/upstream/sync-alg-trainers.ps1'
        'scripts/upstream/sync-blddb.ps1'
        'scripts/upstream/sync-recordranks.ps1'
    )
    foreach ($relativePath in $canonicalScripts)
    {
        Assert-True (Test-Path -LiteralPath (Join-Path $RepoRoot $relativePath) -PathType Leaf) "缺少 canonical upstream 脚本：$relativePath"
    }

    foreach ($legacyPath in @(
        '_sync_cstimer.ps1'
        '_sync_cstimer_scramble.ps1'
        '_sync_blddb.ps1'
        '_sync_RubiksSolverDemo.ps1'
        '_sync_recordranks.ps1'
        'sync_alg_trainers.ps1'
    ))
    {
        Assert-True (-not (Test-Path -LiteralPath (Join-Path $RepoRoot $legacyPath))) "私有旧入口不得留在根目录：$legacyPath"
    }

    $shimTargets = [ordered]@{
        'sync_upstream.ps1' = 'scripts/upstream/sync-all.ps1'
    }
    foreach ($shimName in $shimTargets.Keys)
    {
        $shimPath = Join-Path $RepoRoot $shimName
        $shimAst = Get-ScriptAst -Path $shimPath
        $functionDefinitions = @($shimAst.FindAll({
            param($node)
            $node -is [System.Management.Automation.Language.FunctionDefinitionAst]
        }, $true))
        $shimSource = Get-Content -LiteralPath $shimPath -Raw
        Assert-True ($functionDefinitions.Count -eq 0) "$shimName 必须保持薄 shim，不得承载实现函数。"
        Assert-True ($shimSource.Contains('$PSBoundParameters')) "$shimName 必须从 PSBoundParameters 转发显式参数。"
        Assert-True ($shimSource.Contains($shimTargets[$shimName])) "$shimName 必须调用 canonical 实现 $($shimTargets[$shimName])。"
    }
}

function New-FixtureRepo
{
    $sandbox = Join-Path ([System.IO.Path]::GetTempPath()) ("cuberoot-upstream-sync-" + [guid]::NewGuid().ToString('N'))
    $fixtureRoot = Join-Path $sandbox 'repo'
    $arbitraryCwd = Join-Path $sandbox 'arbitrary-cwd'
    $externalRoot = Join-Path $sandbox 'external'
    $temporaryRoots.Add($sandbox)

    foreach ($directory in @(
        (Join-Path $fixtureRoot '.git'),
        (Join-Path $fixtureRoot 'core'),
        (Join-Path $fixtureRoot 'core\packages\client\public'),
        (Join-Path $fixtureRoot 'tools'),
        (Join-Path $fixtureRoot 'docs'),
        (Join-Path $fixtureRoot 'ops'),
        (Join-Path $fixtureRoot 'ops\contests'),
        $arbitraryCwd,
        $externalRoot
    ))
    {
        New-Item -ItemType Directory -Path $directory -Force | Out-Null
    }

    Copy-Item -LiteralPath (Join-Path $RepoRoot 'core\pnpm-workspace.yaml') -Destination (Join-Path $fixtureRoot 'core\pnpm-workspace.yaml')
    Copy-Item -LiteralPath (Join-Path $RepoRoot 'docs\generated-artifacts.json') -Destination (Join-Path $fixtureRoot 'docs\generated-artifacts.json')
    Copy-Item -LiteralPath (Join-Path $RepoRoot '.sync') -Destination (Join-Path $fixtureRoot '.sync') -Recurse
    $upstreamScripts = Join-Path $RepoRoot 'scripts\upstream'
    if (Test-Path -LiteralPath $upstreamScripts -PathType Container)
    {
        New-Item -ItemType Directory -Path (Join-Path $fixtureRoot 'scripts') -Force | Out-Null
        Copy-Item -LiteralPath $upstreamScripts -Destination (Join-Path $fixtureRoot 'scripts\upstream') -Recurse
    }
    foreach ($script in Get-ChildItem -LiteralPath $RepoRoot -Filter '*.ps1' -File)
    {
        Copy-Item -LiteralPath $script.FullName -Destination (Join-Path $fixtureRoot $script.Name)
    }

    return [pscustomobject]@{
        Sandbox = $sandbox
        Root = $fixtureRoot
        Cwd = $arbitraryCwd
        External = $externalRoot
    }
}

function Get-TreeFingerprint
{
    param([string]$Root)

    return @(
        Get-ChildItem -LiteralPath $Root -Force -Recurse | Sort-Object FullName | ForEach-Object {
            $relativePath = [System.IO.Path]::GetRelativePath($Root, $_.FullName).Replace('\', '/')
            if ($_.PSIsContainer) { "dir:$relativePath" }
            else { "file:${relativePath}:$((Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash)" }
        }
    )
}

function Get-ValidateArguments
{
    param(
        [string]$Id,
        [pscustomobject]$Fixture
    )

    switch ($Id)
    {
        'all' { return @{ Only = @('cstimer', 'solver'); SkipPull = $true; DryRun = $true } }
        'cstimer' { return @{ CstimerDir = (Join-Path $Fixture.External 'cstimer'); SkipPull = $true } }
        'cstimer-scramble' { return @{ CstimerDir = (Join-Path $Fixture.External 'cstimer'); SkipPull = $true } }
        'solver' { return @{ UpstreamDir = (Join-Path $Fixture.External 'solver'); DryRun = $true } }
        'alg-trainers' { return @{ UpstreamDir = (Join-Path $Fixture.External 'alg-trainers'); DryRun = $true } }
        'blddb' { return @{ BlddbDir = (Join-Path $Fixture.External 'blddb'); SkipPull = $true; SkipInstall = $true } }
        'recordranks' {
            return @{
                RecordRanksDir = (Join-Path $Fixture.External 'recordranks')
                SkipPull = $true
                DryRun = $true
                SkipInstall = $true
            }
        }
        default { throw "未知测试契约：$Id" }
    }
}

function Invoke-IsolatedPowerShell
{
    param(
        [string]$Wrapper,
        [string]$WorkingDirectory,
        [hashtable]$Environment,
        [string]$Description
    )

    $startInfo = [System.Diagnostics.ProcessStartInfo]::new()
    $startInfo.FileName = (Get-Command pwsh -ErrorAction Stop).Source
    $startInfo.WorkingDirectory = $WorkingDirectory
    $startInfo.UseShellExecute = $false
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true
    $startInfo.ArgumentList.Add('-NoProfile')
    $startInfo.ArgumentList.Add('-NonInteractive')
    $startInfo.ArgumentList.Add('-Command')
    $startInfo.ArgumentList.Add($Wrapper)
    foreach ($key in $Environment.Keys) { $startInfo.Environment[$key] = "$($Environment[$key])" }

    $process = [System.Diagnostics.Process]::new()
    $process.StartInfo = $startInfo
    [void]$process.Start()
    $stdoutTask = $process.StandardOutput.ReadToEndAsync()
    $stderrTask = $process.StandardError.ReadToEndAsync()
    if (-not $process.WaitForExit(30000))
    {
        $process.Kill($true)
        $process.WaitForExit()
        throw "$Description 子进程 30 秒内未退出。"
    }
    return [pscustomobject]@{
        ExitCode = $process.ExitCode
        Stdout = $stdoutTask.GetAwaiter().GetResult()
        Stderr = $stderrTask.GetAwaiter().GetResult()
    }
}

function Invoke-IsolatedFile
{
    param(
        [string]$Script,
        [string]$WorkingDirectory,
        [string[]]$Arguments = @(),
        [hashtable]$Environment = @{},
        [string]$Description
    )

    $startInfo = [System.Diagnostics.ProcessStartInfo]::new()
    $startInfo.FileName = (Get-Command pwsh -ErrorAction Stop).Source
    $startInfo.WorkingDirectory = $WorkingDirectory
    $startInfo.UseShellExecute = $false
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true
    $startInfo.ArgumentList.Add('-NoProfile')
    $startInfo.ArgumentList.Add('-NonInteractive')
    $startInfo.ArgumentList.Add('-File')
    $startInfo.ArgumentList.Add($Script)
    foreach ($argument in $Arguments) { $startInfo.ArgumentList.Add($argument) }
    foreach ($key in $Environment.Keys) { $startInfo.Environment[$key] = "$($Environment[$key])" }

    $process = [System.Diagnostics.Process]::new()
    $process.StartInfo = $startInfo
    [void]$process.Start()
    $stdoutTask = $process.StandardOutput.ReadToEndAsync()
    $stderrTask = $process.StandardError.ReadToEndAsync()
    if (-not $process.WaitForExit(30000))
    {
        $process.Kill($true)
        $process.WaitForExit()
        throw "$Description 子进程 30 秒内未退出。"
    }
    return [pscustomobject]@{
        ExitCode = $process.ExitCode
        Stdout = $stdoutTask.GetAwaiter().GetResult()
        Stderr = $stderrTask.GetAwaiter().GetResult()
    }
}

function Invoke-IsolatedValidation
{
    param(
        [string]$Script,
        [string]$WorkingDirectory,
        [hashtable]$Arguments = @{},
        [hashtable]$RootArguments = @{}
    )

    $invokeParams = @{ ValidateOnly = $true }
    foreach ($key in $RootArguments.Keys) { $invokeParams[$key] = $RootArguments[$key] }
    foreach ($key in $Arguments.Keys) { $invokeParams[$key] = $Arguments[$key] }

    return Invoke-IsolatedPowerShell -Wrapper $validateWrapper -WorkingDirectory $WorkingDirectory -Description "ValidateOnly $Script" -Environment @{
        CUBEROOT_BLOCKED_COMMANDS = ($blockedCommands | ConvertTo-Json -Compress)
        CUBEROOT_SCRIPT = $Script
        CUBEROOT_SCRIPT_PARAMS = ($invokeParams | ConvertTo-Json -Compress -Depth 4)
    }
}

function Invoke-IsolatedRecordRanksDryRun
{
    param(
        [string]$Script,
        [string]$ValidationRoot,
        [string]$RecordRanksDirectory,
        [string]$WorkingDirectory
    )

    return Invoke-IsolatedPowerShell -Wrapper $recordRanksDryRunWrapper -WorkingDirectory $WorkingDirectory -Description "RecordRanks DryRun $Script" -Environment @{
        CUBEROOT_SCRIPT = $Script
        CUBEROOT_SCRIPT_PARAMS = (@{
            RepoRoot = $ValidationRoot
            RecordRanksDir = $RecordRanksDirectory
            DryRun = $true
        } | ConvertTo-Json -Compress)
    }
}

function Invoke-IsolatedFlagContract
{
    param(
        [string]$Script,
        [string]$WorkingDirectory,
        [hashtable]$Arguments
    )

    return Invoke-IsolatedPowerShell -Wrapper $flagContractWrapper -WorkingDirectory $WorkingDirectory -Description "flag contract $Script" -Environment @{
        CUBEROOT_SCRIPT = $Script
        CUBEROOT_SCRIPT_PARAMS = ($Arguments | ConvertTo-Json -Compress -Depth 4)
    }
}

function Invoke-IsolatedOrchestration
{
    param(
        [string]$Script,
        [string]$WorkingDirectory,
        [hashtable]$Arguments
    )

    return Invoke-IsolatedPowerShell -Wrapper $orchestrationWrapper -WorkingDirectory $WorkingDirectory -Description "orchestration $Script" -Environment @{
        CUBEROOT_SCRIPT = $Script
        CUBEROOT_SCRIPT_PARAMS = ($Arguments | ConvertTo-Json -Compress -Depth 4)
    }
}

function Set-OrchestrationProbeScripts
{
    param([pscustomobject]$Fixture)

    $probeSources = @{
        'cstimer' = @'
param([string]$CstimerDir, [string]$ProjectDir, [switch]$SkipPull, [string]$RepoRoot, [switch]$ValidateOnly)
Write-Output "CHILD_PROBE:cstimer:RepoRoot=${RepoRoot}:SkipPull=$([bool]$SkipPull)"
'@
        'cstimer-scramble' = @'
param([string]$CstimerDir, [string]$ProjectDir, [switch]$SkipPull, [string]$RepoRoot, [switch]$ValidateOnly)
Write-Output "CHILD_PROBE:cstimer-scramble:RepoRoot=${RepoRoot}:SkipPull=$([bool]$SkipPull)"
'@
        'solver' = @'
param([string]$UpstreamDir, [string]$LocalDir, [switch]$DryRun, [string]$RepoRoot, [switch]$ValidateOnly)
Write-Output "CHILD_PROBE:solver:RepoRoot=${RepoRoot}:DryRun=$([bool]$DryRun)"
'@
        'alg-trainers' = @'
param([string]$UpstreamDir, [string]$LocalDir, [switch]$DryRun, [string]$RepoRoot, [switch]$ValidateOnly)
Write-Output "CHILD_PROBE:alg-trainers:RepoRoot=${RepoRoot}:DryRun=$([bool]$DryRun)"
'@
        'blddb' = @'
param([string]$BlddbDir, [string]$ProjectDir, [switch]$SkipPull, [switch]$SkipInstall, [string]$RepoRoot, [switch]$ValidateOnly)
Write-Output "CHILD_PROBE:blddb:RepoRoot=${RepoRoot}:SkipPull=$([bool]$SkipPull)"
'@
        'recordranks' = @'
param([string]$RecordRanksDir, [string]$ProjectDir, [switch]$SkipPull, [switch]$DryRun, [switch]$SkipInstall, [string]$RepoRoot, [switch]$ValidateOnly)
Write-Output "CHILD_PROBE:recordranks:RepoRoot=${RepoRoot}:SkipPull=$([bool]$SkipPull):DryRun=$([bool]$DryRun)"
'@
    }

    foreach ($contract in $contracts | Where-Object { $_.Id -ne 'all' })
    {
        foreach ($candidate in $contract.Candidates)
        {
            $path = Join-Path $Fixture.Root $candidate
            $parent = Split-Path $path -Parent
            if (-not (Test-Path -LiteralPath $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
            Set-Content -LiteralPath $path -Value $probeSources[$contract.Id] -NoNewline
        }
    }
}

function Format-ProcessFailure
{
    param(
        [string]$Id,
        [pscustomobject]$Result
    )

    return "$Id exit=$($Result.ExitCode)`nstdout:`n$($Result.Stdout)`nstderr:`n$($Result.Stderr)"
}

function Invoke-TestGit
{
    param(
        [string]$WorkingDirectory,
        [string[]]$Arguments
    )

    & git -C $WorkingDirectory @Arguments | Out-Null
    if ($LASTEXITCODE -ne 0)
    {
        throw "fixture git $($Arguments -join ' ') 失败（退出码 $LASTEXITCODE）"
    }
}

function Get-TestGitText
{
    param(
        [string]$WorkingDirectory,
        [string[]]$Arguments
    )

    $output = & git -C $WorkingDirectory @Arguments 2>&1
    if ($LASTEXITCODE -ne 0)
    {
        throw "fixture git $($Arguments -join ' ') 失败（退出码 $LASTEXITCODE）：$($output -join "`n")"
    }
    return (($output | ForEach-Object { "$_" }) -join "`n").Trim()
}

function Assert-GitStashGuard
{
    $sandbox = Join-Path ([System.IO.Path]::GetTempPath()) ("cuberoot-stash-guard-" + [guid]::NewGuid().ToString('N'))
    $temporaryRoots.Add($sandbox)
    New-Item -ItemType Directory -Path $sandbox -Force | Out-Null
    Invoke-TestGit -WorkingDirectory $sandbox -Arguments @('init', '--quiet')
    Invoke-TestGit -WorkingDirectory $sandbox -Arguments @('config', 'user.name', 'CubeRoot Contract Test')
    Invoke-TestGit -WorkingDirectory $sandbox -Arguments @('config', 'user.email', 'contract-test@invalid.example')
    Set-Content -LiteralPath (Join-Path $sandbox 'tracked.txt') -Value 'base' -NoNewline
    Invoke-TestGit -WorkingDirectory $sandbox -Arguments @('add', 'tracked.txt')
    Invoke-TestGit -WorkingDirectory $sandbox -Arguments @('commit', '--quiet', '-m', 'fixture base')

    . (Join-Path $RepoRoot '.sync\sync_utils.ps1')

    Set-Content -LiteralPath (Join-Path $sandbox 'tracked.txt') -Value 'historical' -NoNewline
    Invoke-TestGit -WorkingDirectory $sandbox -Arguments @('stash', 'push', '--quiet', '-m', 'historical stash')
    $historicalStash = Get-TestGitText -WorkingDirectory $sandbox -Arguments @('stash', 'list', '-1', '--format=%H')

    $untrackedPath = Join-Path $sandbox 'untracked.txt'
    Set-Content -LiteralPath $untrackedPath -Value 'preserve me' -NoNewline
    $createdStash = Push-SyncWorkingTreeStash -WorkingDirectory $sandbox -Message 'contract test stash'
    Assert-True (-not [string]::IsNullOrWhiteSpace($createdStash)) '只有 untracked 文件时也必须创建本轮 stash。'
    Assert-True ($createdStash -ne $historicalStash) '本轮 stash 不得误认历史 stash。'
    Assert-True (-not (Test-Path -LiteralPath $untrackedPath)) '本轮 stash 必须包含 untracked 文件。'

    Restore-SyncWorkingTreeStash -WorkingDirectory $sandbox -StashCommit $createdStash
    Assert-True (Test-Path -LiteralPath $untrackedPath) '恢复后必须还原 untracked 文件。'
    $latestAfterRestore = Get-TestGitText -WorkingDirectory $sandbox -Arguments @('stash', 'list', '-1', '--format=%H')
    Assert-True ($latestAfterRestore -eq $historicalStash) '恢复本轮 stash 后必须保留历史 stash。'

    Set-Content -LiteralPath $untrackedPath -Value 'guard me' -NoNewline
    $guardedStash = Push-SyncWorkingTreeStash -WorkingDirectory $sandbox -Message 'guarded stash'
    Set-Content -LiteralPath (Join-Path $sandbox 'tracked.txt') -Value 'concurrent' -NoNewline
    Invoke-TestGit -WorkingDirectory $sandbox -Arguments @('stash', 'push', '--quiet', '-m', 'concurrent stash')

    $guardRejected = $false
    try
    {
        Restore-SyncWorkingTreeStash -WorkingDirectory $sandbox -StashCommit $guardedStash
    }
    catch
    {
        $guardRejected = $_.Exception.Message -match 'stash 栈在同步期间发生变化'
    }
    Assert-True $guardRejected 'stash 栈发生变化时必须拒绝 pop。'
    $stashText = Get-TestGitText -WorkingDirectory $sandbox -Arguments @('stash', 'list', '--format=%H')
    $stashCommits = @($stashText -split "`n")
    Assert-True ($stashCommits -contains $guardedStash) '拒绝 pop 后必须保留本轮 stash。'
}

function Assert-UpstreamVersionRecordContract
{
    param([pscustomobject]$Fixture)

    . (Join-Path $Fixture.Root '.sync\sync_utils.ps1')

    $sourceRepo = Join-Path $Fixture.External 'version-source'
    New-Item -ItemType Directory -Path $sourceRepo -Force | Out-Null
    Invoke-TestGit -WorkingDirectory $sourceRepo -Arguments @('init', '--quiet')
    Invoke-TestGit -WorkingDirectory $sourceRepo -Arguments @('config', 'user.name', 'CubeRoot Contract Test')
    Invoke-TestGit -WorkingDirectory $sourceRepo -Arguments @('config', 'user.email', 'contract-test@invalid.example')
    Set-Content -LiteralPath (Join-Path $sourceRepo 'fixture.txt') -Value 'upstream fixture' -NoNewline
    Invoke-TestGit -WorkingDirectory $sourceRepo -Arguments @('add', 'fixture.txt')
    Invoke-TestGit -WorkingDirectory $sourceRepo -Arguments @('commit', '--quiet', '-m', 'fixture upstream')
    Invoke-TestGit -WorkingDirectory $sourceRepo -Arguments @(
        'remote', 'add', 'origin', 'https://github.com/cs0x7f/cstimer.git'
    )

    $ledgerPath = Join-Path $Fixture.Root 'docs\generated-artifacts.json'
    $originalLedger = Get-Content -LiteralPath $ledgerPath -Raw
    $ledger = $originalLedger | ConvertFrom-Json
    $artifact = @($ledger.artifacts | Where-Object { $_.id -eq 'tools.cstimer' })
    Assert-True ($artifact.Count -eq 1) '版本记录 fixture 必须只有一个 tools.cstimer 条目。'

    Write-UpstreamVersionRecord -RepoRoot $Fixture.Root -ArtifactId 'tools.cstimer' -WorkingDirectory $sourceRepo
    $recordPath = Join-Path $Fixture.Root $artifact[0].versionRecord.path
    Assert-True (Test-Path -LiteralPath $recordPath -PathType Leaf) '版本记录 writer 没有写入 ledger 指定路径。'
    $record = Get-Content -LiteralPath $recordPath -Raw
    $sha = Get-TestGitText -WorkingDirectory $sourceRepo -Arguments @('rev-parse', '--verify', 'HEAD')
    $date = Get-TestGitText -WorkingDirectory $sourceRepo -Arguments @('show', '-s', '--format=%cI', 'HEAD')
    Assert-True ($record.StartsWith('# Generated from docs/generated-artifacts.json. Do not edit.')) '版本记录缺少结构化生成头。'
    Assert-True ($record.Contains("Artifact: tools.cstimer")) '版本记录缺少 artifact id。'
    Assert-True ($record.Contains("Source: https://github.com/cs0x7f/cstimer")) '版本记录没有使用 ledger source。'
    Assert-True ($record.Contains("Ref: branch master")) '版本记录没有使用 ledger ref。'
    Assert-True ($record.Contains("Commit: $sha")) '版本记录没有使用真实 40 位 HEAD。'
    Assert-True ($record.Contains("Date: $date")) '版本记录没有使用真实 commit 日期。'
    Assert-True ($record.Contains("License: GPL-3.0-only")) '版本记录没有使用 ledger license。'
    Assert-True (-not $record.Contains("`r")) '版本记录必须保持 LF。'

    $artifact[0].versionRecord.format = 'sha40'
    [System.IO.File]::WriteAllText(
        $ledgerPath,
        (($ledger | ConvertTo-Json -Depth 100) -replace "`r`n", "`n") + "`n",
        [System.Text.UTF8Encoding]::new($false)
    )
    $formatRejected = $false
    try
    {
        Write-UpstreamVersionRecord -RepoRoot $Fixture.Root -ArtifactId 'tools.cstimer' -WorkingDirectory $sourceRepo
    }
    catch
    {
        $formatRejected = $_.Exception.Message -match 'structured-v1'
    }
    Assert-True $formatRejected '版本记录 writer 必须拒绝非 structured-v1 ledger 配置。'

    $ledger = $originalLedger | ConvertFrom-Json
    $artifact = @($ledger.artifacts | Where-Object { $_.id -eq 'tools.cstimer' })
    $artifact[0].versionRecord.path = '../escaped-version.txt'
    [System.IO.File]::WriteAllText(
        $ledgerPath,
        (($ledger | ConvertTo-Json -Depth 100) -replace "`r`n", "`n") + "`n",
        [System.Text.UTF8Encoding]::new($false)
    )
    $escapedPath = [System.IO.Path]::GetFullPath((Join-Path $Fixture.Root '../escaped-version.txt'))
    $pathRejected = $false
    try
    {
        Write-UpstreamVersionRecord -RepoRoot $Fixture.Root -ArtifactId 'tools.cstimer' -WorkingDirectory $sourceRepo
    }
    catch
    {
        $pathRejected = $_.Exception.Message -match '越出仓库'
    }
    Assert-True $pathRejected '版本记录 writer 必须拒绝越出仓库的相对路径。'
    Assert-True (-not (Test-Path -LiteralPath $escapedPath)) '版本记录路径拒绝后不得在仓库外落盘。'
}

function Assert-VersionRecordWriterPlacement
{
    $specs = @(
        [pscustomobject]@{ File = 'sync-cstimer.ps1'; Artifact = 'tools.cstimer' }
        [pscustomobject]@{ File = 'sync-cstimer-scramble.ps1'; Artifact = 'tools.cstimer-scramble' }
        [pscustomobject]@{ File = 'sync-rubiks-solver-demo.ps1'; Artifact = 'tools.rubiks-solver-demo' }
        [pscustomobject]@{ File = 'sync-alg-trainers.ps1'; Artifact = 'tools.alg-trainers' }
        [pscustomobject]@{ File = 'sync-blddb.ps1'; Artifact = 'tools.blddb' }
    )

    foreach ($spec in $specs)
    {
        $path = Join-Path $RepoRoot "scripts/upstream/$($spec.File)"
        $ast = Get-ScriptAst -Path $path
        $writers = @($ast.FindAll({
            param($node)
            $node -is [System.Management.Automation.Language.CommandAst] -and
                $node.GetCommandName() -eq 'Write-UpstreamVersionRecord'
        }, $true))
        Assert-True ($writers.Count -eq 1) "$($spec.File) 必须且只能推进一次版本记录。"
        Assert-True ($writers[0].Extent.Text.Contains("'$($spec.Artifact)'")) "$($spec.File) 写入了错误的 artifact id。"
    }

    $cstimerPath = Join-Path $RepoRoot 'scripts/upstream/sync-cstimer.ps1'
    $cstimerAst = Get-ScriptAst -Path $cstimerPath
    $langGuards = @($cstimerAst.FindAll({
        param($node)
        $node -is [System.Management.Automation.Language.IfStatementAst] -and
            $node.Clauses.Count -eq 1 -and
            $node.Clauses[0].Item1.Extent.Text -match '\$html\.Contains\(\$anchor\)'
    }, $true))
    Assert-True ($langGuards.Count -eq 1) 'csTimer 必须有唯一 LANG_CUR 注入成功门禁。'
    $langThrows = @($langGuards[0].ElseClause.FindAll({
        param($node)
        $node -is [System.Management.Automation.Language.ThrowStatementAst]
    }, $true))
    Assert-True ($langThrows.Count -gt 0) 'csTimer 缺少 LANG_CUR 锚点时必须 throw。'
    $cstimerWriter = @($cstimerAst.FindAll({
        param($node)
        $node -is [System.Management.Automation.Language.CommandAst] -and
            $node.GetCommandName() -eq 'Write-UpstreamVersionRecord'
    }, $true))[0]
    Assert-True ($cstimerWriter.Extent.StartOffset -gt $langGuards[0].Extent.EndOffset) 'csTimer 必须在 LANG_CUR 补丁成功后才推进版本记录。'

    $scramblePath = Join-Path $RepoRoot 'scripts/upstream/sync-cstimer-scramble.ps1'
    $scrambleAst = Get-ScriptAst -Path $scramblePath
    $exportGuards = @($scrambleAst.FindAll({
        param($node)
        $node -is [System.Management.Automation.Language.IfStatementAst] -and
            $node.Clauses.Count -eq 1 -and
            $node.Clauses[0].Item1.Extent.Text -match '\$missing\.Count\s+-gt\s+0'
    }, $true))
    Assert-True ($exportGuards.Count -eq 1) 'csTimer scramble 必须有唯一自加导出完整性门禁。'
    $scrambleWriter = @($scrambleAst.FindAll({
        param($node)
        $node -is [System.Management.Automation.Language.CommandAst] -and
            $node.GetCommandName() -eq 'Write-UpstreamVersionRecord'
    }, $true))[0]
    Assert-True ($scrambleWriter.Extent.StartOffset -gt $exportGuards[0].Extent.EndOffset) 'csTimer scramble 必须在自加导出通过后才推进版本记录。'

    foreach ($file in @('sync-rubiks-solver-demo.ps1', 'sync-alg-trainers.ps1'))
    {
        $path = Join-Path $RepoRoot "scripts/upstream/$file"
        $ast = Get-ScriptAst -Path $path
        $dryRunGuards = @($ast.FindAll({
            param($node)
            $node -is [System.Management.Automation.Language.IfStatementAst] -and
                $node.Clauses.Count -eq 1 -and
                $node.Clauses[0].Item1.Extent.Text -match '^\s*\$DryRun\s*$' -and
                $null -ne $node.ElseClause
        }, $true))
        Assert-True ($dryRunGuards.Count -eq 1) "$file 必须有唯一 DryRun/真实写入终态分支。"
        $elseWriters = @($dryRunGuards[0].ElseClause.FindAll({
            param($node)
            $node -is [System.Management.Automation.Language.CommandAst] -and
                $node.GetCommandName() -eq 'Write-UpstreamVersionRecord'
        }, $true))
        Assert-True ($elseWriters.Count -eq 1) "$file 只能在非 DryRun 分支推进版本记录。"
    }

    $blddbPath = Join-Path $RepoRoot 'scripts/upstream/sync-blddb.ps1'
    $blddbSource = Get-Content -LiteralPath $blddbPath -Raw
    $postprocessOffset = $blddbSource.LastIndexOf('blddb_postprocess.mjs', [System.StringComparison]::Ordinal)
    $writerOffset = $blddbSource.IndexOf('Write-UpstreamVersionRecord', [System.StringComparison]::Ordinal)
    Assert-True ($postprocessOffset -ge 0 -and $writerOffset -gt $postprocessOffset) 'BLDDB 必须在后处理成功后才推进版本记录。'
    Assert-True ($blddbSource.Contains("'worktree', 'add', '--detach'")) 'BLDDB 必须从锁定 commit 建 detached worktree。'
    Assert-True ($blddbSource.Contains('-WorkingDirectory $sourceDir')) 'BLDDB provenance 必须来自实际构建 worktree。'
    Assert-True ($blddbSource.Contains("'--data-dir', (Join-Path `$candidate 'data')")) 'BLDDB 后处理必须先写候选目录。'
    Assert-True ($blddbSource.Contains('Move-Item -LiteralPath $dst -Destination $previous')) 'BLDDB 发布必须先保留旧目录。'
    Assert-True ($blddbSource.Contains('Move-Item -LiteralPath $previous -Destination $dst')) 'BLDDB 发布失败必须恢复旧目录。'
    Assert-True (-not $blddbSource.Contains('Remove-Item $dst')) 'BLDDB 禁止先删除现役目录。'
    Assert-True (-not $blddbSource.Contains("'pull', '--ff-only'")) 'BLDDB canonical 禁止 pull/merge 主 clone。'
}

try
{
    Assert-RepositoryTopology

    foreach ($contract in $contracts)
    {
        foreach ($script in Resolve-ContractScripts -Contract $contract -Root $RepoRoot)
        {
            Assert-ParameterSurface -Contract $contract -Path $script
        }
    }

    Assert-GitStashGuard
    Assert-VersionRecordWriterPlacement

    $fixture = New-FixtureRepo
    Assert-UpstreamVersionRecordContract -Fixture $fixture
    $alternateFixture = New-FixtureRepo
    foreach ($contract in $contracts)
    {
        foreach ($script in Resolve-ContractScripts -Contract $contract -Root $fixture.Root)
        {
            $arguments = Get-ValidateArguments -Id $contract.Id -Fixture $fixture
            $candidateId = "$($contract.Id):$([System.IO.Path]::GetRelativePath($fixture.Root, $script))"
            $rootModes = @(
                [pscustomobject]@{ Name = 'explicit'; Arguments = @{ RepoRoot = $alternateFixture.Root }; ExpectedRoot = $alternateFixture.Root }
                [pscustomobject]@{ Name = 'default'; Arguments = @{}; ExpectedRoot = $fixture.Root }
            )
            if ($contract.Id -ne 'all')
            {
                $legacyRootName = if ($contract.Id -in @('solver', 'alg-trainers')) { 'LocalDir' } else { 'ProjectDir' }
                $rootModes += [pscustomobject]@{
                    Name = "legacy-$legacyRootName"
                    Arguments = @{ $legacyRootName = $alternateFixture.Root }
                    ExpectedRoot = $alternateFixture.Root
                }
            }

            foreach ($rootMode in $rootModes)
            {
                $before = @(Get-TreeFingerprint -Root $fixture.Sandbox)
                $alternateBefore = @(Get-TreeFingerprint -Root $alternateFixture.Sandbox)
                $result = Invoke-IsolatedValidation -Script $script -WorkingDirectory $fixture.Cwd -Arguments $arguments -RootArguments $rootMode.Arguments
                $modeId = "${candidateId}:$($rootMode.Name)"
                $failure = Format-ProcessFailure -Id $modeId -Result $result
                Assert-True ($result.ExitCode -eq 0) $failure
                Assert-True ($result.Stdout.Contains('VALIDATE_ONLY_RETURNED')) "$failure`n脚本没有 return 给调用方。"
                Assert-True ($result.Stdout.Contains($rootMode.ExpectedRoot)) "$failure`n校验输出没有声明参数选定的仓库根：$($rootMode.ExpectedRoot)"
                Assert-True (-not (($result.Stdout + $result.Stderr).Contains('VALIDATE_ONLY_SIDE_EFFECT_COMMAND'))) $failure
                $after = @(Get-TreeFingerprint -Root $fixture.Sandbox)
                Assert-True (($before -join "`n") -ceq ($after -join "`n")) "$modeId -ValidateOnly 改写了测试沙箱。"
                $alternateAfter = @(Get-TreeFingerprint -Root $alternateFixture.Sandbox)
                Assert-True (($alternateBefore -join "`n") -ceq ($alternateAfter -join "`n")) "$modeId -ValidateOnly 改写了备用仓库沙箱。"
            }
        }
    }

    $cstimerFixture = Join-Path $fixture.External 'cstimer'
    $solverFixture = Join-Path $fixture.External 'solver'
    $algTrainersFixture = Join-Path $fixture.External 'alg-trainers'
    $blddbFixture = Join-Path $fixture.External 'blddb'
    foreach ($directory in @(
        (Join-Path $cstimerFixture '.git'),
        (Join-Path $solverFixture '.git'),
        (Join-Path $solverFixture 'src'),
        (Join-Path $algTrainersFixture '.git'),
        (Join-Path $algTrainersFixture 'src'),
        (Join-Path $algTrainersFixture 'style'),
        (Join-Path $blddbFixture '.git'),
        (Join-Path $blddbFixture 'node_modules')
    ))
    {
        New-Item -ItemType Directory -Path $directory -Force | Out-Null
    }

    $flagContracts = @(
        [pscustomobject]@{
            Id = 'cstimer'
            Arguments = @{ RepoRoot = $fixture.Root; CstimerDir = $cstimerFixture; SkipPull = $true }
            Expected = 'FLAG_CONTRACT_STOPPED'
            RequiredOutput = @('--SkipPull')
        }
        [pscustomobject]@{
            Id = 'cstimer-scramble'
            Arguments = @{ RepoRoot = $fixture.Root; CstimerDir = $cstimerFixture; SkipPull = $true }
            Expected = 'FLAG_CONTRACT_STOPPED'
            RequiredOutput = @('--SkipPull')
        }
        [pscustomobject]@{
            Id = 'solver'
            Arguments = @{ RepoRoot = $fixture.Root; UpstreamDir = $solverFixture; DryRun = $true }
            Expected = 'FLAG_CONTRACT_RETURNED'
            RequiredOutput = @('[DRY RUN] No files were modified.')
        }
        [pscustomobject]@{
            Id = 'alg-trainers'
            Arguments = @{ RepoRoot = $fixture.Root; UpstreamDir = $algTrainersFixture; DryRun = $true }
            Expected = 'FLAG_CONTRACT_RETURNED'
            RequiredOutput = @('[DRY RUN] No files were modified.')
        }
    )
    foreach ($flagContract in $flagContracts)
    {
        $contract = $contracts | Where-Object { $_.Id -eq $flagContract.Id }
        foreach ($script in Resolve-ContractScripts -Contract $contract -Root $fixture.Root)
        {
            $beforeFlag = @(Get-TreeFingerprint -Root $fixture.Sandbox)
            $result = Invoke-IsolatedFlagContract -Script $script -WorkingDirectory $fixture.Cwd -Arguments $flagContract.Arguments
            $flagId = "$($flagContract.Id):$([System.IO.Path]::GetRelativePath($fixture.Root, $script))"
            $failure = Format-ProcessFailure -Id $flagId -Result $result
            $combinedOutput = $result.Stdout + $result.Stderr
            Assert-True ($result.ExitCode -eq 0) $failure
            Assert-True ($combinedOutput.Contains($flagContract.Expected)) "$failure`n关键 flag 分支没有到达预期终点。"
            Assert-True (-not $combinedOutput.Contains('FLAG_CONTRACT_CALLED_')) "$failure`n关键 flag 没有抑制对应原生命令。"
            foreach ($requiredOutput in $flagContract.RequiredOutput)
            {
                Assert-True ($combinedOutput.Contains($requiredOutput)) "$failure`n缺少 flag 行为证据：$requiredOutput"
            }
            $afterFlag = @(Get-TreeFingerprint -Root $fixture.Sandbox)
            Assert-True (($beforeFlag -join "`n") -ceq ($afterFlag -join "`n")) "$flagId 的 flag 行为测试改写了沙箱。"
        }
    }

    $recordRanksFixture = Join-Path $fixture.External 'recordranks'
    New-Item -ItemType Directory -Path (Join-Path $recordRanksFixture '.git') -Force | Out-Null
    $recordRanksRefDirectory = Join-Path $fixture.Root 'ops\contests'
    New-Item -ItemType Directory -Path $recordRanksRefDirectory -Force | Out-Null
    Set-Content -LiteralPath (Join-Path $recordRanksRefDirectory 'recordranks-ref.txt') -Value ('0' * 40) -NoNewline
    $recordRanksContract = $contracts | Where-Object { $_.Id -eq 'recordranks' }
    foreach ($recordRanksScript in Resolve-ContractScripts -Contract $recordRanksContract -Root $fixture.Root)
    {
        $beforeDryRun = @(Get-TreeFingerprint -Root $fixture.Sandbox)
        $dryRunResult = Invoke-IsolatedRecordRanksDryRun -Script $recordRanksScript -ValidationRoot $fixture.Root -RecordRanksDirectory $recordRanksFixture -WorkingDirectory $fixture.Cwd
        $dryRunFailure = Format-ProcessFailure -Id "recordranks-dry-run:$recordRanksScript" -Result $dryRunResult
        Assert-True ($dryRunResult.ExitCode -eq 0) $dryRunFailure
        Assert-True ($dryRunResult.Stdout.Contains('DRY_RUN_RETURNED')) "$dryRunFailure`nDryRun 没有在 merge 前返回。"
        Assert-True (-not (($dryRunResult.Stdout + $dryRunResult.Stderr).Contains('DRYRUN_CALLED_MERGE'))) $dryRunFailure
        $afterDryRun = @(Get-TreeFingerprint -Root $fixture.Sandbox)
        Assert-True (($beforeDryRun -join "`n") -ceq ($afterDryRun -join "`n")) 'RecordRanks DryRun 改写了测试沙箱。'
    }

    $invalidRoot = Join-Path $fixture.Sandbox 'not-a-repo'
    New-Item -ItemType Directory -Path $invalidRoot | Out-Null
    $beforeInvalid = @(Get-TreeFingerprint -Root $fixture.Sandbox)
    $allScript = Resolve-ContractScript -Contract $contracts[0] -Root $fixture.Root
    $invalidResult = Invoke-IsolatedValidation -Script $allScript -WorkingDirectory $fixture.Cwd -RootArguments @{ RepoRoot = $invalidRoot }
    Assert-True ($invalidResult.ExitCode -ne 0) '错误 RepoRoot 必须返回非零。'
    Assert-True (-not (($invalidResult.Stdout + $invalidResult.Stderr).Contains('VALIDATE_ONLY_SIDE_EFFECT_COMMAND'))) '错误 RepoRoot 触发了副作用命令。'
    $afterInvalid = @(Get-TreeFingerprint -Root $fixture.Sandbox)
    Assert-True (($beforeInvalid -join "`n") -ceq ($afterInvalid -join "`n")) '错误 RepoRoot 改写了测试沙箱。'

    $invalidOnly = Invoke-IsolatedValidation -Script $allScript -WorkingDirectory $fixture.Cwd -RootArguments @{ RepoRoot = $fixture.Root } -Arguments @{ Only = @('not-a-target') }
    Assert-True ($invalidOnly.ExitCode -ne 0) '-Only 非法值必须返回非零。'

    $missingScript = Resolve-ContractScript -Contract $contracts[1] -Root $fixture.Root
    $hiddenScript = "$missingScript.contract-missing"
    Rename-Item -LiteralPath $missingScript -NewName ([System.IO.Path]::GetFileName($hiddenScript))
    try
    {
        $beforeMissing = @(Get-TreeFingerprint -Root $fixture.Sandbox)
        $missingResult = Invoke-IsolatedValidation -Script $allScript -WorkingDirectory $fixture.Cwd -RootArguments @{ RepoRoot = $fixture.Root }
        Assert-True ($missingResult.ExitCode -ne 0) '总入口漏掉内部脚本时必须返回非零。'
        $missingOutput = $missingResult.Stdout + $missingResult.Stderr
        Assert-True ($missingOutput.Contains([System.IO.Path]::GetFileName($missingScript))) '缺少内部脚本时必须明确报告该脚本名。'
        Assert-True (-not $missingOutput.Contains('VALIDATE_ONLY_SIDE_EFFECT_COMMAND')) '缺少内部脚本时不得触发副作用命令。'
        $afterMissing = @(Get-TreeFingerprint -Root $fixture.Sandbox)
        Assert-True (($beforeMissing -join "`n") -ceq ($afterMissing -join "`n")) '缺少内部脚本校验改写了测试沙箱。'
    }
    finally
    {
        Rename-Item -LiteralPath $hiddenScript -NewName ([System.IO.Path]::GetFileName($missingScript))
    }

    $orchestrationFixture = New-FixtureRepo
    Set-OrchestrationProbeScripts -Fixture $orchestrationFixture
    $allContract = $contracts | Where-Object { $_.Id -eq 'all' }
    $orchestrationCases = @(
        [pscustomobject]@{
            Name = 'skip-pull-build-targets'
            Arguments = @{
                RepoRoot = $orchestrationFixture.Root
                Only = @('cstimer', 'blddb')
                SkipPull = $true
            }
            Required = @(
                "CHILD_PROBE:cstimer:RepoRoot=$($orchestrationFixture.Root):SkipPull=True",
                "CHILD_PROBE:cstimer-scramble:RepoRoot=$($orchestrationFixture.Root):SkipPull=True",
                "CHILD_PROBE:blddb:RepoRoot=$($orchestrationFixture.Root):SkipPull=True"
            )
            Forbidden = @('CHILD_PROBE:solver:', 'CHILD_PROBE:alg-trainers:', 'CHILD_PROBE:recordranks:')
        }
        [pscustomobject]@{
            Name = 'dry-run-preview-targets'
            Arguments = @{
                RepoRoot = $orchestrationFixture.Root
                Only = @('solver', 'algtrainers', 'recordranks')
                SkipPull = $true
                DryRun = $true
            }
            Required = @(
                "CHILD_PROBE:solver:RepoRoot=$($orchestrationFixture.Root):DryRun=True",
                "CHILD_PROBE:alg-trainers:RepoRoot=$($orchestrationFixture.Root):DryRun=True",
                "CHILD_PROBE:recordranks:RepoRoot=$($orchestrationFixture.Root):SkipPull=True:DryRun=True"
            )
            Forbidden = @('CHILD_PROBE:cstimer:', 'CHILD_PROBE:cstimer-scramble:', 'CHILD_PROBE:blddb:')
        }
    )
    foreach ($orchestrationScript in Resolve-ContractScripts -Contract $allContract -Root $orchestrationFixture.Root)
    {
        foreach ($case in $orchestrationCases)
        {
            $beforeOrchestration = @(Get-TreeFingerprint -Root $orchestrationFixture.Sandbox)
            $result = Invoke-IsolatedOrchestration -Script $orchestrationScript -WorkingDirectory $orchestrationFixture.Cwd -Arguments $case.Arguments
            $orchestrationId = "$($case.Name):$([System.IO.Path]::GetRelativePath($orchestrationFixture.Root, $orchestrationScript))"
            $failure = Format-ProcessFailure -Id $orchestrationId -Result $result
            $combinedOutput = $result.Stdout + $result.Stderr
            $outputLines = @($combinedOutput -split "\r?\n")
            Assert-True ($result.ExitCode -eq 0) $failure
            Assert-True ($combinedOutput.Contains('ORCHESTRATION_CONTRACT_RETURNED')) "$failure`n编排器没有正常返回。"
            foreach ($required in $case.Required)
            {
                Assert-True ($outputLines -contains $required) "$failure`n缺少逐子脚本编排行为证据：$required"
            }
            foreach ($forbidden in $case.Forbidden)
            {
                Assert-True (-not $combinedOutput.Contains($forbidden)) "$failure`n-Only 运行了未选择目标：$forbidden"
            }
            $afterOrchestration = @(Get-TreeFingerprint -Root $orchestrationFixture.Sandbox)
            Assert-True (($beforeOrchestration -join "`n") -ceq ($afterOrchestration -join "`n")) "$orchestrationId 改写了测试沙箱。"
        }
    }

    $fileEntryFixture = New-FixtureRepo
    $fileEntryScript = Join-Path $fileEntryFixture.Root 'sync_upstream.ps1'
    $beforeFileEntry = @(Get-TreeFingerprint -Root $fileEntryFixture.Sandbox)
    $fileEntryResult = Invoke-IsolatedFile -Script $fileEntryScript -WorkingDirectory $fileEntryFixture.Cwd -Description 'root file entrypoint' -Arguments @(
        '-RepoRoot', $fileEntryFixture.Root,
        '-Only', 'cstimer',
        '-SkipPull',
        '-DryRun',
        '-ValidateOnly'
    )
    $fileEntryFailure = Format-ProcessFailure -Id 'root-file-entrypoint' -Result $fileEntryResult
    Assert-True ($fileEntryResult.ExitCode -eq 0) $fileEntryFailure
    Assert-True (($fileEntryResult.Stdout + $fileEntryResult.Stderr).Contains($fileEntryFixture.Root)) "$fileEntryFailure`n根入口没有从任意 cwd 使用显式 RepoRoot。"
    $afterFileEntry = @(Get-TreeFingerprint -Root $fileEntryFixture.Sandbox)
    Assert-True (($beforeFileEntry -join "`n") -ceq ($afterFileEntry -join "`n")) '真实 -File 根入口改写了测试沙箱。'

    $nativeFailureFixture = New-FixtureRepo
    $nativeFailureUpstream = Join-Path $nativeFailureFixture.External 'cstimer'
    New-Item -ItemType Directory -Path (Join-Path $nativeFailureUpstream '.git') -Force | Out-Null
    $nativeFailureScript = Join-Path $nativeFailureFixture.Root 'scripts/upstream/sync-cstimer.ps1'
    $beforeNativeFailure = @(Get-TreeFingerprint -Root $nativeFailureFixture.Sandbox)
    $nativeFailureResult = Invoke-IsolatedPowerShell -Wrapper $nativeFailureWrapper -WorkingDirectory $nativeFailureFixture.Cwd -Description 'native failure propagation' -Environment @{
        CUBEROOT_SCRIPT = $nativeFailureScript
        CUBEROOT_SCRIPT_PARAMS = (@{
            RepoRoot = $nativeFailureFixture.Root
            CstimerDir = $nativeFailureUpstream
        } | ConvertTo-Json -Compress)
    }
    $nativeFailureOutput = $nativeFailureResult.Stdout + $nativeFailureResult.Stderr
    Assert-True ($nativeFailureResult.ExitCode -ne 0) '原生命令失败必须让同步脚本非零退出。'
    Assert-True ($nativeFailureOutput.Contains('退出码 23')) '原生命令失败必须报告原始退出码 23。'
    $afterNativeFailure = @(Get-TreeFingerprint -Root $nativeFailureFixture.Sandbox)
    Assert-True (($beforeNativeFailure -join "`n") -ceq ($afterNativeFailure -join "`n")) '原生命令失败测试改写了测试沙箱。'

    $orchestrationPath = Join-Path $RepoRoot 'scripts/upstream/sync-all.ps1'
    $orchestrationSource = Get-Content -LiteralPath $orchestrationPath -Raw
    $orchestrationAst = Get-ScriptAst -Path $orchestrationPath
    $cstimerGuards = @($orchestrationAst.FindAll({
        param($node)
        if ($node -isnot [System.Management.Automation.Language.IfStatementAst]) { return $false }
        return $node.Clauses.Count -gt 0 -and $node.Clauses[0].Item1.Extent.Text -match '^\s*\$targets\s+-contains\s+[''\"]cstimer[''\"]\s*$'
    }, $true))
    Assert-True ($cstimerGuards.Count -eq 1) '-Only cstimer 必须映射到唯一的 csTimer 编排分支。'
    $cstimerBranchSource = $cstimerGuards[0].Clauses[0].Item2.Extent.Text
    Assert-True ($cstimerBranchSource -match '(?m)^\s*&[^\r\n]*sync-cstimer\.ps1[^\r\n]*-RepoRoot\s+\$root[^\r\n]*-SkipPull') 'csTimer 分支必须调用 canonical 主同步任务，并显式传 RepoRoot 和 SkipPull。'
    Assert-True ($cstimerBranchSource -match '(?m)^\s*&[^\r\n]*sync-cstimer-scramble\.ps1[^\r\n]*-RepoRoot\s+\$root[^\r\n]*-SkipPull') 'csTimer 分支必须调用 canonical 打乱同步任务，并显式传 RepoRoot 和 SkipPull。'
    Assert-True ($orchestrationSource -match '(?m)^\s*&[^\r\n]*sync-rubiks-solver-demo\.ps1[^\r\n]*-RepoRoot\s+\$root[^\r\n]*@dry') 'Solver 调用必须显式传 RepoRoot 和 DryRun 参数集。'
    Assert-True ($orchestrationSource -match '(?m)^\s*&[^\r\n]*sync-alg-trainers\.ps1[^\r\n]*-RepoRoot\s+\$root[^\r\n]*@dry') 'Alg-Trainers 调用必须显式传 RepoRoot 和 DryRun 参数集。'
    Assert-True ($orchestrationSource -match '\$blddbArgs\s*=\s*@\{\s*RepoRoot\s*=\s*\$root\s*\}') 'BLDDB 参数集必须显式包含 RepoRoot。'
    Assert-True ($orchestrationSource -match 'if\s*\(\$SkipPull\)\s*\{\s*\$blddbArgs\.SkipPull\s*=\s*\$true\s*\}') 'BLDDB 必须按需转发 SkipPull。'
    Assert-True ($orchestrationSource -match '(?m)^\s*&[^\r\n]*sync-blddb\.ps1[^\r\n]*@blddbArgs') 'BLDDB canonical 调用必须使用受测参数集。'
    Assert-True ($orchestrationSource -match '\$dry\s*=\s*if\s*\(\$DryRun\)\s*\{\s*@\{\s*DryRun\s*=\s*\$true\s*\}') 'DryRun 参数集必须继续由总入口转发。'
    Assert-True ($orchestrationSource -match '\$recordRanksArgs\s*=\s*@\{\s*RepoRoot\s*=\s*\$root\s*\}') 'RecordRanks 参数集必须显式包含 RepoRoot。'
    Assert-True ($orchestrationSource -match 'if\s*\(\$SkipPull\)\s*\{\s*\$recordRanksArgs\.SkipPull\s*=\s*\$true\s*\}') 'RecordRanks 必须转发 SkipPull。'
    Assert-True ($orchestrationSource -match 'if\s*\(\$DryRun\)\s*\{\s*\$recordRanksArgs\.DryRun\s*=\s*\$true\s*\}') 'RecordRanks 必须转发 DryRun。'
    Assert-True ($orchestrationSource -match '(?m)^\s*&[^\r\n]*sync-recordranks\.ps1[^\r\n]*@recordRanksArgs') 'RecordRanks canonical 调用必须使用受测参数集。'

    Write-Host "upstream sync PowerShell contract passed: $RepoRoot" -ForegroundColor Green
}
finally
{
    foreach ($temporaryRoot in $temporaryRoots)
    {
        if (Test-Path -LiteralPath $temporaryRoot)
        {
            Remove-Item -LiteralPath $temporaryRoot -Recurse -Force
        }
    }
}
