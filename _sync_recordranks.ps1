<#
.SYNOPSIS
    一键把 RecordRanks 上游合入本站 fork，验证、推送 fork，并更新部署 SHA。
.DESCRIPTION
    上游代码在 D:\cube\RecordRanks 维护；本站只保存精确 commit 到
    ops/contests/recordranks-ref.txt。脚本不会提交或推送 cuberoot.me。
.PARAMETER SkipPull
    不 fetch/merge 上游，只验证并发布 RecordRanks 当前 HEAD。
.PARAMETER DryRun
    只 fetch 并报告待同步 commit，不 merge、不验证、不 push、不改部署 SHA。
.PARAMETER SkipInstall
    跳过 pnpm install --frozen-lockfile；仅确认依赖已经同步时使用。
.PARAMETER RepoRoot
    cuberoot.me 仓库根目录；保留 ProjectDir 作为旧参数别名。
.PARAMETER ValidateOnly
    只读校验仓库和脚本内部依赖后退出。
#>
param(
    [string]$RecordRanksDir = 'D:\cube\RecordRanks',
    [string]$ProjectDir = $PSScriptRoot,
    [switch]$SkipPull,
    [switch]$DryRun,
    [switch]$SkipInstall,
    [string]$RepoRoot,
    [switch]$ValidateOnly
)

$ErrorActionPreference = 'Stop'
$syncBootstrapRoot = if ($RepoRoot) { [IO.Path]::GetFullPath($RepoRoot) } else { [IO.Path]::GetFullPath($ProjectDir) }
. (Join-Path $syncBootstrapRoot '.sync\sync_utils.ps1')
$ProjectDir = Resolve-CubeRootRepoRoot -RepoRoot $RepoRoot -LegacyRoot $ProjectDir -ScriptRoot $PSScriptRoot
Assert-SyncInternalFiles -RepoRoot $ProjectDir -RelativePaths @(
    '_sync_recordranks.ps1'
    '.sync/sync_utils.ps1'
) -PowerShellScripts @('_sync_recordranks.ps1')
if ($ValidateOnly)
{
    Write-Host "RecordRanks 同步脚本校验通过：$ProjectDir" -ForegroundColor Green
    return
}

function Invoke-Git
{
    param([string[]]$GitArgs)

    $arguments = @('-C', $RecordRanksDir) + $GitArgs
    Invoke-CheckedNativeCommand -FilePath 'git' -ArgumentList $arguments
}

function Get-GitText
{
    param([string[]]$GitArgs)

    $arguments = @('-C', $RecordRanksDir) + $GitArgs
    return Get-CheckedNativeText -FilePath 'git' -ArgumentList $arguments
}

function Invoke-Pnpm
{
    param([string[]]$PnpmArgs)

    Invoke-CheckedNativeCommand -FilePath 'pnpm' -ArgumentList $PnpmArgs
}

if (-not (Test-Path -LiteralPath (Join-Path $RecordRanksDir '.git')))
{
    throw "$RecordRanksDir 不是 clone。先运行：git clone https://github.com/2017YANR02/RecordRanks.git `"$RecordRanksDir`""
}
if (-not (Test-Path -LiteralPath (Join-Path $ProjectDir '.git')))
{
    throw "$ProjectDir 不是 cuberoot.me 仓库"
}
$refPath = Join-Path $ProjectDir 'ops\contests\recordranks-ref.txt'
if (-not (Test-Path -LiteralPath $refPath))
{
    throw "缺少部署引用：$refPath"
}
$currentRef = (Get-Content -LiteralPath $refPath -Raw).Trim()
if ($currentRef -notmatch '^[0-9a-f]{40}$')
{
    throw "部署引用不是完整 Git SHA：$currentRef"
}

$branch = Get-GitText @('branch', '--show-current')
if ($branch -ne 'main')
{
    throw "RecordRanks 当前分支是 $branch，需要先切到 main"
}

$dirty = Get-GitText @('status', '--porcelain=v1', '--untracked-files=all')
if ($dirty)
{
    throw "RecordRanks 工作区不干净，先处理这些改动：`n$dirty"
}

$originUrl = Get-GitText @('remote', 'get-url', 'origin')
$upstreamUrl = Get-GitText @('remote', 'get-url', 'upstream')
if ($originUrl -notmatch '(?i)github\.com[:/]2017YANR02/RecordRanks(?:\.git)?$')
{
    throw "origin 不是本站 fork：$originUrl"
}
if ($upstreamUrl -notmatch '(?i)github\.com[:/]mintydev789/RecordRanks(?:\.git)?$')
{
    throw "upstream 不是 mintydev789/RecordRanks：$upstreamUrl"
}

