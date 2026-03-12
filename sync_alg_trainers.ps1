<#
.SYNOPSIS
    一键同步上游 mihlefeld/Alg-Trainers 到本地项目
.DESCRIPTION
    将上游仓库的 src/、style/ 目录、根目录依赖、训练器子目录和首页
    同步到本地 alg_trainers/ 目录，自动替换分析脚本为内联 GA。
.PARAMETER UpstreamDir
    上游仓库路径（默认 D:\cube\mihlefeld-alg-trainers）
.PARAMETER LocalDir
    本地项目路径（默认 D:\cube\ruiminyan.github.io）
.PARAMETER DryRun
    只预览变更，不实际写入文件
#>
param(
    [string]$UpstreamDir = "D:\cube\mihlefeld-alg-trainers",
    [string]$LocalDir = "D:\cube\ruiminyan.github.io",
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"
$syncDir = Join-Path $LocalDir ".sync"
$destBase = Join-Path $LocalDir "alg_trainers"

# ===== 加载配置 =====
$config = Get-Content (Join-Path $syncDir "alg_trainers_config.json") -Raw | ConvertFrom-Json

# ===== 统计计数器 =====
$stats = @{ srcFiles = 0; styleFiles = 0; rootFiles = 0; trainerDirs = 0; indexConverted = 0 }

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  Alg-Trainers Upstream Sync Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Upstream: $UpstreamDir"
Write-Host "Local:    $destBase"
if ($DryRun) { Write-Host "[DRY RUN MODE]" -ForegroundColor Yellow }
Write-Host ""

# ===== Step 1: 同步 src/ 目录 =====
Write-Host "Step 1: Syncing src/ directory..." -ForegroundColor Green

$upstreamSrc = Join-Path $UpstreamDir "src"
$localSrc = Join-Path $destBase "src"

Get-ChildItem -Path $upstreamSrc -Recurse -File | ForEach-Object {
    $rel = $_.FullName.Substring($upstreamSrc.Length)
    $dest = Join-Path $localSrc $rel
    $destDir2 = Split-Path $dest -Parent

    $needCopy = $true
    if (Test-Path $dest)
    {
        $needCopy = (Get-FileHash $_.FullName -Algorithm MD5).Hash -ne (Get-FileHash $dest -Algorithm MD5).Hash
    }

    if ($needCopy)
    {
        if (-not $DryRun)
        {
            if (-not (Test-Path $destDir2))
            {
                New-Item -ItemType Directory -Path $destDir2 -Force | Out-Null
            }
            Copy-Item $_.FullName $dest -Force
        }
        $stats.srcFiles++
        Write-Host "  [SYNC] src$rel" -ForegroundColor DarkGray
    }
}

# ===== Step 1b: 同步 style/ 目录 =====
Write-Host "`nStep 1b: Syncing style/ directory..." -ForegroundColor Green

$upstreamStyle = Join-Path $UpstreamDir "style"
$localStyle = Join-Path $destBase "style"

Get-ChildItem -Path $upstreamStyle -Recurse -File | ForEach-Object {
    $rel = $_.FullName.Substring($upstreamStyle.Length)
    $dest = Join-Path $localStyle $rel
    $destDir2 = Split-Path $dest -Parent

    $needCopy = $true
    if (Test-Path $dest)
    {
        $needCopy = (Get-FileHash $_.FullName -Algorithm MD5).Hash -ne (Get-FileHash $dest -Algorithm MD5).Hash
    }

    if ($needCopy)
    {
        if (-not $DryRun)
        {
            if (-not (Test-Path $destDir2))
            {
                New-Item -ItemType Directory -Path $destDir2 -Force | Out-Null
            }
            Copy-Item $_.FullName $dest -Force
        }
        $stats.styleFiles++
        Write-Host "  [SYNC] style$rel" -ForegroundColor DarkGray
    }
}

# ===== Step 2: 同步根目录依赖 =====
Write-Host "`nStep 2: Syncing root-level dependencies..." -ForegroundColor Green

foreach ($file in $config.rootFiles)
{
    $src = Join-Path $UpstreamDir $file
    $dest = Join-Path $destBase $file

    if (-not (Test-Path $src))
    {
        Write-Host "  [WARN] Not found in upstream: $file" -ForegroundColor Yellow
        continue
    }

    $needCopy = $true
    if (Test-Path $dest)
    {
        $needCopy = (Get-FileHash $src -Algorithm MD5).Hash -ne (Get-FileHash $dest -Algorithm MD5).Hash
    }

    if ($needCopy)
    {
        if (-not $DryRun)
        {
            $destDir2 = Split-Path $dest -Parent
            if (-not (Test-Path $destDir2))
            {
                New-Item -ItemType Directory -Path $destDir2 -Force | Out-Null
            }
            Copy-Item $src $dest -Force
        }
        $stats.rootFiles++
        Write-Host "  [SYNC] $file" -ForegroundColor DarkGray
    }
}

# ===== Step 3: 同步训练器子目录（整体覆盖） =====
Write-Host "`nStep 3: Syncing trainer directories..." -ForegroundColor Green

foreach ($dir in $config.trainerDirs)
{
    $srcDir = Join-Path $UpstreamDir $dir
    $destDir2 = Join-Path $destBase $dir

    if (-not (Test-Path $srcDir))
    {
        Write-Host "  [WARN] Dir not found in upstream: $dir" -ForegroundColor Yellow
        continue
    }

    if (-not $DryRun)
    {
        # NOTE: 整体覆盖目标目录，确保与上游完全一致
        if (Test-Path $destDir2) { Remove-Item $destDir2 -Recurse -Force }
        Copy-Item $srcDir $destDir2 -Recurse -Force
    }
    $stats.trainerDirs++
    Write-Host "  [SYNC] $dir/" -ForegroundColor DarkGray
}

# ===== Step 4: 转换首页 index.html =====
Write-Host "`nStep 4: Converting index.html..." -ForegroundColor Green

$srcIndex = Join-Path $UpstreamDir "index.html"
$destIndex = Join-Path $destBase "index.html"

if (Test-Path $srcIndex)
{
    # 使用字节级操作，避免编码问题
    $bytes = [System.IO.File]::ReadAllBytes($srcIndex)
    $content = [System.Text.Encoding]::UTF8.GetString($bytes)

    # --- 4a. 替换 getclicky 分析脚本为内联 GA ---
    $gaCode = @"
	<script async src="https://www.googletagmanager.com/gtag/js?id=$($config.analytics.trackingId)"></script>
	<script>
		window.dataLayer = window.dataLayer || [];
		function gtag() { dataLayer.push(arguments); }
		gtag('js', new Date());
		gtag('config', '$($config.analytics.trackingId)');
	</script>
"@
    $content = [regex]::Replace($content, '(?m)\s*<script\s+async\s+data-id="[^"]*"\s+src="//static\.getclicky\.com/js"\s*>\s*</script>', $gaCode)

    # --- 4b. 移除 Service Worker 注册代码块 ---
    # NOTE: 上游 Service Worker 硬编码 /Alg-Trainers/ 路径，本地不使用
    $content = [regex]::Replace($content, '(?s)<script>\s*var selectedAlgSets.*?registerServiceWorker\(\);\s*</script>', '<script>var selectedAlgSets = {};</script>')

    # --- 4c. 移除 manifest.json 引用 ---
    # NOTE: 上游 manifest 指向 /Alg-Trainers/，本地已有全站 manifest
    $content = [regex]::Replace($content, '(?m)\s*<link\s+rel="manifest"\s+href="manifest\.json"\s*/?\s*>', '')

    # --- 4d. 注入 i18n.js ---
    if ($content -notmatch 'i18n\.js')
    {
        $content = $content -replace '(</body>)', "<script src=""../i18n/i18n.js"" defer></script>`n`$1"
        # NOTE: 如果没有 </body>，在 </html> 前注入
        if ($content -notmatch 'i18n\.js')
        {
            $content = $content -replace '(</html>)', "<script src=""../i18n/i18n.js"" defer></script>`n`$1"
        }
    }

    # --- 写入文件 ---
    if (-not $DryRun)
    {
        $destDir2 = Split-Path $destIndex -Parent
        if (-not (Test-Path $destDir2))
        {
            New-Item -ItemType Directory -Path $destDir2 -Force | Out-Null
        }
        $outBytes = [System.Text.Encoding]::UTF8.GetBytes($content)
        [System.IO.File]::WriteAllBytes($destIndex, $outBytes)
    }
    $stats.indexConverted++
    Write-Host "  [CONV] index.html" -ForegroundColor DarkCyan
}

# ===== Step 5: 转换训练器子页面（注入 i18n.js + 替换分析脚本） =====
Write-Host "`nStep 5: Patching trainer pages (i18n + analytics)..." -ForegroundColor Green

foreach ($dir in $config.trainerDirs)
{
    $trainerIndex = Join-Path $destBase "$dir\index.html"
    if (-not (Test-Path $trainerIndex)) { continue }

    $bytes = [System.IO.File]::ReadAllBytes($trainerIndex)
    $content = [System.Text.Encoding]::UTF8.GetString($bytes)
    $changed = $false

    # --- 5a. 替换 getclicky 为内联 GA ---
    if ($content -match 'getclicky\.com')
    {
        $content = [regex]::Replace($content, '(?m)\s*<script\s+async\s+data-id="[^"]*"\s+src="//static\.getclicky\.com/js"\s*>\s*</script>', $gaCode)
        $changed = $true
    }

    # --- 5b. 注入 i18n.js（在 </head> 前） ---
    if ($content -notmatch 'i18n\.js')
    {
        # NOTE: 因为 main.js 用 body.outerHTML 替换整个 body，MutationObserver 会失效
        # 所以用 setInterval 轮询 template 加载完成后调用 I18n.apply()
        $i18nScript = @"
	<script src='../../i18n/i18n.js' defer></script>
	<script>
		// NOTE: 等待 template.html 动态注入完成后触发翻译
		var _i18nPoll = setInterval(function() {
			if (document.getElementById('timer') && window.I18n && I18n._ready) {
				clearInterval(_i18nPoll);
				I18n.apply();
			}
		}, 200);
	</script>
"@
        $content = $content -replace '(</head>)', "$i18nScript`n`$1"
        $changed = $true
    }

    if ($changed -and -not $DryRun)
    {
        $outBytes = [System.Text.Encoding]::UTF8.GetBytes($content)
        [System.IO.File]::WriteAllBytes($trainerIndex, $outBytes)
        Write-Host "  [PATCH] $dir/index.html" -ForegroundColor DarkCyan
    }
}

# ===== Step 6: 输出变更摘要 =====
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  Sync Complete!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  src/ files synced:     $($stats.srcFiles)"
Write-Host "  style/ files synced:   $($stats.styleFiles)"
Write-Host "  Root files synced:     $($stats.rootFiles)"
Write-Host "  Trainer dirs synced:   $($stats.trainerDirs)"
Write-Host "  Index converted:       $($stats.indexConverted)"
if ($DryRun)
{
    Write-Host "`n[DRY RUN] No files were modified." -ForegroundColor Yellow
}
else
{
    Write-Host "`nRun 'git diff' to review changes." -ForegroundColor Green
}
