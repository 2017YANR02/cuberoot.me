<#
.SYNOPSIS
    从 D:\cube\cstimer 上游同步 scramble + lib 源码到 tools/cstimer-scramble/。
    无需 make / java / php — 纯文件拷贝。
.NOTES
    上游 license: GPLv3
#>
param(
    [string]$CstimerDir = "D:\cube\cstimer",
    [string]$ProjectDir = $PSScriptRoot
)

Write-Host "[1/3] git pull csTimer..." -ForegroundColor Cyan
git -C $CstimerDir pull origin master

$dst = "$ProjectDir\tools\cstimer-scramble"
Write-Host "[2/3] 复制 lib + scramble..." -ForegroundColor Cyan
foreach ($lib in @('utillib', 'isaac', 'mathlib', 'grouplib', 'poly3dlib', 'pat3x3', 'min2phase')) {
    Copy-Item "$CstimerDir\src\js\lib\$lib.js" "$dst\lib\$lib.js" -Force
}
Get-ChildItem "$CstimerDir\src\js\scramble\*.js" | Copy-Item -Destination "$dst\scramble\" -Force
Copy-Item "$CstimerDir\LICENSE" "$dst\LICENSE" -Force

# 更新 UPSTREAM.txt 的 commit / date
$sha  = git -C $CstimerDir rev-parse --short HEAD
$date = git -C $CstimerDir log -1 --format="%ai"
$txt = @"
Vendored from https://github.com/cs0x7f/cstimer
Commit:  $sha
Date:    $date
License: GPLv3 (see ./LICENSE)

Files in lib/ and scramble/ are copied verbatim from upstream
src/js/lib/ and src/js/scramble/. Do not edit; resync via
_sync_cstimer_scramble.ps1 at repo root.

Used by:  core/packages/client/src/utils/cstimerScramble.ts
          (worker bridge at tools/cstimer-scramble/scrambler.worker.js)
"@
Set-Content -Path "$dst\UPSTREAM.txt" -Value $txt -Encoding UTF8

Write-Host "[3/3] git status..." -ForegroundColor Cyan
git -C $ProjectDir status tools/cstimer-scramble

Write-Host "完成。再 git commit 自己提。" -ForegroundColor Green
