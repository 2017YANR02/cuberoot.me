<#
.SYNOPSIS
    从 D:\cube\cstimer 上游拉取更新，重新构建并复制到项目，最后自动提交。
.NOTES
    前置：Java 21、PHP 8.3（winget 安装），Git for Windows（含 bash/cp/sed）
#>
param(
    [string]$CstimerDir = "D:\cube\cstimer",
    [string]$ProjectDir = $PSScriptRoot
)

$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" +
            [System.Environment]::GetEnvironmentVariable("Path","User")

# NOTE: Makefile 依赖 Unix 命令（cp/sed/ls），通过 git bash 运行
# make 来自 C:\mingw64\bin\mingw32-make.exe（系统已有），bash 里 alias 为 make
$bash = "C:\Program Files\Git\bin\bash.exe"
$csUnix = "/" + $CstimerDir.Substring(0,1).ToLower() + $CstimerDir.Substring(2).Replace('\','/')

Write-Host "[1/4] git pull csTimer..." -ForegroundColor Cyan
git -C $CstimerDir pull origin master

# NOTE: 在 bash 中把 mingw64 加入 PATH（mingw32-make 所在位置）
$bashInit = "export PATH=`"/c/mingw64/bin:`$PATH`""

Write-Host "[2/4] 构建 cstimer.js + twisty.js + index.html..." -ForegroundColor Cyan
& $bash -c "$bashInit && cd '$csUnix' && mingw32-make local"

Write-Host "[3/4] 构建 scramble_module.js（无 IIFE，供 battle 用）..." -ForegroundColor Cyan
& $bash -c "$bashInit && cd '$csUnix' && mingw32-make battle_module"

Write-Host "[4/4] 复制 + git commit..." -ForegroundColor Cyan
Copy-Item -Path "$CstimerDir\dist\local\*" -Destination "$ProjectDir\cstimer\" -Recurse -Force
Copy-Item "$CstimerDir\dist\js\scramble_module.js" "$ProjectDir\battle\scramble_module.js" -Force

Push-Location $ProjectDir
$version = git -C $CstimerDir describe --tags --always 2>$null
git add cstimer/ battle/scramble_module.js
git commit -m "chore: update csTimer to $version"
Pop-Location

Write-Host "完成！" -ForegroundColor Green
