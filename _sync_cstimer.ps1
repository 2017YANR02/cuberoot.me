<#
.SYNOPSIS
    从 D:\cube\cstimer 上游拉取更新，重新构建并复制到项目，最后自动提交。
.NOTES
    前置：Java 21、PHP 8.3（winget 安装），Git for Windows（含 make）
#>
param(
    [string]$CstimerDir = "D:\cube\cstimer",
    [string]$ProjectDir = $PSScriptRoot
)

$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" +
            [System.Environment]::GetEnvironmentVariable("Path","User")

$make = "C:\Program Files\Git\usr\bin\make.exe"

Push-Location $CstimerDir

Write-Host "[1/4] git pull csTimer..." -ForegroundColor Cyan
git pull origin master

Write-Host "[2/4] 构建 cstimer.js + twisty.js + index.html..." -ForegroundColor Cyan
& $make local

Write-Host "[3/4] 构建 scramble_module.js..." -ForegroundColor Cyan
# battle_module target：无 --isolation_mode IIFE，scrMgr 暴露到全局
& $make battle_module

Pop-Location

Write-Host "[4/4] 复制 + git commit..." -ForegroundColor Cyan
Copy-Item -Path "$CstimerDir\dist\local\*" -Destination "$ProjectDir\cstimer\" -Recurse -Force
Copy-Item "$CstimerDir\dist\js\scramble_module.js" "$ProjectDir\battle\scramble_module.js" -Force

Push-Location $ProjectDir
$version = git -C $CstimerDir describe --tags --always 2>$null
git add cstimer/ battle/scramble_module.js
git commit -m "chore: update csTimer to $version"
Pop-Location

Write-Host "完成！" -ForegroundColor Green