if (-not $SkipPull)
{
    Write-Host '[1/6] 拉取 origin 和 upstream...' -ForegroundColor Cyan
    Invoke-Git @('fetch', '--prune', 'origin', 'main')
    Invoke-Git @('fetch', '--prune', 'upstream', 'main')

    $originIsAncestor = Test-CheckedGitAncestor -WorkingDirectory $RecordRanksDir -Ancestor 'origin/main' -Descendant 'HEAD'
    $headIsOriginAncestor = Test-CheckedGitAncestor -WorkingDirectory $RecordRanksDir -Ancestor 'HEAD' -Descendant 'origin/main'

    $comparisonHead = 'HEAD'
    if (-not $originIsAncestor)
    {
        if ($headIsOriginAncestor)
        {
            if ($DryRun)
            {
                $comparisonHead = 'origin/main'
                Write-Host 'RecordRanks 本地 main 落后 origin/main；DryRun 不移动分支。' -ForegroundColor Yellow
            }
            else
            {
                Invoke-Git @('merge', '--ff-only', 'origin/main')
            }
        }
        else
        {
            throw '本地 main 与 origin/main 已分叉，脚本不会自动覆盖；请先手工合并。'
        }
    }

    $pendingRange = "${comparisonHead}..upstream/main"
    $pending = [int](Get-GitText @('rev-list', '--count', $pendingRange))
    if ($DryRun)
    {
        if ($pending -eq 0)
        {
            Write-Host 'RecordRanks 上游已是最新。' -ForegroundColor Green
        }
        else
        {
            Write-Host "RecordRanks 有 $pending 个上游 commit 待合并：" -ForegroundColor Yellow
            Invoke-Git @('log', '--oneline', '--decorate', $pendingRange)
        }
        return
    }

    if ($pending -eq 0)
    {
        Write-Host '  上游已是最新。' -ForegroundColor DarkGray
    }
    else
    {
        Write-Host "  合并 $pending 个上游 commit..." -ForegroundColor Green
        try
        {
            Invoke-Git @('merge', '--no-edit', 'upstream/main')
        }
        catch
        {
            $mergeFailure = $_.Exception.Message
            try
            {
                Invoke-Git @('merge', '--abort')
            }
            catch
            {
                throw "上游合并失败，自动中止也失败；请立即检查仓库状态。`n合并：$mergeFailure`n中止：$($_.Exception.Message)"
            }
            throw "上游合并失败，已自动中止；请手工核对兼容补丁。`n$mergeFailure"
        }
    }
}
elseif ($DryRun)
{
    Write-Host 'DryRun + SkipPull：未执行任何操作。' -ForegroundColor Yellow
    return
}

$revision = Get-GitText @('rev-parse', 'HEAD')
$shortRevision = Get-GitText @('rev-parse', '--short', 'HEAD')
$pinnedType = Get-GitText @('cat-file', '-t', $currentRef)
if ($pinnedType -ne 'commit')
{
    throw "当前部署引用不存在或不是 commit：$currentRef"
}

