# NOTE: Stats UI 构建脚本 — 编译 TypeScript 并复制产物到仓库根目录静态资源路径
# 用法: .\build.ps1

$ErrorActionPreference = "Stop"

# NOTE: 项目根目录（仓库根）
$repoRoot = Resolve-Path "$PSScriptRoot\..\..\.."

Write-Host "=== @cuberoot/stats-ui build ===" -ForegroundColor Cyan

# 1. TypeScript 编译
Write-Host "Compiling TypeScript..." -ForegroundColor Yellow
npx tsc
if ($LASTEXITCODE -ne 0) {
    Write-Host "TypeScript compilation failed!" -ForegroundColor Red
    exit 1
}
Write-Host "Compilation OK" -ForegroundColor Green

# 2. 复制产物到目标路径
# NOTE: 文件名 → 目标路径映射（仓库根目录）
$copyMap = @{
    "stats_ui.js"           = "assets\js\stats_ui.js"
    "wr_history_chart.js"   = "assets\js\wr_history_chart.js"
    "distribution_chart.js" = "assets\js\distribution_chart.js"
    "event_selector.js"     = "i18n\event_selector.js"
    "logo_nav.js"           = "assets\js\logo_nav.js"
}

foreach ($entry in $copyMap.GetEnumerator()) {
    $src = Join-Path $PSScriptRoot "dist" $entry.Key
    $dst = Join-Path $repoRoot $entry.Value

    if (Test-Path $src) {
        Copy-Item $src $dst -Force
        Write-Host "  $($entry.Key) -> $($entry.Value)" -ForegroundColor Gray
    } else {
        Write-Host "  SKIP $($entry.Key) (not compiled yet)" -ForegroundColor DarkYellow
    }
}

Write-Host "Build complete!" -ForegroundColor Green
