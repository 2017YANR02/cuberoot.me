<#
.SYNOPSIS
    从 D:\cube\cstimer 上游同步 scramble + lib 源码到 tools/cstimer-scramble/。
    无需 make / java / php — 三方合并，不是覆盖。
.DESCRIPTION
    这里的几个文件带着我们自己加的导出（sq1 / pyraminx / redi 的 `solveScramble`，
    给 /scramble/solver 和 NONWCA 求解器用），逐字覆盖会把它们抹掉（CI 上表现为
    "sq1.solveScramble is not a function"）。所以按 git 三方合并来：
      base   = UPSTREAM.txt 记的上次同步 commit 的上游文件
      ours   = 仓库里当前的文件（= 上次的上游 + 我们的补丁）
      theirs = 上游最新文件
    冲突就停下来报文件名，人工合完再重跑。
.PARAMETER SkipPull
    跳过 git pull；编排器调用时会显式传入。
.PARAMETER RepoRoot
    cuberoot.me 仓库根目录；保留 ProjectDir 作为旧参数别名。
.PARAMETER ValidateOnly
    只读校验仓库和脚本内部依赖后退出。
.NOTES
    上游 license: GPLv3
#>
param(
    [string]$CstimerDir = "D:\cube\cstimer",
    [string]$ProjectDir = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..')),
    [switch]$SkipPull,
    [string]$RepoRoot,
    [switch]$ValidateOnly
)

$ErrorActionPreference = 'Stop'
$defaultRepoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$syncBootstrapRoot = if ($RepoRoot) { [IO.Path]::GetFullPath($RepoRoot) } else { [IO.Path]::GetFullPath($ProjectDir) }
. (Join-Path $syncBootstrapRoot '.sync\sync_utils.ps1')
$ProjectDir = Resolve-CubeRootRepoRoot -RepoRoot $RepoRoot -LegacyRoot $ProjectDir -ScriptRoot $defaultRepoRoot
Assert-SyncInternalFiles -RepoRoot $ProjectDir -RelativePaths @(
    'scripts/upstream/sync-cstimer-scramble.ps1'
    '.sync/sync_utils.ps1'
) -PowerShellScripts @('scripts/upstream/sync-cstimer-scramble.ps1')
if ($ValidateOnly)
{
    Write-Host "csTimer 打乱源码同步脚本校验通过：$ProjectDir" -ForegroundColor Green
    return
}

if (-not (Test-Path -LiteralPath (Join-Path $CstimerDir '.git')))
{
    throw "$CstimerDir 不是 csTimer clone"
}
$dst = "$ProjectDir\tools\cstimer-scramble"

function Write-LfFile
{
    param([string]$Path, [string]$Text)
    $lf = $Text -replace "`r`n", "`n"
    [System.IO.File]::WriteAllText($Path, $lf, (New-Object System.Text.UTF8Encoding $false))
}

Write-Host "[1/4] git pull csTimer..." -ForegroundColor Cyan
if ($SkipPull)
{
    Write-Host "  --SkipPull，跳过" -ForegroundColor DarkGray
}
else
{
    [void](Invoke-CheckedNativeCommand -FilePath 'git' -ArgumentList @(
        '-C', $CstimerDir, 'pull', '--ff-only', 'origin', 'master'
    ) -FailureMessage 'csTimer git pull 失败')
}

# ===== base commit：上次同步到哪一版 =====
$upstreamTxt = "$dst\UPSTREAM.txt"
$baseSha = $null
if (Test-Path $upstreamTxt)
{
    $m = [regex]::Match((Get-Content $upstreamTxt -Raw), 'Commit:\s+(\w+)')
    if ($m.Success) { $baseSha = $m.Groups[1].Value }
}
if (-not $baseSha)
{
    throw "UPSTREAM.txt 里读不到上次同步的 commit —— 没有 base 就没法三方合并，先手工确认 $dst 的来源版本。"
}
$baseType = Get-CheckedNativeText -FilePath 'git' -ArgumentList @('-C', $CstimerDir, 'cat-file', '-t', $baseSha)
if ($baseType -ne 'commit')
{
    throw "UPSTREAM.txt 的 base 不是有效 commit：$baseSha"
}
Write-Host "[2/4] 三方合并（base = $baseSha）..." -ForegroundColor Cyan

$libs = @('utillib', 'isaac', 'mathlib', 'grouplib', 'poly3dlib', 'pat3x3', 'min2phase')
$pairs = @()
foreach ($lib in $libs)
{
    $pairs += @{ Upstream = "src/js/lib/$lib.js"; Local = "$dst\lib\$lib.js" }
}
foreach ($f in Get-ChildItem "$CstimerDir\src\js\scramble\*.js")
{
    $pairs += @{ Upstream = "src/js/scramble/$($f.Name)"; Local = "$dst\scramble\$($f.Name)" }
}

