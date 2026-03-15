<#
.SYNOPSIS
    从 D:\cube\cstimer 上游更新 csTimer 静态页面和 battle 打乱模块。

.DESCRIPTION
    1. git pull 拉取 csTimer 上游最新代码
    2. 用 Closure Compiler (Java 21) 重新构建 cstimer.js / twisty.js / scramble_module.js
    3. 用 PHP 8.3 渲染 timer.php 生成静态 index.html
    4. 复制构建产物到项目 cstimer/ 和 battle/

.NOTES
    前置：Java 21、PHP 8.3（均已通过 winget 安装）
    csTimer 源码：D:\cube\cstimer（GPL-3.0，cs0x7f/cstimer）
#>

param(
    [string]$CstimerDir = "D:\cube\cstimer",
    [string]$ProjectDir = $PSScriptRoot
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# NOTE: 刷新 PATH 确保 java / php 可用
$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" +
            [System.Environment]::GetEnvironmentVariable("Path", "User")

Write-Host "=== csTimer 同步脚本 ===" -ForegroundColor Cyan
Write-Host "上游：$CstimerDir"
Write-Host "项目：$ProjectDir"
Write-Host ""

# ── 1. 拉取上游 ──────────────────────────────────────────────
Write-Host "[1/5] git pull csTimer 上游..." -ForegroundColor Yellow
Push-Location $CstimerDir
git pull origin master
Pop-Location

# ── 2. 构建 cstimer.js ───────────────────────────────────────
Write-Host "[2/5] 构建 cstimer.js (Closure Compiler)..." -ForegroundColor Yellow
$cstimerSources = @(
    "src/js/lib/utillib.js", "src/js/lib/sha256.js", "src/js/lib/isaac.js",
    "src/js/lib/mathlib.js", "src/js/lib/grouplib.js", "src/js/lib/poly3dlib.js",
    "src/js/lib/pat3x3.js", "src/js/lib/sbtree.js", "src/js/lib/sqlfile.js",
    "src/js/lib/tdconverter.js", "src/js/lib/lzstring.js", "src/js/lib/min2phase.js",
    "src/js/lib/cubeutil.js", "src/js/lib/puzzlefactory.js",
    "src/js/kernel.js", "src/js/export.js", "src/js/logohint.js",
    "src/js/timer.js", "src/js/timer/input.js", "src/js/timer/stackmat.js",
    "src/js/timer/bttimer.js", "src/js/timer/virtual.js", "src/js/timer/giiker.js",
    "src/js/solver/ftocta.js", "src/js/solver/megaminx.js",
    "src/js/scramble/scramble.js", "src/js/scramble/megascramble.js",
    "src/js/scramble/scramble_333_edit.js", "src/js/scramble/scramble_444.js",
    "src/js/scramble/scramble_sq1_new.js", "src/js/scramble/pyraminx.js",
    "src/js/scramble/skewb.js", "src/js/scramble/2x2x2.js",
    "src/js/scramble/gearcube.js", "src/js/scramble/1x3x3.js",
    "src/js/scramble/2x2x3.js", "src/js/scramble/clock.js",
    "src/js/scramble/333lse.js", "src/js/scramble/mgmlsll.js",
    "src/js/scramble/megaminx.js", "src/js/scramble/scramble_fto.js",
    "src/js/scramble/redi.js", "src/js/scramble/slide.js",
    "src/js/scramble/utilscramble.js",
    "src/js/lib/storage.js",
    "src/js/stats/timestat.js", "src/js/stats/stats.js", "src/js/stats/stattool.js",
    "src/js/stats/trend.js", "src/js/stats/distribution.js",
    "src/js/stats/hugestat.js", "src/js/stats/dlystat.js",
    "src/js/stats/recons.js", "src/js/stats/trainstat.js",
    "src/js/tools/tools.js", "src/js/tools/image.js", "src/js/tools/cross.js",
    "src/js/tools/eoline.js", "src/js/tools/roux1.js", "src/js/tools/gsolver.js",
    "src/js/tools/thistlethwaite.js", "src/js/tools/pat3x3gen.js",
    "src/js/tools/bluetoothutil.js", "src/js/tools/metronome.js",
    "src/js/tools/onlinecomp.js", "src/js/tools/battle.js",
    "src/js/tools/syncseed.js", "src/js/tools/bldhelper.js",
    "src/js/twisty/twistyreplay.js", "src/js/shortcut.js", "src/js/help.js",
    "src/js/hardware/stackmat.js", "src/js/tools/stackmatutil.js",
    "src/js/hardware/bluetooth.js", "src/js/hardware/giikercube.js",
    "src/js/hardware/gocube.js", "src/js/hardware/gancube.js",
    "src/js/hardware/moyucube.js", "src/js/hardware/moyu32cube.js",
    "src/js/hardware/qiyicube.js", "src/js/hardware/gantimer.js",
    "src/js/hardware/qiyitimer.js", "src/js/worker.js"
)
$commonFlags = "--use_types_for_optimization --language_out STABLE --charset UTF-8 --strict_mode_input --define=DEBUGM=false --define=DEBUGWK=false"
$srcArgs = ($cstimerSources | ForEach-Object { "--js $_" }) -join " "
Push-Location $CstimerDir
Invoke-Expression "java -jar lib/compiler.jar $commonFlags $srcArgs --js_output_file dist/js/cstimer.js"
Write-Host "  cstimer.js: $([math]::Round((Get-Item dist/js/cstimer.js).Length/1024,1)) KB" -ForegroundColor Green
Pop-Location

# ── 3. 构建 twisty.js ────────────────────────────────────────
Write-Host "[3/5] 构建 twisty.js..." -ForegroundColor Yellow
Push-Location $CstimerDir
Invoke-Expression "java -jar lib/compiler.jar $commonFlags --js src/js/lib/threemin.js --js src/js/lib/pnltri.js --js src/js/twisty/twisty.js --js src/js/twisty/twistynnn.js --js src/js/twisty/twistysq1.js --js src/js/twisty/twistyskb.js --js src/js/twisty/twistyclk.js --js src/js/twisty/twistypoly.js --js src/js/twisty/qcube.js --js src/js/twisty/qcubennn.js --js src/js/twisty/qcubeminx.js --js src/js/twisty/qcubeclk.js --js_output_file dist/js/twisty.js"
Write-Host "  twisty.js: $([math]::Round((Get-Item dist/js/twisty.js).Length/1024,1)) KB" -ForegroundColor Green
Pop-Location

# ── 4. 构建 battle 专用打乱模块 ──────────────────────────────
Write-Host "[4/5] 构建 scramble_module.js (battle 打乱专用)..." -ForegroundColor Yellow
# NOTE: ISCSTIMER=false 跳过 csTimer UI 代码，只保留打乱逻辑（~290KB）
$scrambleSources = @(
    "src/js/lib/utillib.js", "src/js/lib/isaac.js", "src/js/lib/mathlib.js",
    "src/js/lib/grouplib.js", "src/js/lib/poly3dlib.js", "src/js/lib/pat3x3.js",
    "src/js/lib/min2phase.js", "src/js/lib/cubeutil.js",
    "src/js/solver/ftocta.js", "src/js/solver/megaminx.js",
    "src/js/scramble/scramble.js", "src/js/scramble/megascramble.js",
    "src/js/scramble/scramble_333_edit.js", "src/js/scramble/scramble_444.js",
    "src/js/scramble/scramble_sq1_new.js", "src/js/scramble/pyraminx.js",
    "src/js/scramble/skewb.js", "src/js/scramble/2x2x2.js",
    "src/js/scramble/gearcube.js", "src/js/scramble/1x3x3.js",
    "src/js/scramble/2x2x3.js", "src/js/scramble/clock.js",
    "src/js/scramble/333lse.js", "src/js/scramble/mgmlsll.js",
    "src/js/scramble/megaminx.js", "src/js/scramble/scramble_fto.js",
    "src/js/scramble/redi.js", "src/js/scramble/slide.js",
    "src/js/scramble/utilscramble.js",
    "src/js/tools/tools.js", "src/js/tools/image.js", "src/js/tools/cross.js",
    "src/js/worker.js"
)
$scrambleSrcArgs = ($scrambleSources | ForEach-Object { "--js $_" }) -join " "
Push-Location $CstimerDir
Invoke-Expression "java -jar lib/compiler.jar $commonFlags --define=ISCSTIMER=false $scrambleSrcArgs --js_output_file dist/js/scramble_module.js"
Write-Host "  scramble_module.js: $([math]::Round((Get-Item dist/js/scramble_module.js).Length/1024,1)) KB" -ForegroundColor Green
Pop-Location

# ── 5. 生成静态 index.html 并复制到项目 ─────────────────────
Write-Host "[5/5] 生成 index.html + 复制到项目..." -ForegroundColor Yellow
Push-Location $CstimerDir
New-Item -ItemType Directory -Path "dist/local/js","dist/local/css" -Force | Out-Null
php -d include_path=dist dist/timer.php | Set-Content -Path dist/local/index.html -Encoding UTF8
Copy-Item dist/js/jquery.min.js dist/local/js/ -Force
Copy-Item dist/js/cstimer.js   dist/local/js/ -Force
Copy-Item dist/js/twisty.js    dist/local/js/ -Force
Copy-Item dist/css/style.css   dist/local/css/ -Force
Copy-Item dist/cstimer512x512.png  dist/local/ -ErrorAction SilentlyContinue -Force
Copy-Item dist/cstimer.webmanifest dist/local/ -ErrorAction SilentlyContinue -Force
Pop-Location

# 复制到项目
Copy-Item -Path "$CstimerDir\dist\local\*" -Destination "$ProjectDir\cstimer\" -Recurse -Force
Copy-Item "$CstimerDir\dist\js\scramble_module.js" "$ProjectDir\battle\scramble_module.js" -Force

Write-Host ""
Write-Host "=== 完成！===" -ForegroundColor Cyan
Write-Host "cstimer/  已更新（含 index.html、cstimer.js、twisty.js、style.css）"
Write-Host "battle/scramble_module.js 已更新"
Write-Host ""
Write-Host "下一步：git add -A && git commit -m 'chore: update csTimer to latest upstream'"
