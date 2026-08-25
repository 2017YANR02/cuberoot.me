<#
.SYNOPSIS
    从 D:\cube\blddb 上游构建 BLDDB 静态站并同步到 tools/blddb/。
.DESCRIPTION
    上游是 Next.js 16 App Router 应用（v2 分支），不是静态站，必须先 `next build`
    出静态导出。补丁在临时 detached worktree 里打、build 完立刻还原，主 clone 不切分支：
      ① next.config.js  → output:'export' + basePath + trailingSlash + 图片不优化
      ② i18n/server.ts  → getLocale() 去掉 cookies()（export 下唯一的动态 API 阻塞点）
    改上游 clone 的源码请先读 D:\cube\blddb\AGENTS.md。
.PARAMETER SkipPull
    跳过 git fetch，使用本机缓存的 origin/v2 构建；不使用主 clone 的私有 HEAD。
.PARAMETER SkipInstall
    跳过 npm 依赖检查（lock 没动时可省十几秒）。
.PARAMETER RepoRoot
    cuberoot.me 仓库根目录；保留 ProjectDir 作为旧参数别名。
.PARAMETER ValidateOnly
    只读校验仓库和脚本内部依赖后退出。
.NOTES
    上游 license: GPL-3.0
    前置：Node + npm（上游是 npm 工程，禁 pnpm —— 它自带 package-lock.json）
#>
param(
    [string]$BlddbDir = "D:\cube\blddb",
    [string]$ProjectDir = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..')),
    [switch]$SkipPull,
    [switch]$SkipInstall,
    [string]$RepoRoot,
    [switch]$ValidateOnly
)

$ErrorActionPreference = 'Stop'
$defaultRepoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$syncBootstrapRoot = if ($RepoRoot) { [IO.Path]::GetFullPath($RepoRoot) } else { [IO.Path]::GetFullPath($ProjectDir) }
. (Join-Path $syncBootstrapRoot '.sync\sync_utils.ps1')
$ProjectDir = Resolve-CubeRootRepoRoot -RepoRoot $RepoRoot -LegacyRoot $ProjectDir -ScriptRoot $defaultRepoRoot
Assert-SyncInternalFiles -RepoRoot $ProjectDir -RelativePaths @(
    'scripts/upstream/sync-blddb.ps1'
    '.sync/sync_utils.ps1'
    '.sync/blddb_postprocess.mjs'
    'docs/generated-artifacts.json'
) -PowerShellScripts @('scripts/upstream/sync-blddb.ps1')
if ($ValidateOnly)
{
    Write-Host "BLDDB 同步脚本校验通过：$ProjectDir" -ForegroundColor Green
    return
}

$dst = "$ProjectDir\tools\blddb"
# NOTE: 站点把 fork 静态挂在 /tools/<name>/，basePath 必须与之一致，否则 _next/ 资产 404。
$basePath = '/tools/blddb'

if (-not (Test-Path (Join-Path $BlddbDir '.git')))
{
    throw "$BlddbDir 不是 clone —— git clone https://github.com/nbwzx/blddb.git `"$BlddbDir`" (默认分支 v2)"
}

# ===== Step 1: 锁定公开上游来源 =====
function Get-BlddbGitPathLines
{
    param([string[]]$Arguments)

    $text = Get-CheckedNativeText -FilePath 'git' -ArgumentList (@('-C', $BlddbDir) + $Arguments)
    if (-not $text) { return @() }
    return @($text -split "`n" | Where-Object { $_ })
}

function Assert-BlddbLocalPaths
{
    param(
        [string[]]$Paths,
        [string]$Context
    )

    $unexpected = @($Paths | Where-Object { $_ -cne 'AGENTS.md' } | Sort-Object -Unique)
    if ($unexpected.Count -gt 0)
    {
        throw "$Context 只能包含 AGENTS.md；发现：$($unexpected -join ', ')"
    }
}

$primaryHead = Get-CheckedNativeText -FilePath 'git' -ArgumentList @('-C', $BlddbDir, 'rev-parse', '--verify', 'HEAD')
$primaryStatus = Get-CheckedNativeText -FilePath 'git' -ArgumentList @('-C', $BlddbDir, 'status', '--porcelain=v1', '--untracked-files=all')
$primaryStashes = Get-CheckedNativeText -FilePath 'git' -ArgumentList @('-C', $BlddbDir, 'stash', 'list', '--format=%H')

