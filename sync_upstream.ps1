<#
.SYNOPSIS
    一键同步全部上游 fork（csTimer / RubiksSolverDemo / Alg-Trainers / BLDDB / RecordRanks）。
.DESCRIPTION
    统一入口：拉取各上游并运行对应同步脚本。不自动提交 cuberoot.me，
    跑完自己审 diff 再提交。RecordRanks 会验证并推送本站 fork，再更新部署 SHA。

    子脚本（可单独跑，但日常一律走本脚本）：
      _sync_cstimer.ps1           csTimer 全量构建 → tools/cstimer/ + client public/scramble_module.js
      _sync_cstimer_scramble.ps1  csTimer 打乱源码 → tools/cstimer-scramble/（纯拷贝）
      _sync_RubiksSolverDemo.ps1  Solver → tools/{src,solver,2x2x2,...}/
      sync_alg_trainers.ps1       Alg-Trainers → tools/alg_trainers/
      _sync_blddb.ps1             BLDDB → tools/blddb/(next build 静态导出)
      _sync_recordranks.ps1       RecordRanks → fork main + ops/contests/recordranks-ref.txt
.PARAMETER Only
    只同步部分上游：cstimer / solver / algtrainers / blddb / recordranks（可多选）。默认全同步。
.PARAMETER SkipPull
    跳过 git pull，只用当前 clone 的工作区重新生成产物。
.PARAMETER DryRun
    传给支持预览的子脚本（solver / algtrainers / recordranks）；其余构建会被跳过。
.NOTES
    前置：Java 21 + PHP 8.3 + C:\mingw64\bin\mingw32-make.exe（仅 csTimer 构建需要）。
