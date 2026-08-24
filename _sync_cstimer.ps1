<#
.SYNOPSIS
    从 D:\cube\cstimer 上游拉取更新，重新构建并复制到项目，不自动提交。
.PARAMETER SkipPull
    跳过 git pull；编排器调用时会显式传入。
.PARAMETER RepoRoot
    cuberoot.me 仓库根目录；保留 ProjectDir 作为旧参数别名。
.PARAMETER ValidateOnly
    只读校验仓库和脚本内部依赖后退出。
.NOTES
    前置：Java 21、PHP 8.3（winget 安装），Git for Windows（含 bash/cp/sed）
#>
param(
    [string]$CstimerDir = "D:\cube\cstimer",
    [string]$ProjectDir = $PSScriptRoot,
    [switch]$SkipPull,
    [string]$RepoRoot,
    [switch]$ValidateOnly
)

$ErrorActionPreference = 'Stop'
$syncBootstrapRoot = if ($RepoRoot) { [IO.Path]::GetFullPath($RepoRoot) } else { [IO.Path]::GetFullPath($ProjectDir) }
. (Join-Path $syncBootstrapRoot '.sync\sync_utils.ps1')
$ProjectDir = Resolve-CubeRootRepoRoot -RepoRoot $RepoRoot -LegacyRoot $ProjectDir -ScriptRoot $PSScriptRoot
Assert-SyncInternalFiles -RepoRoot $ProjectDir -RelativePaths @(
    '_sync_cstimer.ps1'
    '.sync/sync_utils.ps1'
) -PowerShellScripts @('_sync_cstimer.ps1')
if ($ValidateOnly)
{
    Write-Host "csTimer 构建同步脚本校验通过：$ProjectDir" -ForegroundColor Green
    return
}

if (-not (Test-Path -LiteralPath (Join-Path $CstimerDir '.git')))
{
    throw "$CstimerDir 不是 csTimer clone"
}

$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" +
            [System.Environment]::GetEnvironmentVariable("Path","User")

# NOTE: Makefile 依赖 Unix 命令（cp/sed/ls），通过 git bash 运行
# make 来自 C:\mingw64\bin\mingw32-make.exe（系统已有），bash 里 alias 为 make
$bash = "C:\Program Files\Git\bin\bash.exe"
$csUnix = "/" + $CstimerDir.Substring(0,1).ToLower() + $CstimerDir.Substring(2).Replace('\','/')

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

# NOTE: 在 bash 中把 mingw64 加入 PATH（mingw32-make 所在位置）
$bashInit = "export PATH=`"/c/mingw64/bin:`$PATH`""

Write-Host "[2/4] 构建 cstimer.js + twisty.js + index.html..." -ForegroundColor Cyan
Invoke-CheckedNativeCommand -FilePath $bash -ArgumentList @(
    '-c', "$bashInit && cd '$csUnix' && mingw32-make local"
) -FailureMessage 'csTimer local 构建失败'

Write-Host "[3/4] 构建 scramble_module.js（无 IIFE，供 /timer 双人模式用）..." -ForegroundColor Cyan
Invoke-CheckedNativeCommand -FilePath $bash -ArgumentList @(
    '-c', "$bashInit && cd '$csUnix' && mingw32-make battle_module"
) -FailureMessage 'csTimer battle_module 构建失败'

Write-Host "[4/6] 复制构建产物..." -ForegroundColor Cyan
Copy-Item -Path "$CstimerDir\dist\local\*" -Destination "$ProjectDir\tools\cstimer\" -Recurse -Force
# NOTE: 旧的 tools/battle/ 随 /battle 路由退役；引擎加载器 timer/_battle/engine/engine_loader.ts
#       从站点根拉 /scramble_module.js，即 client 的 public/。
Copy-Item "$CstimerDir\dist\js\scramble_module.js" "$ProjectDir\core\packages\client\public\scramble_module.js" -Force

# NOTE: 复制上游编译后的语言 JS 文件（35 种语言），供客户端动态加载
Write-Host "[5/6] 复制语言文件..." -ForegroundColor Cyan
$langDir = "$ProjectDir\tools\cstimer\lang"
if (-not (Test-Path $langDir)) { New-Item -ItemType Directory -Path $langDir | Out-Null }
Get-ChildItem "$CstimerDir\dist\lang\*.js" | Copy-Item -Destination $langDir -Force
$langCount = (Get-ChildItem "$langDir\*.js").Count
Write-Host "  已复制 $langCount 个语言文件到 cstimer/lang/" -ForegroundColor Gray

# NOTE: 向 index.html 注入语言引导脚本
# 上游 make local 生成的静态 HTML 只含英文变量，语言切换 ?lang= 参数无效
# 注入逻辑：在 LANG_CUR 定义之后插入一段 JS，解析 ?lang= 参数并同步加载对应语言文件
Write-Host "[6/6] 注入语言切换引导脚本..." -ForegroundColor Cyan
$indexPath = "$ProjectDir\tools\cstimer\index.html"
# HACK: 用字节级操作避免 PowerShell 破坏编码或行尾符
$bytes = [System.IO.File]::ReadAllBytes($indexPath)
$html = [System.Text.Encoding]::UTF8.GetString($bytes)

# 在 "var LANG_CUR = 'en-us';" 之后注入引导脚本
$langBootstrap = @"

// NOTE: 客户端语言引导（静态部署补丁，非上游代码）
// 解析 ?lang= 参数，同步加载对应语言 JS 覆盖英文默认变量
(function() {
  var m = location.search.match(/[?&]lang=([a-z]{2}-[a-z]{2})/);
  if (m && m[1] !== 'en-us') {
    LANG_CUR = m[1];
    document.write('<script src="lang/' + m[1] + '.js"><\/script>');
  }
})();
"@

$anchor = "var LANG_CUR = 'en-us';"
if ($html.Contains($anchor)) {
    $html = $html.Replace($anchor, $anchor + $langBootstrap)
    $newBytes = [System.Text.Encoding]::UTF8.GetBytes($html)
    [System.IO.File]::WriteAllBytes($indexPath, $newBytes)
    Write-Host "  语言引导脚本注入成功" -ForegroundColor Gray
} else {
    Write-Host "  警告：未找到 LANG_CUR 锚点，跳过注入" -ForegroundColor Yellow
}

# NOTE: 不自动 commit —— 统一由 sync_upstream.ps1 跑完全部上游后由人工审 diff 再提交。
$version = Get-CheckedNativeText -FilePath 'git' -ArgumentList @(
    '-C', $CstimerDir, 'describe', '--tags', '--always'
)
Write-Host "完成！csTimer $version（未提交，自行 git diff 后 commit）" -ForegroundColor Green
