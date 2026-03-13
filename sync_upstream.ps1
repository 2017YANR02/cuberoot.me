<#
.SYNOPSIS
    一键同步上游 RubiksSolverDemo 到本地项目
.DESCRIPTION
    将上游仓库的 src/ 目录、根目录依赖和 HTML 页面同步到本地项目，
    自动应用背景色、汉化、菜单链接等定制化修改。
.PARAMETER UpstreamDir
    上游仓库路径（默认 D:\cube\RubiksSolverDemo）
.PARAMETER LocalDir
    本地项目路径（默认 D:\cube\ruiminyan.github.io）
.PARAMETER DryRun
    只预览变更，不实际写入文件
#>
param(
    [string]$UpstreamDir = "D:\cube\RubiksSolverDemo",
    [string]$LocalDir = "D:\cube\ruiminyan.github.io",
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"
$syncDir = Join-Path $LocalDir ".sync"

# NOTE: 引入公共工具函数（Sync-FileIfChanged / Sync-Directory / Get-GaInlineCode / Read-Utf8File / Write-Utf8File）
. (Join-Path $syncDir "sync_utils.ps1")

# ===== 加载配置 =====
$config = Get-Content (Join-Path $syncDir "page_config.json") -Raw | ConvertFrom-Json
$menuTemplate = [System.IO.File]::ReadAllText((Join-Path $syncDir "menu_template.html"))

# ===== 统计计数器 =====
$stats = @{ srcFiles = 0; rootFiles = 0; rootDirs = 0; pages = 0 }

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  Upstream Sync Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Upstream: $UpstreamDir"
Write-Host "Local:    $LocalDir"
if ($DryRun) { Write-Host "[DRY RUN MODE]" -ForegroundColor Yellow }
Write-Host ""

# ===== Step 1: 同步 src/ 目录 =====
Write-Host "Step 1: Syncing src/ directory..." -ForegroundColor Green

$upstreamSrc = Join-Path $UpstreamDir "src"
$localSrc = Join-Path $LocalDir "src"

# NOTE: i18n/ 已移至根目录，src/ 可以安全整体同步
$excludePatterns = @('\.cpp$', '\.h$', '\.sh$', '\.txt$', '\.gitignore', 'README', 'PRODUCTION_GUIDE', 'CHANGELOG', 'build_', 'test_', 'docs', 'tools', 'tsl')

Get-ChildItem -Path $upstreamSrc -Recurse -File | Where-Object {
    $rel = $_.FullName.Substring($upstreamSrc.Length)
    $skip = $false
    foreach ($pat in $excludePatterns)
    {
        if ($rel -match $pat) { $skip = $true; break }
    }
    -not $skip
} | ForEach-Object {
    $rel = $_.FullName.Substring($upstreamSrc.Length)
    $dest = Join-Path $localSrc $rel

    if (Sync-FileIfChanged $_.FullName $dest $DryRun)
    {
        $stats.srcFiles++
        Write-Host "  [SYNC] src$rel" -ForegroundColor DarkGray
    }
}


# ===== Step 2: 同步根目录依赖 =====
Write-Host "`nStep 2: Syncing root-level dependencies..." -ForegroundColor Green

foreach ($file in $config.rootFiles)
{
    $src = Join-Path $UpstreamDir $file
    $dest = Join-Path $LocalDir $file

    if (-not (Test-Path $src))
    {
        Write-Host "  [WARN] Not found in upstream: $file" -ForegroundColor Yellow
        continue
    }

    if (Sync-FileIfChanged $src $dest $DryRun)
    {
        $stats.rootFiles++
        Write-Host "  [SYNC] $file" -ForegroundColor DarkGray
    }
}

# ===== Step 2b: 同步根目录子目录（整体覆盖） =====
if ($config.rootDirs)
{
    foreach ($dir in $config.rootDirs)
    {
        $srcDir = Join-Path $UpstreamDir $dir
        $destDir = Join-Path $LocalDir $dir

        if (-not (Test-Path $srcDir))
        {
            Write-Host "  [WARN] Dir not found in upstream: $dir" -ForegroundColor Yellow
            continue
        }

        Sync-Directory $srcDir $destDir $DryRun
        $stats.rootDirs++
        Write-Host "  [SYNC] $dir/" -ForegroundColor DarkGray
    }
}

# ===== Step 2c: 修正 sw.js 缓存列表 =====
# NOTE: 上游 sw.js 使用扁平 HTML 路径（如 2x2x2.html），
#       本站已重构为目录结构（如 2x2x2/index.html），且已用内联 GA 替代 analytics.js
Write-Host "`nStep 2c: Patching sw.js cache lists..." -ForegroundColor Green

$swPath = Join-Path $LocalDir "sw.js"
if (Test-Path $swPath)
{
    $swContent = Read-Utf8File $swPath

    # 1. 删除 analytics.js 引用（本地不存在此文件）
    $swContent = [regex]::Replace($swContent, "(?m)^\t'analytics\.js',?\r?\n", "")

    # 2. 将扁平 HTML 路径替换为目录结构（与 page_config.json 一致）
    foreach ($page in $config.pages)
    {
        # NOTE: 跳过 index.html — 根 index.html 指向首页，保留原样
        if ($page.upstream -eq "index.html") { continue }
        $escaped = [regex]::Escape($page.upstream)
        $newPath = "$($page.subdir)/index.html"
        $swContent = $swContent -replace "'$escaped'", "'$newPath'"
    }

    if (-not $DryRun)
    {
        Write-Utf8File $swPath $swContent
    }
    Write-Host "  [PATCH] sw.js: removed analytics.js, fixed HTML paths" -ForegroundColor DarkCyan
}

# ===== Step 3: 逐页面转换 =====
Write-Host "`nStep 3: Converting HTML pages..." -ForegroundColor Green

# NOTE: 内联 Google Analytics 代码块，替换上游的 analytics.js 引用
$gaCode = Get-GaInlineCode $config.analytics.trackingId

foreach ($page in $config.pages)
{
    $srcFile = Join-Path $UpstreamDir $page.upstream
    $destDir2 = Join-Path $LocalDir $page.subdir
    $destFile = Join-Path $destDir2 "index.html"

    if (-not (Test-Path $srcFile))
    {
        Write-Host "  [SKIP] $($page.upstream) (not found in upstream)" -ForegroundColor Yellow
        continue
    }

    Write-Host "  [CONV] $($page.upstream) -> $($page.subdir)/index.html" -ForegroundColor DarkCyan

    $content = Read-Utf8File $srcFile

    # --- 3a. 资源路径替换 ---
    # NOTE: 只替换 JS/HTML 中的路径引用，不替换 URL 中的（如 GitHub 链接）
    # 替换引号内的 src/ 路径（JS 字符串和 HTML 属性）
    $content = $content -replace "'src/", "'../src/"
    $content = $content -replace '"src/', '"../src/'

    # --- 3b. 替换 analytics.js 引用为内联 GA 代码 ---
    $content = $content -replace '(?m)\s*<script\s+src="analytics\.js"\s+defer>\s*</script>', $gaCode

    # --- 3b2. 根目录文件路径添加 ../ 前缀 ---
    # NOTE: 这些文件在项目根目录，子目录页面需要 ../ 前缀才能正确引用
    $content = $content -replace '"manifest\.json"', '"../manifest.json"'
    $content = $content -replace '"url_params_compressor_simple\.js"', '"../url_params_compressor_simple.js"'
    $content = $content -replace "'url_params_compressor_simple\.js'", "'../url_params_compressor_simple.js'"

    # --- 3c. 注入 manifest.json link ---
    if ($content -notmatch 'manifest\.json')
    {
        $content = $content -replace '(<meta\s+charset="UTF-8">)', "`$1`n`t<link rel=""manifest"" href=""../manifest.json"">"
    }

    # --- 3d. 替换背景色 ---
    # NOTE: 所有 #121212 统一替换为 #0a0a0f（深黑色统一风格）
    $content = $content -replace '#121212', '#0a0a0f'
    # 在 body 的 background-color 后面注入渐变背景
    $bgGradient = @"
background-color: #0a0a0f;
            background-image:
                radial-gradient(ellipse at 20% 50%, rgba(90, 90, 200, 0.08) 0%, transparent 50%),
                radial-gradient(ellipse at 80% 50%, rgba(200, 90, 90, 0.06) 0%, transparent 50%);
"@
    # 匹配 body { ... background-color: #0a0a0f; } 并替换为带 gradient 的版本
    $content = [regex]::Replace($content, '(?<=body\s*\{[^}]*?)background-color:\s*#0a0a0f;', $bgGradient)

    # --- 3e. 替换 drawer-content 块中的菜单链接 ---
    # NOTE: 只替换 <div class="drawer-content"> 和 </div> 之间的链接内容
    # 不碰外层的 </nav></div> 闭合标签，避免破坏 HTML 结构
    $drawerPattern = '(?s)(<div\s+class="drawer-content">)\s*\n.*?(\s*</div>\s*\n\s*</nav>)'
    $drawerReplacement = "`$1`n$menuTemplate`n`$2"
    $content = [regex]::Replace($content, $drawerPattern, $drawerReplacement)

    # --- 3f. 注入 data-i18n 属性 ---
    # title 标签
    if ($page.i18nTitle -and $page.i18nTitle -ne "")
    {
        $content = [regex]::Replace($content, '<title>', "<title data-i18n=""$($page.i18nTitle)"">")
    }

    # h1 标签（页面主标题）
    if ($page.i18nTitle -and $page.i18nTitle -ne "")
    {
        $content = [regex]::Replace($content, '(<h1)(>)', "`$1 data-i18n=""$($page.i18nTitle)""`$2")
    }

    # Menu 标题
    $content = [regex]::Replace($content, '(<h2\s+class="drawer-title")(>)', '$1 data-i18n="common.menu"$2')

    # --- 3g. 在 </body> 前注入 i18n.js 和修正 sw-register.js 路径 ---
    # 先修正 sw-register.js 路径
    $content = $content -replace '"sw-register\.js"', '"../sw-register.js"'

    # 注入 i18n.js（如果还没有）
    if ($content -notmatch 'i18n\.js')
    {
        $content = $content -replace '(</body>)', "<script src=""../i18n/i18n.js"" defer></script>`n`$1"
    }

    # --- 写入文件 ---
    if (-not $DryRun)
    {
        if (-not (Test-Path $destDir2))
        {
            New-Item -ItemType Directory -Path $destDir2 -Force | Out-Null
        }
        Write-Utf8File $destFile $content
    }
    $stats.pages++
}

# ===== Step 4: 输出变更摘要 =====
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  Sync Complete!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  src/ files synced:   $($stats.srcFiles)"
Write-Host "  Root files synced:   $($stats.rootFiles)"
Write-Host "  Root dirs synced:    $($stats.rootDirs)"
Write-Host "  Pages converted:     $($stats.pages)"
if ($DryRun)
{
    Write-Host "`n[DRY RUN] No files were modified." -ForegroundColor Yellow
}
else
{
    Write-Host "`nRun 'git diff' to review changes." -ForegroundColor Green
    Write-Host "Then test with: python -m http.server 8080" -ForegroundColor Green
}