#>
param(
    [ValidateSet('cstimer', 'solver', 'algtrainers', 'blddb', 'recordranks')]
    [string[]]$Only,
    [switch]$SkipPull,
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot

# NOTE: 上游 clone 都在仓库外的 D:\cube\ 下，只本机有；缺哪个就跳过哪个并提示 clone 命令。
$upstreams = @(
    @{ Key = 'cstimer';     Dir = 'D:\cube\cstimer';                  Branch = 'master'; Repo = 'https://github.com/cs0x7f/cstimer.git' }
    @{ Key = 'solver';      Dir = 'D:\cube\RubiksSolverDemo';         Branch = 'main';   Repo = 'https://github.com/or18/RubiksSolverDemo.git' }
    @{ Key = 'algtrainers'; Dir = 'D:\cube\mihlefeld-alg-trainers';   Branch = 'master'; Repo = 'https://github.com/mihlefeld/Alg-Trainers.git' }
    @{ Key = 'blddb';       Dir = 'D:\cube\blddb';                    Branch = 'v2';     Repo = 'https://github.com/nbwzx/blddb.git' }
)

$allTargets = @($upstreams.Key) + 'recordranks'
$targets = if ($Only) { $Only } else { $allTargets }
$summary = [ordered]@{}

function Write-Section($text)
{
    Write-Host "`n========================================" -ForegroundColor Cyan
    Write-Host "  $text" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
}

# ===== Step 1: 拉取上游 =====
Write-Section 'Step 1 / 2  拉取上游'

foreach ($u in $upstreams)
{
    if ($targets -notcontains $u.Key) { continue }

    if (-not (Test-Path (Join-Path $u.Dir '.git')))
    {
        Write-Host "  [MISS] $($u.Key): $($u.Dir) 不存在 —— git clone $($u.Repo) `"$($u.Dir)`"" -ForegroundColor Yellow
        $summary[$u.Key] = 'clone 缺失，已跳过'
        $targets = $targets | Where-Object { $_ -ne $u.Key }
        continue
    }

    if ($SkipPull)
    {
        Write-Host "  [SKIP] $($u.Key): --SkipPull" -ForegroundColor DarkGray
        continue
    }

    $before = git -C $u.Dir rev-parse --short HEAD

    # NOTE: 上游 clone 的工作区常有两类改动：
    #       ① 我们自己打的补丁（如 cstimer Makefile 的 battle_module 目标）—— 必须保住；
    #       ② 纯 CRLF 噪音和构建产物 —— 无所谓。
    #       一律 stash 再 pop，让 git 自己合；冲突就停下来交给人处理。
    $dirty = (git -C $u.Dir status --porcelain).Length -gt 0
    if ($dirty) { git -C $u.Dir stash push -q -m 'sync_upstream: local patches' }

    git -C $u.Dir pull --ff-only $u.Repo $($u.Branch) 2>&1 | Select-Object -Last 1 | Out-Null
    $after = git -C $u.Dir rev-parse --short HEAD

    if ($dirty)
    {
        git -C $u.Dir stash pop 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0)
        {
            throw "$($u.Key): stash pop 冲突，本地补丁没自动合上。到 $($u.Dir) 手工解决后重跑。"
        }
    }

    if ($before -eq $after)
    {
        Write-Host "  [=]    $($u.Key): 已是最新 ($after)" -ForegroundColor DarkGray
        $summary[$u.Key] = "已是最新 $after"
    }
    else
    {
        $n = (git -C $u.Dir log --oneline "$before..$after").Count
        Write-Host "  [PULL] $($u.Key): $before -> $after (+$n commits)" -ForegroundColor Green
        $summary[$u.Key] = "$before -> $after (+$n)"
    }
}

# ===== Step 2: 跑同步脚本 =====
Write-Section 'Step 2 / 2  同步到仓库'

# NOTE: 子脚本自己也会 git pull 一次（可单独运行），此处已拉过，重复调用是空转。
$dry = if ($DryRun) { @{ DryRun = $true } } else { @{} }

if ($targets -contains 'cstimer')
{
    if ($DryRun)
    {
        Write-Host "`n[DRY RUN] 跳过 csTimer 构建（子脚本不支持预览）" -ForegroundColor Yellow
    }
    else
    {
        Write-Host "`n--- csTimer（构建，需 Java/PHP/make，最慢）---" -ForegroundColor Cyan
        & (Join-Path $root '_sync_cstimer.ps1')
        Write-Host "`n--- csTimer 打乱源码 ---" -ForegroundColor Cyan
        & (Join-Path $root '_sync_cstimer_scramble.ps1')
    }
}

if ($targets -contains 'solver')
{
    Write-Host "`n--- RubiksSolverDemo ---" -ForegroundColor Cyan
    & (Join-Path $root '_sync_RubiksSolverDemo.ps1') @dry
}

if ($targets -contains 'algtrainers')
{
    Write-Host "`n--- Alg-Trainers ---" -ForegroundColor Cyan
    & (Join-Path $root 'sync_alg_trainers.ps1') @dry
}

if ($targets -contains 'blddb')
{
    if ($DryRun)
    {
        Write-Host "`n[DRY RUN] 跳过 BLDDB（要 next build 才知道产物，无法预览）" -ForegroundColor Yellow
    }
    else
    {
        # NOTE: 上游是 Next 应用,这里是真 build(npm install + next build 静态导出),不是拷文件。
        Write-Host "`n--- BLDDB（构建，需 Node/npm）---" -ForegroundColor Cyan
        & (Join-Path $root '_sync_blddb.ps1') -SkipPull
    }
}

if ($targets -contains 'recordranks')
{
    Write-Host "`n--- RecordRanks（合并上游、检查、构建、推 fork、更新部署 SHA）---" -ForegroundColor Cyan
    $recordRanksArgs = @{}
    if ($SkipPull) { $recordRanksArgs.SkipPull = $true }
    if ($DryRun) { $recordRanksArgs.DryRun = $true }
    & (Join-Path $root '_sync_recordranks.ps1') @recordRanksArgs
    $summary.recordranks = if ($DryRun) { '预览完成' } else { 'fork 与部署 SHA 已同步' }
}

# ===== 汇总 =====
Write-Section '全部完成'
foreach ($k in $summary.Keys)
{
    Write-Host ("  {0,-12} {1}" -f $k, $summary[$k])
}
Write-Host "`n改动未提交。审 diff：" -ForegroundColor Green
Write-Host "  git status --short tools/ core/packages/client/public/scramble_module.js ops/contests/recordranks-ref.txt" -ForegroundColor DarkGray
