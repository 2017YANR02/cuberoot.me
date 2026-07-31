<#
.SYNOPSIS
    从 D:\cube\blddb 上游构建 BLDDB 静态站并同步到 tools/blddb/。
.DESCRIPTION
    上游是 Next.js 16 App Router 应用（v2 分支），不是静态站，必须先 `next build`
    出静态导出。三处补丁在本脚本里打、build 完立刻还原，上游 clone 保持干净：
      ① next.config.js  → output:'export' + basePath + trailingSlash + 图片不优化
      ② i18n/server.ts  → getLocale() 去掉 cookies()（export 下唯一的动态 API 阻塞点）
      ③ 无（其余保持原样）
    改上游 clone 的源码请先读 D:\cube\blddb\CLAUDE.md。
.PARAMETER SkipPull
    跳过 git pull，用当前 clone 的工作区重新构建。
.PARAMETER SkipInstall
    跳过 npm 依赖检查（lock 没动时可省十几秒）。
.NOTES
    上游 license: GPL-3.0
    前置：Node + npm（上游是 npm 工程，禁 pnpm —— 它自带 package-lock.json）
#>
param(
    [string]$BlddbDir = "D:\cube\blddb",
    [string]$ProjectDir = $PSScriptRoot,
    [switch]$SkipPull,
    [switch]$SkipInstall
)

$ErrorActionPreference = 'Stop'
. (Join-Path $ProjectDir ".sync\sync_utils.ps1")

$dst = "$ProjectDir\tools\blddb"
$out = "$BlddbDir\out"
# NOTE: 站点把 fork 静态挂在 /tools/<name>/，basePath 必须与之一致，否则 _next/ 资产 404。
$basePath = '/tools/blddb'