Write-Host '[2/6] 审核高风险变更...' -ForegroundColor Cyan
if ($currentRef -ne $revision)
{
    $critical = Get-GitText @(
        'diff', '--name-only', "$currentRef..$revision", '--',
        'client/.env.example',
        'client/package.json5',
        'client/pnpm-lock.yaml',
        'client/proxy.ts',
        'client/server/db/drizzle',
        'client/server/logger.ts',
        'client/app/api/healthcheck/healthcheck.ts'
    )
    if ($critical)
    {
        Write-Host "  环境、依赖、migration 或本站兼容点有变化：`n$critical" -ForegroundColor Yellow
    }
    else
    {
        Write-Host '  环境、依赖、migration 和本站兼容点无变化。' -ForegroundColor DarkGray
    }

    $migrationChanges = Get-GitText @(
        'diff', '--name-status', "$currentRef..$revision", '--',
        ':(glob)client/server/db/drizzle/*/migration.sql'
    )
    $mutatedMigrations = @($migrationChanges -split "`n" | Where-Object { $_ -and $_ -notmatch '^A\s' })
    if ($mutatedMigrations.Count -gt 0)
    {
        throw "上游修改或删除了已发布 migration，线上校验会拒绝：`n$($mutatedMigrations -join "`n")"
    }
}
else
{
    Write-Host '  本次没有新上游 commit。' -ForegroundColor DarkGray
}

$loggerSource = [IO.File]::ReadAllText((Join-Path $RecordRanksDir 'client\server\logger.ts'))
$healthcheckSource = [IO.File]::ReadAllText((Join-Path $RecordRanksDir 'client\app\api\healthcheck\healthcheck.ts'))
$proxySource = [IO.File]::ReadAllText((Join-Path $RecordRanksDir 'client\proxy.ts'))
if ($loggerSource -notmatch 'const logflareConfigured = Boolean\(' -or
    $loggerSource -notmatch 'transport \? pino\(transport\) : pino\(\)')
{
    throw '本站的可选 Logflare 兼容补丁已丢失；不要推送，先核对 logger.ts。'
}
if ($healthcheckSource -notmatch '!process\.env\.EMAIL_HOST \|\| !process\.env\.EMAIL_PORT' -or
    $healthcheckSource -notmatch 'configured: false')
{
    throw '本站的可选 SMTP 健康检查补丁已丢失；不要推送，先核对 healthcheck.ts。'
}
if ($proxySource -notmatch 'function getSingleTenantDestination' -or
    $proxySource -notmatch 'NextResponse\.redirect\(getSingleTenantDestination' -or
    $proxySource -match 'NextResponse\.rewrite\(request\.url\.replace')
{
    throw '本站的单租户公开路由兼容补丁已丢失；不要推送，先核对 proxy.ts。'
}
Write-Host '  本站 Logflare、SMTP、单租户路由兼容补丁仍有效。' -ForegroundColor DarkGray

$clientDir = Join-Path $RecordRanksDir 'client'
$validationEnv = [ordered]@{
    NEXT_PUBLIC_PROJECT_NAME = 'CubeRoot Contests'
    PROJECT_ID = 'cuberoot-contests'
    NEXT_PUBLIC_AUTH_PROVIDERS = 'credential'
    NEXT_PUBLIC_MULTITENANCY_ENABLED = 'false'
}
$oldValidationEnv = @{}
foreach ($name in $validationEnv.Keys)
{
    $oldValidationEnv[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
    [Environment]::SetEnvironmentVariable($name, $validationEnv[$name], 'Process')
}
Push-Location $clientDir
try
{
    Write-Host '[3/6] 安装并检查...' -ForegroundColor Cyan
    if ($SkipInstall)
    {
        Write-Host '  已跳过 pnpm install。' -ForegroundColor DarkGray
    }
    else
    {
        Invoke-Pnpm @('install', '--frozen-lockfile')
    }
    Invoke-Pnpm @('exec', 'tsc', '--noEmit')
    Invoke-Pnpm @('test')

    Write-Host '[4/6] 生产构建...' -ForegroundColor Cyan
    $buildEnv = [ordered]@{
        NODE_ENV = 'production'
        NODE_OPTIONS = '--max-old-space-size=4096'
        # Next 用 CIRCLE_NODE_TOTAL - 1 作为 experimental.cpus；15 对应最多 14 workers。
        CIRCLE_NODE_TOTAL = '15'
        PORT = '3005'
        TZ = 'UTC'
        PROD_HOSTNAME = 'contests.cuberoot.me'
        NEXT_PUBLIC_BASE_URL = 'https://contests.cuberoot.me'
        NEXT_PUBLIC_PROJECT_NAME = 'CubeRoot Contests'
        PROJECT_ID = 'cuberoot-contests'
        NEXT_PUBLIC_AUTH_PROVIDERS = 'credential'
        NEXT_PUBLIC_MULTITENANCY_ENABLED = 'false'
        NEXT_PUBLIC_STORAGE_PUBLIC_BUCKET_BASE_URL = 'https://contests.cuberoot.me'
        BETTER_AUTH_URL = 'https://contests.cuberoot.me'
        BETTER_AUTH_SECRET = 'build-only-secret-not-used-at-runtime'
        DB_HOST = '127.0.0.1'
        DB_PORT = '5432'
        DB_NAME = 'recordranks'
        DB_USERNAME = 'recordranks_app'
        DB_PASSWORD = 'build-only-password'
        NEXT_PUBLIC_BUILD_DATE = (Get-Date).ToUniversalTime().ToString('o')
        NEXT_PUBLIC_VERSION = $revision
    }
    $oldEnv = @{}
    foreach ($name in $buildEnv.Keys)
    {
        $oldEnv[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
        [Environment]::SetEnvironmentVariable($name, $buildEnv[$name], 'Process')
    }
    try
    {
        Invoke-Pnpm @('build')
    }
    finally
    {
        foreach ($name in $buildEnv.Keys)
        {
            [Environment]::SetEnvironmentVariable($name, $oldEnv[$name], 'Process')
        }
    }
}
finally
{
    Pop-Location
    foreach ($name in $validationEnv.Keys)
    {
        [Environment]::SetEnvironmentVariable($name, $oldValidationEnv[$name], 'Process')
    }
}

Write-Host '[5/6] 推送本站 RecordRanks fork...' -ForegroundColor Cyan
Invoke-Git @('push', 'origin', 'HEAD:main')
$remoteRevisionLine = Get-GitText @('ls-remote', 'origin', 'refs/heads/main')
$remoteRevision = ($remoteRevisionLine -split '\s+')[0]
if ($remoteRevision -ne $revision)
{
    throw "origin/main 校验失败：预期 $revision，实际 $remoteRevision"
}

Write-Host '[6/6] 更新 CubeRoot 部署 SHA...' -ForegroundColor Cyan
if ($currentRef -ne $revision)
{
    [IO.File]::WriteAllText($refPath, "$revision`n", [Text.UTF8Encoding]::new($false))
    Write-Host "  $currentRef -> $revision" -ForegroundColor Green
}
else
{
    Write-Host "  已固定到 $shortRevision。" -ForegroundColor DarkGray
}

Write-Host "`nRecordRanks $shortRevision 同步完成。CubeRoot 改动未提交：" -ForegroundColor Green
Invoke-CheckedNativeCommand -FilePath 'git' -ArgumentList @(
    '-C', $ProjectDir, 'status', '--short', '--', 'ops/contests/recordranks-ref.txt'
)
Write-Host '审完后只提交 recordranks-ref.txt；push CubeRoot 才会部署。' -ForegroundColor DarkGray