Assert-BlddbLocalPaths -Context 'BLDDB 未提交改动' -Paths @(
    Get-BlddbGitPathLines -Arguments @('diff', '--name-only')
    Get-BlddbGitPathLines -Arguments @('diff', '--cached', '--name-only')
    Get-BlddbGitPathLines -Arguments @('ls-files', '--others', '--exclude-standard')
)

$remoteRef = 'refs/remotes/origin/v2'
if ($SkipPull)
{
    Write-Host "[1/7] git fetch（--SkipPull，使用缓存 origin/v2）" -ForegroundColor DarkGray
}
else
{
    Write-Host "[1/7] git fetch origin/v2..." -ForegroundColor Cyan
    [void](Invoke-CheckedNativeCommand -FilePath 'git' -ArgumentList @(
        '-C', $BlddbDir, 'fetch', '--no-tags', 'origin', "+refs/heads/v2:$remoteRef"
    ) -FailureMessage 'BLDDB git fetch origin/v2 失败')
}

$sourceCommit = Get-CheckedNativeText -FilePath 'git' -ArgumentList @(
    '-C', $BlddbDir, 'rev-parse', '--verify', "$remoteRef^{commit}"
) -FailureMessage 'BLDDB 缺少缓存的 origin/v2；请去掉 -SkipPull 后重试'
Assert-BlddbLocalPaths -Context 'BLDDB 本地独有 commit' -Paths @(
    Get-BlddbGitPathLines -Arguments @('log', '--format=', '--name-only', "$remoteRef..HEAD")
)

$worktreeParent = Join-Path $ProjectDir '.tmp\upstream'
$sourceDir = Join-Path $worktreeParent ("blddb-" + [guid]::NewGuid().ToString('N'))
$worktreeAdded = $false
$stagingRoot = $null
New-Item -ItemType Directory -Path $worktreeParent -Force | Out-Null