if (-not (Test-Path (Join-Path $BlddbDir '.git')))
{
    throw "$BlddbDir 不是 clone —— git clone https://github.com/nbwzx/blddb.git `"$BlddbDir`" (默认分支 v2)"
}

# ===== Step 1: 拉上游 =====
if ($SkipPull)
{
    Write-Host "[1/6] git pull（--SkipPull，跳过）" -ForegroundColor DarkGray
}
else
{
    Write-Host "[1/6] git pull blddb..." -ForegroundColor Cyan
    $before = git -C $BlddbDir rev-parse --short HEAD
    git -C $BlddbDir pull --ff-only origin v2
    if ($LASTEXITCODE -ne 0) { throw "git pull 失败 —— 多半是上次同步没还原补丁，去 $BlddbDir 看 git status。" }
    $after = git -C $BlddbDir rev-parse --short HEAD
    if ($before -eq $after) { Write-Host "  已是最新 ($after)" -ForegroundColor DarkGray }
    else { Write-Host "  $before -> $after" -ForegroundColor Green }
}

# ===== Step 2: 依赖 =====
if ($SkipInstall -and (Test-Path "$BlddbDir\node_modules"))
{
    Write-Host "[2/6] npm install（--SkipInstall，跳过）" -ForegroundColor DarkGray
}
else
{
    Write-Host "[2/6] npm install..." -ForegroundColor Cyan
    Push-Location $BlddbDir
    try
    {
        & npm install --no-audit --no-fund
        if ($LASTEXITCODE -ne 0) { throw "npm install 失败" }
    }
    finally { Pop-Location }
}

# ===== Step 3: 打补丁（build 后必还原） =====
Write-Host "[3/6] 打静态导出补丁..." -ForegroundColor Cyan

$nextConfigPath = "$BlddbDir\next.config.js"
$i18nServerPath = "$BlddbDir\src\i18n\server.ts"
# NOTE: next-env.d.ts 不打补丁，但 prod build 会把它里面的 .next/dev/types 改成 .next/types。
#       一起备份还原，否则 clone 每次同步后都脏一格，下次 --ff-only pull 被挡。
$nextEnvPath = "$BlddbDir\next-env.d.ts"
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
// PATCHED by cuberoot.me/_sync_blddb.ps1 —— 静态导出到 tools/blddb/，勿提交回上游。
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
    foreach ($f in (Get-ChildItem "$BlddbDir\src" -Recurse -File -Include *.ts, *.tsx))
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
    Write-Host "[4/6] next build（静态导出，最慢，数 MB 级 JSON 要打包）..." -ForegroundColor Cyan
    if (Test-Path $out) { Invoke-WithFileRetry { Remove-Item $out -Recurse -Force } }
    Push-Location $BlddbDir
    try
    {
        & npm run build
        if ($LASTEXITCODE -ne 0) { throw "next build 失败" }
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
Write-Host "[5/6] 校验产物..." -ForegroundColor Cyan

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
#       /alg/3bld/3style 是运行时 fetch 它的（见 lib/blddb-data.ts），所以留下人工整理的
#       manmade 那批，砍掉 Nightmare（穷举生成的，37MB，只有 /blddb 里用得到，
#       而那边是编译期内联的，删了不影响）。
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

    # 我们自己的页面靠这几个文件，缺了就是空表
    $dataMust = @(
        'cornerManmade.json'
        'edgeManmade.json'
        'sourceToUrl.json'
        'sourceToResult.json'
        'algToUrl.json'
    )
    $dataMissing = $dataMust | Where-Object { -not (Test-Path (Join-Path $dataDir $_)) }
    if ($dataMissing)
    {
        throw "data/ 少了 $($dataMissing -join ', ') —— /alg/3bld/3style 会空表。"
    }
}

# ===== Step 6: 落到 tools/blddb/ =====
Write-Host "[6/6] 同步到 tools/blddb/..." -ForegroundColor Cyan
# NOTE: 整目录换掉而不是增量 —— Next 的 chunk 文件名带 hash，增量会攒一堆孤儿。
if (Test-Path $dst) { Invoke-WithFileRetry { Remove-Item $dst -Recurse -Force } }
Invoke-WithFileRetry { Copy-Item $out $dst -Recurse -Force }
Invoke-WithFileRetry { Copy-Item "$BlddbDir\LICENSE" "$dst\LICENSE" -Force }

$sha = git -C $BlddbDir rev-parse --short HEAD
$date = git -C $BlddbDir log -1 --format="%ai"
$txt = @"
Vendored from https://github.com/nbwzx/blddb (branch v2)
Commit:  $sha
Date:    $date
License: GPL-3.0 (see ./LICENSE)

Static export of the upstream Next.js app, built by _sync_blddb.ps1 at repo root.
Do NOT hand-edit anything here — it is generated. Patches (static-export config +
i18n cookies() removal) live in that script; upstream notes in D:\cube\blddb\CLAUDE.md.

data/ keeps only the hand-curated "manmade" JSON. Upstream imports all of it at build
time (so the iframe app already has it inside the _next chunks); this copy exists for
OUR native page at /alg/3bld/3style, which fetches it at runtime via lib/blddb-data.ts.
The Nightmare sets (~37MB of exhaustively generated cases) are dropped — only the
iframe app uses those, and it has them inlined.

Served at: /tools/blddb/  (basePath baked into the bundle — moving the path needs a rebuild)
Wrapped by: core/packages/client/app/[lang]/blddb/page.tsx
"@
Set-Content -Path "$dst\UPSTREAM.txt" -Value $txt -Encoding UTF8

$sizeMB = [math]::Round((Get-ChildItem $dst -Recurse -File | Measure-Object Length -Sum).Sum / 1MB, 1)
$fileCount = (Get-ChildItem $dst -Recurse -File).Count
Write-Host "  tools/blddb/：$fileCount 个文件，${sizeMB}MB" -ForegroundColor Gray

git -C $ProjectDir status --short tools/blddb | Select-Object -First 20
Write-Host "完成。改动未提交。" -ForegroundColor Green