$tmp = Join-Path ([System.IO.Path]::GetTempPath()) ("cstimer-sync-" + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $tmp -Force | Out-Null

$conflicts = @()
$merged = 0
$copied = 0
try
{
    foreach ($p in $pairs)
    {
        $theirs = Join-Path $CstimerDir ($p.Upstream -replace '/', '\')

        # 上游新增的文件：本地没有，直接拿。
        if (-not (Test-Path $p.Local))
        {
            $destDir = Split-Path $p.Local -Parent
            if (-not (Test-Path $destDir)) { New-Item -ItemType Directory -Path $destDir -Force | Out-Null }
            Copy-Item $theirs $p.Local -Force
            $copied++
            Write-Host "  [NEW]  $($p.Upstream)" -ForegroundColor DarkGray
            continue
        }

        # base 里没有这个路径（上游当时还没加）→ 退化成覆盖；其他 git 错误必须中止。
        $baseEntry = Get-CheckedNativeText -FilePath 'git' -ArgumentList @(
            '-C', $CstimerDir, 'ls-tree', '--name-only', $baseSha, '--', $p.Upstream
        )
        if ([string]::IsNullOrWhiteSpace($baseEntry))
        {
            Copy-Item $theirs $p.Local -Force
            $copied++
            Write-Host "  [COPY] $($p.Upstream) (base 缺失)" -ForegroundColor DarkGray
            continue
        }
        $baseText = Get-CheckedNativeText -FilePath 'git' -ArgumentList @(
            '-C', $CstimerDir, 'show', "${baseSha}:$($p.Upstream)"
        )

        $name = Split-Path $p.Local -Leaf
        $oursTmp = Join-Path $tmp "$name.ours"
        $baseTmp = Join-Path $tmp "$name.base"
        $theirsTmp = Join-Path $tmp "$name.theirs"

        # NOTE: 三份输入行尾必须一致，否则每一行都跟 base 不同 → 整文件冲突。
        #       仓库是 LF only，统一成 LF，合并结果也就是 LF。
        Write-LfFile $oursTmp ([System.IO.File]::ReadAllText($p.Local))
        Write-LfFile $baseTmp ($baseText -join "`n")
        Write-LfFile $theirsTmp ([System.IO.File]::ReadAllText($theirs))

        # merge-file 把结果写回第一个参数；退出码 = 冲突数（<0 是出错）。
        $mergeOutput = & git merge-file -L 'cuberoot.me' -L 'upstream (last sync)' -L 'upstream (new)' $oursTmp $baseTmp $theirsTmp 2>&1
        $rc = $LASTEXITCODE

        # NOTE: git merge-file 最多返回 127 个冲突；底层 -1 在 Unix 进程退出码里表现为 255。
        if ($rc -lt 0 -or $rc -gt 127)
        {
            throw "git merge-file 失败：$($p.Upstream)（退出码 $rc）`n$($mergeOutput -join "`n")"
        }
        if ($rc -gt 0)
        {
            $conflicts += $p.Upstream
            Write-Host "  [!!]   $($p.Upstream)：$rc 处冲突" -ForegroundColor Red
            continue
        }

        Copy-Item $oursTmp $p.Local -Force
        $merged++
    }
}
finally
{
    Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
}

if ($conflicts.Count -gt 0)
{
    Write-Host "`n冲突文件（未写入，仓库里还是旧版）：" -ForegroundColor Red
    $conflicts | ForEach-Object { Write-Host "  $_" -ForegroundColor Red }
    throw "有 $($conflicts.Count) 个文件合不上 —— 手工合完再重跑。"
}

Copy-Item "$CstimerDir\LICENSE" "$dst\LICENSE" -Force
Write-Host "  合并 $merged 个，直接拷贝 $copied 个" -ForegroundColor Gray

# ===== 自加导出还在吗 =====
# NOTE: 这三个文件的 solveScramble 是我们加的（/scramble/solver + NONWCA 求解器要用），
#       被上游覆盖过一次导致 CI 红。合完必须再验一遍，别等 CI 告诉我们。
Write-Host "[3/4] 校验自加导出..." -ForegroundColor Cyan
$required = @{
    'scramble\scramble_sq1_new.js' = @('solveScramble', 'selfCheck')
    'scramble\pyraminx.js'         = @('solveScramble')
    'scramble\redi.js'             = @('solveScramble')
}
$missing = @()
foreach ($file in $required.Keys)
{
    $text = Get-Content (Join-Path $dst $file) -Raw
    foreach ($sym in $required[$file])
    {
        # 导出对象里的 `solveScramble: solveScramble` 才算数，光有函数定义不算。
        if ($text -notmatch "$sym\s*:\s*$sym") { $missing += "$file -> $sym" }
    }
}
if ($missing.Count -gt 0)
{
    $missing | ForEach-Object { Write-Host "  [MISSING] $_" -ForegroundColor Red }
    throw "自加导出丢了 —— 上游大概重写了这些文件，去 git 历史里把补丁捞回来重新合。"
}
Write-Host "  自加导出齐全" -ForegroundColor Gray

# 更新 UPSTREAM.txt 的 commit / date（下次同步的 merge base）
$sha = Get-CheckedNativeText -FilePath 'git' -ArgumentList @('-C', $CstimerDir, 'rev-parse', '--short', 'HEAD')
$date = Get-CheckedNativeText -FilePath 'git' -ArgumentList @('-C', $CstimerDir, 'log', '-1', '--format=%ai')
$txt = @"
Vendored from https://github.com/cs0x7f/cstimer
Commit:  $sha
Date:    $date
License: GPLv3 (see ./LICENSE)

Files in lib/ and scramble/ are copied from upstream src/js/lib/ and
src/js/scramble/. A few of them (scramble_sq1_new.js / pyraminx.js / redi.js)
carry cuberoot.me additions — the `solveScramble` exports. Do not hand-edit for
upstream changes; resync via scripts/upstream/sync-cstimer-scramble.ps1, which
three-way merges against the commit recorded above.

Used by:  core/packages/client/lib/cstimer-scramble.ts
          (worker bridge at tools/cstimer-scramble/scrambler.worker.js)
"@
Set-Content -Path $upstreamTxt -Value $txt -Encoding UTF8

Write-Host "[4/4] git status..." -ForegroundColor Cyan
Invoke-CheckedNativeCommand -FilePath 'git' -ArgumentList @(
    '-C', $ProjectDir, 'status', '--short', 'tools/cstimer-scramble'
)

Write-Host "完成。改动未提交。" -ForegroundColor Green