try
{
    [void](Invoke-CheckedNativeCommand -FilePath 'git' -ArgumentList @(
        '-C', $BlddbDir, 'worktree', 'add', '--detach', $sourceDir, $sourceCommit
    ) -FailureMessage '创建 BLDDB detached worktree 失败')
    $worktreeAdded = $true
    $worktreeHead = Get-CheckedNativeText -FilePath 'git' -ArgumentList @('-C', $sourceDir, 'rev-parse', '--verify', 'HEAD')
    if ($worktreeHead -cne $sourceCommit)
    {
        throw "BLDDB worktree 来源漂移：expected=$sourceCommit actual=$worktreeHead"
    }
    $out = Join-Path $sourceDir 'out'

# ===== Step 2: 依赖 =====
if ($SkipInstall -and (Test-Path (Join-Path $sourceDir 'node_modules')))
{
    Write-Host "[2/7] npm install（--SkipInstall，跳过）" -ForegroundColor DarkGray
}
else
{
    Write-Host "[2/7] npm install..." -ForegroundColor Cyan
    Push-Location $sourceDir
    try
    {
        Invoke-CheckedNativeCommand -FilePath 'npm' -ArgumentList @('install', '--no-audit', '--no-fund') -FailureMessage 'npm install 失败'
    }
    finally { Pop-Location }
}

# ===== Step 3: 打补丁（build 后必还原） =====
Write-Host "[3/7] 打静态导出补丁..." -ForegroundColor Cyan

$nextConfigPath = "$sourceDir\next.config.js"
$i18nServerPath = "$sourceDir\src\i18n\server.ts"
# NOTE: next-env.d.ts 不打补丁，但 prod build 会把它里面的 .next/dev/types 改成 .next/types。
#       一起备份还原，否则 clone 每次同步后都脏一格，下次 --ff-only pull 被挡。
$nextEnvPath = "$sourceDir\next-env.d.ts"
$backup = @{}
foreach ($p in @($nextConfigPath, $i18nServerPath, $nextEnvPath))
{
    $backup[$p] = [System.IO.File]::ReadAllText($p)
}

function Write-Patched
{
    param([string]$Path, [string]$Text)
    # 上游是 LF 工程（.gitattributes eol=lf），写回也保持 LF，免得还原时 git 看成全文件改动。
    $lf = $Text -replace "`r`n", "`n"
    [System.IO.File]::WriteAllText($Path, $lf, (New-Object System.Text.UTF8Encoding $false))
}

$nextConfigPatched = @"
/** @type {import('next').NextConfig} */
// PATCHED by cuberoot.me/scripts/upstream/sync-blddb.ps1 —— 静态导出到 tools/blddb/，勿提交回上游。
const nextConfig = {
  output: "export",
  basePath: "$basePath",
  // trailingSlash: 导出成 <route>/index.html。nginx 的 `^~ /tools/` 与 dev 的
  // app/tools/[...slug]/route.ts 都按目录 + index.html 找，不认裸 <route>.html。
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

module.exports = nextConfig;
"@

try
{
    Write-Patched $nextConfigPath $nextConfigPatched

    # --- i18n/server.ts：去掉 cookies() ---
    # NOTE: 全站唯一的动态 API。留着它 root layout 转 dynamic，`output:'export'` 直接 build 失败。
    #       返回空 → useTranslation() 跳过服务端强制语言，交给客户端 LanguageDetector
    #       （i18next cookie → navigator）决定；切语言仍是写 cookie + reload，行为不变。
    $i18n = $backup[$i18nServerPath]
    $importAnchor = 'import { cookies } from "next/headers";'
    $bodyAnchor = @'
  const cookieStore = cookies();
  return (await cookieStore).get("i18next")?.value as Locales;
'@
    foreach ($anchor in @($importAnchor, $bodyAnchor))
    {
        if (-not $i18n.Contains(($anchor -replace "`r`n", "`n")))
        {
            throw "i18n/server.ts 找不到锚点，上游改写了这个文件：`n$anchor`n去 $i18nServerPath 看现在长什么样，改本脚本的补丁。"
        }
    }
    $i18n = $i18n.Replace($importAnchor + "`n", '').Replace($importAnchor, '')
    $i18n = $i18n.Replace(($bodyAnchor -replace "`r`n", "`n"), @'
  // PATCHED: 静态导出没有请求上下文，cookies() 会让整页转 dynamic 直接 build 失败。
  return undefined as unknown as Locales;
'@)
    Write-Patched $i18nServerPath $i18n

    # --- 组件里的 /images/ 补 basePath ---
    # NOTE: Next 只给 <Link href> 和 _next/ 资产自动补 basePath。next/image 的 src 要自己加
    #       （上游文档明说），CSS 里的 url() 更不会。漏了就是 logo / 捐赠码 / 语言旗全 404，
    #       页面还照样渲染 —— 静默坏。整棵 src 树按「引号或左括号紧跟 /images/」替换，
    #       上游新加的引用也一起覆盖到。
    $imgPattern = '(["'']|\()/images/'
    $imgHits = 0
    foreach ($f in (Get-ChildItem "$sourceDir\src" -Recurse -File -Include *.ts, *.tsx))
    {
        $t = [System.IO.File]::ReadAllText($f.FullName)
        $n = [regex]::Matches($t, $imgPattern).Count
        if ($n -eq 0) { continue }
        $backup[$f.FullName] = $t
        Write-Patched $f.FullName ([regex]::Replace($t, $imgPattern, "`$1$basePath/images/"))
        $imgHits += $n
    }
    if ($imgHits -eq 0)
    {
        throw "src/ 里一个 /images/ 引用都没匹配到 —— 上游换了引用写法，补 basePath 的规则失效了。"
    }
    Write-Host "  next.config.js + i18n/server.ts + $imgHits 处 /images/ 已打" -ForegroundColor Gray

    # ===== Step 4: 构建 =====
    Write-Host "[4/7] next build（静态导出，最慢，数 MB 级 JSON 要打包）..." -ForegroundColor Cyan
    if (Test-Path $out) { Invoke-WithFileRetry { Remove-Item $out -Recurse -Force } }
    Push-Location $sourceDir
    try
    {
        Invoke-CheckedNativeCommand -FilePath 'npm' -ArgumentList @('run', 'build') -FailureMessage 'next build 失败'
    }
    finally { Pop-Location }
}
finally
{
    # 还原上游 clone —— 无论成败都要还，否则下次 git pull 冲突。
    foreach ($p in $backup.Keys)
    {
        [System.IO.File]::WriteAllText($p, $backup[$p], (New-Object System.Text.UTF8Encoding $false))
    }
    Write-Host "  上游补丁已还原" -ForegroundColor DarkGray
}

# ===== Step 5: 校验产物 =====
Write-Host "[5/7] 校验产物..." -ForegroundColor Cyan

# NOTE: Next 16 的分段预取负载(RSC segment payload)导出成了目录树 ——
#         corner/__next.$d$codeType/__PAGE__.txt
#       但运行时按点号拼平了请求 ——
#         corner/__next.$d$codeType.__PAGE__.txt
#       静态托管下每个 <Link> 预取都 404(首页一进去 40+ 条),点进去退化成整页刷新。
#       目录名压平成点号即对上。只动 __next* 这一支,别的目录不碰。
$flattened = 0
foreach ($d in @(Get-ChildItem $out -Recurse -Directory | Where-Object { $_.Name -like '__next*' }))
{
    foreach ($f in @(Get-ChildItem -LiteralPath $d.FullName -Recurse -File))
    {
        $rel = $f.FullName.Substring($d.FullName.Length + 1) -replace '\\', '.'
        Move-Item -LiteralPath $f.FullName -Destination (Join-Path $d.Parent.FullName "$($d.Name).$rel") -Force
        $flattened++
    }
    Remove-Item -LiteralPath $d.FullName -Recurse -Force
}
Write-Host "  压平 $flattened 个分段预取负载" -ForegroundColor Gray
# NOTE: 每类路由各抽一个：首页 / [codeType] / bigbld / nightmare / 纯静态页。
#       少任何一个都说明 generateStaticParams 或 dynamicParams 被上游改过。
$mustExist = @(
    'index.html'
    'corner/index.html'
    'edge/index.html'
    'bigbld/wing/index.html'
    'nightmare/parity/index.html'
    'commutator/index.html'
    'checker/index.html'
    'sheets/index.html'
    'code/index.html'
    'settings/index.html'
    '404.html'
    # 压平后的分段预取负载:少了就是每次站内跳转都整页刷新
    'corner/__next.$d$codeType.__PAGE__.txt'
    'nightmare/parity/__next.nightmare.$d$codeType.__PAGE__.txt'
)
$missing = $mustExist | Where-Object { -not (Test-Path (Join-Path $out $_)) }
if ($missing)
{
    $missing | ForEach-Object { Write-Host "  [MISSING] $_" -ForegroundColor Red }
    throw "导出少了页面 —— 上游多半动了路由或 generateStaticParams。"
}

# basePath 生效了吗（漏了的话 _next/ 全 404，页面白屏但 HTML 还在，静默失败）
# NOTE: 变量别叫 $home —— PowerShell 的自动变量，只读，赋值直接抛。
$homeHtml = Get-Content (Join-Path $out 'index.html') -Raw
if ($homeHtml -notmatch [regex]::Escape("$basePath/_next/"))
{
    throw "index.html 里没有 $basePath/_next/ —— basePath 没生效，挂上去会白屏。"
}
# public/ 里的图（logo 在每页页头）必须带前缀,否则去站点根找 → 404
if ($homeHtml -match '(?<!blddb)"/images/')
{
    throw "index.html 里还有裸 /images/ —— basePath 补丁漏了，logo 会 404。"
}

# NOTE: public/data/ 的 49MB JSON 上游是**编译期** import 进 chunk 的（见 CLAUDE.md），
#       导出里 out/data/ 那份对 iframe 版的 /blddb 是纯死重量。但我们自己的
#       /alg/3bld/lookup 是运行时 fetch 它的（见 app/[lang]/alg/3bld/_lib/blddb.ts），
#       所以留下人工整理的 manmade 那批，砍掉 Nightmare 全集（穷举生成的，37MB，只有
#       /blddb 里用得到，而那边是编译期内联的，删了不影响）。
#       *NightmareSelected*（每 case 一条推荐解，共 130KB）和 nightmare/*.ts 速查表
#       这里也一并删 —— Step 7 的后处理会直接从上游 public/data 取，落成压缩过的 JSON。
$dataDir = Join-Path $out 'data'
if (Test-Path $dataDir)
{
    $before = (Get-ChildItem $dataDir -Recurse -File | Measure-Object Length -Sum).Sum
    Get-ChildItem $dataDir -Recurse -File | Where-Object { $_.Name -like '*Nightmare*' } |
        ForEach-Object { Invoke-WithFileRetry { Remove-Item -LiteralPath $_.FullName -Force } }
    # nightmare/*.ts 是 ArrayTable 的表源，同样编译期内联
    $nmDir = Join-Path $dataDir 'nightmare'
    if (Test-Path $nmDir) { Invoke-WithFileRetry { Remove-Item -LiteralPath $nmDir -Recurse -Force } }
    $after = (Get-ChildItem $dataDir -Recurse -File | Measure-Object Length -Sum).Sum
    Write-Host ("  data/：砍 Nightmare {0}MB，留 {1}MB" -f
        [math]::Round(($before - $after) / 1MB, 1), [math]::Round($after / 1MB, 1)) -ForegroundColor Gray

    # 我们自己的页面靠这几个文件，缺了就是空表。六套 case 一套一个文件，少一套那个
    # 类型在 /alg/3bld/lookup 上就永远"查不到"——不会报错，所以这里硬卡。
    $dataMust = @(
        'cornerManmade.json'
        'edgeManmade.json'
        'parityManmade.json'
        'twistsManmade.json'
        'flipsManmade.json'
        'ltctManmade.json'
        'sourceToUrl.json'
        'sourceToResult.json'
        'algToUrl.json'
    )
    $dataMissing = $dataMust | Where-Object { -not (Test-Path (Join-Path $dataDir $_)) }
    if ($dataMissing)
    {
        throw "data/ 少了 $($dataMissing -join ', ') —— /alg/3bld/lookup 会空表。"
    }
}

# ===== Step 6: 完成候选目录 =====
# NOTE: 复制、license、后处理和 provenance 全在候选目录完成；这些都成功前不碰现役目录。
Write-Host "[6/7] 生成完整候选目录..." -ForegroundColor Cyan
$stagingRoot = Join-Path $ProjectDir ('.tmp\blddb-sync-' + [guid]::NewGuid().ToString('N'))
$candidate = Join-Path $stagingRoot 'candidate'
$previous = Join-Path $stagingRoot 'previous'
New-Item -ItemType Directory -Path $stagingRoot -Force | Out-Null
Invoke-WithFileRetry { Copy-Item $out $candidate -Recurse -Force }
Invoke-WithFileRetry { Copy-Item (Join-Path $sourceDir 'LICENSE') (Join-Path $candidate 'LICENSE') -Force }

Write-Host "  后处理 data/（起手位置 + Nightmare 速查表）..." -ForegroundColor Cyan
[void](Invoke-CheckedNativeCommand -FilePath 'node' -ArgumentList @(
    (Join-Path $ProjectDir '.sync\blddb_postprocess.mjs'),
    '--upstream', $sourceDir,
    '--repo', $ProjectDir,
    '--data-dir', (Join-Path $candidate 'data')
) -FailureMessage 'blddb_postprocess.mjs 失败 —— 候选目录未发布。')

Write-UpstreamVersionRecord `
    -RepoRoot $ProjectDir `
    -ArtifactId 'tools.blddb' `
    -WorkingDirectory $sourceDir `
    -OutputPath (Join-Path $candidate 'UPSTREAM.txt')

$candidateRequired = @('index.html', 'LICENSE', 'UPSTREAM.txt', 'data\cornerManmade.json')
$candidateMissing = @($candidateRequired | Where-Object { -not (Test-Path -LiteralPath (Join-Path $candidate $_)) })
if ($candidateMissing.Count -gt 0)
{
    throw "BLDDB 候选目录不完整：$($candidateMissing -join ', ')"
}
$recordedCommit = Get-Content -LiteralPath (Join-Path $candidate 'UPSTREAM.txt') |
    Where-Object { $_ -like 'Commit: *' } |
    Select-Object -First 1
if ($recordedCommit -cne "Commit: $sourceCommit")
{
    throw "BLDDB provenance 与构建来源不一致：$recordedCommit"
}

$worktreeTrackedStatus = Get-CheckedNativeText -FilePath 'git' -ArgumentList @(
    '-C', $sourceDir, 'status', '--porcelain=v1', '--untracked-files=no'
)
if ($worktreeTrackedStatus)
{
    throw "BLDDB 构建改脏了上游 tracked 文件，候选目录未发布：`n$worktreeTrackedStatus"
}

# ===== Step 7: 同卷切换，失败恢复旧目录 =====
Write-Host "[7/7] 发布到 tools/blddb/..." -ForegroundColor Cyan
$oldMoved = $false
try
{
    if (Test-Path -LiteralPath $dst)
    {
        Invoke-WithFileRetry { Move-Item -LiteralPath $dst -Destination $previous }
        $oldMoved = $true
    }
    Invoke-WithFileRetry { Move-Item -LiteralPath $candidate -Destination $dst }
}
catch
{
    $publishError = $_
    if ($oldMoved -and -not (Test-Path -LiteralPath $dst))
    {
        try
        {
            Invoke-WithFileRetry { Move-Item -LiteralPath $previous -Destination $dst }
        }
        catch
        {
            throw "BLDDB 发布失败且自动恢复失败；旧目录保留在 $previous。发布错误：$($publishError.Exception.Message)；恢复错误：$($_.Exception.Message)"
        }
    }
    throw "BLDDB 发布失败，旧目录已恢复：$($publishError.Exception.Message)"
}

if ($oldMoved -and (Test-Path -LiteralPath $previous))
{
    Invoke-WithFileRetry { Remove-Item -LiteralPath $previous -Recurse -Force }
}
if (Test-Path -LiteralPath $stagingRoot)
{
    Invoke-WithFileRetry { Remove-Item -LiteralPath $stagingRoot -Recurse -Force }
}

$sizeMB = [math]::Round((Get-ChildItem $dst -Recurse -File | Measure-Object Length -Sum).Sum / 1MB, 1)
$fileCount = (Get-ChildItem $dst -Recurse -File).Count
}
finally
{
    if ($worktreeAdded)
    {
        [void](Invoke-CheckedNativeCommand -FilePath 'git' -ArgumentList @(
            '-C', $BlddbDir, 'worktree', 'remove', '--force', $sourceDir
        ) -FailureMessage "清理 BLDDB detached worktree 失败：$sourceDir")
    }
    if (Test-Path -LiteralPath $sourceDir)
    {
        Invoke-WithFileRetry { Remove-Item -LiteralPath $sourceDir -Recurse -Force }
    }
    if ($stagingRoot -and (Test-Path -LiteralPath $stagingRoot) -and
        -not (Test-Path -LiteralPath (Join-Path $stagingRoot 'previous')))
    {
        Invoke-WithFileRetry { Remove-Item -LiteralPath $stagingRoot -Recurse -Force }
    }

    $afterPrimaryHead = Get-CheckedNativeText -FilePath 'git' -ArgumentList @('-C', $BlddbDir, 'rev-parse', '--verify', 'HEAD')
    $afterPrimaryStatus = Get-CheckedNativeText -FilePath 'git' -ArgumentList @('-C', $BlddbDir, 'status', '--porcelain=v1', '--untracked-files=all')
    $afterPrimaryStashes = Get-CheckedNativeText -FilePath 'git' -ArgumentList @('-C', $BlddbDir, 'stash', 'list', '--format=%H')
    if ($afterPrimaryHead -cne $primaryHead -or $afterPrimaryStatus -cne $primaryStatus -or $afterPrimaryStashes -cne $primaryStashes)
    {
        throw 'BLDDB 主 clone 的 HEAD、工作区或 stash 在同步期间发生变化。'
    }
}

Write-Host "  tools/blddb/：$fileCount 个文件，${sizeMB}MB" -ForegroundColor Gray
Invoke-CheckedNativeCommand -FilePath 'git' -ArgumentList @(
    '-C', $ProjectDir, 'status', '--short', 'tools/blddb'
) | Select-Object -First 20
Write-Host "完成。改动未提交。" -ForegroundColor Green
