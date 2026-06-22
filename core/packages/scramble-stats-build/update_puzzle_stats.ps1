#!/usr/bin/env pwsh
# 非 3x3 puzzle 整解最优步数分布 手动增量管道 (EPIC 3 新管线; 2x2x2 pocket 先行, 后续 puzzle 注册即用)
#
# 一键:        pwsh update_puzzle_stats.ps1                     (全部已注册 puzzle, 增量补满)
# 小样本验形:  pwsh update_puzzle_stats.ps1 -MaxNew 300         (只取 300 条新打乱, 跑通全链验 JSON 形状)
# 选 puzzle:   pwsh update_puzzle_stats.ps1 -Puzzles 222
# 只重算 JSON: pwsh update_puzzle_stats.ps1 -BuildOnly          (用现有 CSV 状态重写 puzzle_distribution.json)
#
# 流程: WCA export Scrambles.tsv (3x3 管道已抽好的 incremental/tsv/, 缺则从 cache zip 单条目流式抽)
#       -> 按 event_id 过滤出该 puzzle 语料, 增量追加 <data>/<key>/scrambles.txt (id,scramble)
#       -> txt 与 <key>.csv 的 id 差集分块喂 <key>_analyzer (stdin=文件名, 产 *_<key>.csv), 逐块校验追加
#       -> build_puzzle_dist.ts 重算 stats/scramble/puzzle_distribution.json
#       发布(scp static) **不在本脚本**: 全量灌注 + 发布 = MANUAL, 跟 update_cross_stats 的发布步同口径。
#       任一步失败即停。
[CmdletBinding()]
param(
  [string[]]$Puzzles = @(),   # 空 = 全部已注册 puzzle
  [int]$MaxNew = 0,        # >0: 本次最多新增 N 条语料(小样本验形/限量增量); 0=取满
  [int]$ChunkSize = 200000,# analyzer 分块大小(pocket 全表直查 ~百万/s, 一块秒级)
  [switch]$BuildOnly,      # 跳过取数/解算, 直接用现有 CSV 重算 JSON
  [int]$SampledN = 0,      # >0: TIER C/D 离线采样分布的样本数(0 = 用脚本各 event 的 defaultN)
  [string[]]$SampledEvents = @()  # 空 = 全部已注册 TIER C/D 采样分布 event(下方 $SAMPLED_DIST_EVENTS)
)
$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

# 算力限额(全局规则: 重计算 ≤14 线程, 低优先级); 调用方可预设 RAYON_NUM_THREADS 覆盖(内存紧用 8)
if (-not $env:RAYON_NUM_THREADS) { $env:RAYON_NUM_THREADS = '14' }
try { (Get-Process -Id $PID).PriorityClass = 'BelowNormal' } catch {}

# analyzer 追加第 3 列「一条最优解」(pocket/skewb/pyraminx 支持;逆之即「最优等价打乱」,
# 供 build_puzzle_examples 产「原始/最优」切换数据)。sq1 analyzer 不认此开关(无解列,前端自动只显原始)。
$env:PUZZLE_EMIT_SOLN = '1'

# ---- 本机布局 ----
$ScrambleDir = 'D:\cube\scramble\wca_scramble'
$TsvDir      = Join-Path $ScrambleDir 'incremental\tsv'
$CacheDir    = Join-Path $ScrambleDir 'incremental\cache'
$ExportDate  = Join-Path $ScrambleDir 'incremental\export_date.txt'
$SolverRel   = 'D:\cube\cuberoot.me\solver\target\release'
$PuzzleRoot  = 'D:\cube\scramble\puzzle'   # 与 config.yml puzzle_data_dir 一致
$PkgDir      = $PSScriptRoot

# puzzle 注册表: key -> WCA event_id + analyzer exe (suffix 恒 _<key>)。
# 新 puzzle = 此处加一行 + build_puzzle_dist.ts 的 PUZZLES 加一行。
#
# 「最优等价打乱」(PUZZLE_EMIT_SOLN 第 3 列)支持现状:
#   pocket / pyraminx / skewb = 精确最优解, 已产 soln 列 → 前端「原始/最优」切换可用。
#   sq1   = 难度走【精确档】(WCA 12c4 = Sq1WcaSolver/sq1_wca_exact.csv; slash 最优 = Sq1Solver/sq1_slash_exact.csv)。
#          不在 $PUZZLE 注册表(无全表查表型 analyzer); 由下方「SQ1 块」增量调 inject_sq1_{wca,slash}_exact.ps1
#          (需本机 13GB sq1_wca_jsqfull.bin; 缺表则告警跳过, 分布留旧值)。build_puzzle_dist 读 exact CSV。
#          近最优(twophase)2026-06-18 退役, 代码仍在 solver/src/sq1_twophase.rs 作对照。
#   clock = 暂无 solver, 未注册; 接入时一并加 soln 列。
$PUZZLE = @{
  '222'    = @{ event = '222';   exe = 'cube222_analyzer.exe' }
  pyraminx = @{ event = 'pyram'; exe = 'pyraminx_analyzer.exe' }
  skewb    = @{ event = 'skewb'; exe = 'skewb_analyzer.exe' }
}

# sq1 不在 $PUZZLE 注册表(走精确 inject 脚本, 见下方 SQ1 块), 但默认 / 一条龙都要带它。
if (-not $Puzzles -or $Puzzles.Count -eq 0) { $Puzzles = @($PUZZLE.Keys | Sort-Object) + 'sq1' }
$Sq1Requested = $Puzzles -contains 'sq1'
$RegPuzzles   = @($Puzzles | Where-Object { $_ -ne 'sq1' })   # 注册表 analyzer 循环只处理这些; sq1 单独走 inject

function Step($m){ Write-Host "`n=== $m ===" -ForegroundColor Cyan }

# 确保 Scrambles.tsv 在位: 3x3 管道(update_cross_stats)每次取数都会抽好; 缺则从最新 cache zip 单条目流式抽取。
function Ensure-ScramblesTsv {
  $tsv = Join-Path $TsvDir 'Scrambles.tsv'
  if (Test-Path $tsv) { return $tsv }
  $zip = Get-ChildItem $CacheDir -Filter 'WCA_export_*.tsv.zip' -ErrorAction Stop |
         Sort-Object Name | Select-Object -Last 1
  if (-not $zip) { throw "Scrambles.tsv 不在 $TsvDir 且 $CacheDir 无 export zip; 先跑一次 update_cross_stats.ps1 取数" }
  Step "从 $($zip.Name) 抽取 Scrambles.tsv"
  New-Item -ItemType Directory -Force $TsvDir | Out-Null
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $z = [IO.Compression.ZipFile]::OpenRead($zip.FullName)
  try {
    $entry = $z.Entries | Where-Object { $_.Name -match 'scramble' -and $_.Name -like '*.tsv' } | Select-Object -First 1
    if (-not $entry) { throw "zip 内找不到 Scrambles tsv 条目" }
    [IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $tsv, $true)
  } finally { $z.Dispose() }
  return $tsv
}

# 已有 id 集合(文件首列, 逗号前)
function Load-Ids($file, $skipHeader){
  $set = [Collections.Generic.HashSet[string]]::new()
  if (-not (Test-Path $file)) { return ,$set }
  $first = $true
  foreach($line in [IO.File]::ReadLines($file)){
    if ($first) { $first = $false; if ($skipHeader) { continue } }
    if (-not $line) { continue }
    $i = $line.IndexOf(',')
    if ($i -gt 0) { [void]$set.Add($line.Substring(0, $i)) }
  }
  return ,$set
}

function Append-Lines($master, $src, $skipHeader){
  # LF 安全追加(对齐 update_cross_stats AppendData)
  $needNL = $false
  if ((Test-Path $master) -and ((Get-Item $master).Length -gt 0)) {
    $fs = [IO.File]::Open($master,'Open','ReadWrite'); [void]$fs.Seek(-1,'End'); $needNL = ($fs.ReadByte() -ne 10); $fs.Close()
  }
  $sw = New-Object IO.StreamWriter($master, $true, [Text.UTF8Encoding]::new($false))
  try {
    if ($needNL) { $sw.Write("`n") }
    $i = 0
    foreach($line in [IO.File]::ReadLines($src)){ if($skipHeader -and $i -eq 0){ $i++; continue }; $sw.Write($line); $sw.Write("`n"); $i++ }
  } finally { $sw.Close() }
}

if (-not $BuildOnly) {
  foreach ($name in $RegPuzzles) {
    $spec = $PUZZLE[$name]
    if (-not $spec) { throw "未注册的 puzzle: $name (已注册: $($PUZZLE.Keys -join ', '))" }
    $dir = Join-Path $PuzzleRoot $name
    New-Item -ItemType Directory -Force $dir | Out-Null
    $txt = Join-Path $dir 'scrambles.txt'
    $csv = Join-Path $dir "$name.csv"

    # ---- 1. 语料增量抽取 (Scrambles.tsv 按 event 过滤, 跳过已有 id) ----
    Step "[$name] 语料抽取 (event=$($spec.event))"
    $tsv = Ensure-ScramblesTsv
    $known = Load-Ids $txt $false
    Write-Host "  已有语料 $($known.Count) 条"
    $added = 0
    $sw = New-Object IO.StreamWriter($txt, $true, [Text.UTF8Encoding]::new($false))
    try {
      $idIdx = -1; $scrIdx = -1; $evIdx = -1
      foreach ($line in [IO.File]::ReadLines($tsv)) {
        if ($idIdx -lt 0) {
          $h = $line.Split("`t")
          $idIdx = [Array]::IndexOf($h, 'id'); $scrIdx = [Array]::IndexOf($h, 'scramble'); $evIdx = [Array]::IndexOf($h, 'event_id')
          if ($idIdx -lt 0 -or $scrIdx -lt 0 -or $evIdx -lt 0) { throw "Scrambles.tsv 缺关键列; 表头=$line" }
          continue
        }
        $c = $line.Split("`t")
        if ($c.Length -le $evIdx -or $c[$evIdx] -ne $spec.event) { continue }
        $id = $c[$idIdx]
        if ($known.Contains($id)) { continue }
        $sw.Write($id); $sw.Write(','); $sw.Write($c[$scrIdx].Trim()); $sw.Write("`n")
        $added++
        if ($MaxNew -gt 0 -and $added -ge $MaxNew) { break }
      }
    } finally { $sw.Close() }
    Write-Host "  新增 $added 条 -> $txt"

    # ---- 2. 增量解算 (txt - csv 的 id 差集, 分块 analyzer + 校验追加) ----
    Step "[$name] 解算补缺"
    $exe = Join-Path $SolverRel $spec.exe
    if (-not (Test-Path $exe)) { throw "analyzer 不存在: $exe (先 cargo build --release --bin $($spec.exe -replace '\.exe$',''))" }
    $done = Load-Ids $csv $true
    $todo = [Collections.Generic.List[string]]::new()
    foreach ($line in [IO.File]::ReadLines($txt)) {
      if (-not $line) { continue }
      $i = $line.IndexOf(',')
      if ($i -gt 0 -and -not $done.Contains($line.Substring(0, $i))) { [void]$todo.Add($line) }
    }
    Write-Host "  待解 $($todo.Count) 条 (csv 已有 $($done.Count))"
    $chunkIn  = Join-Path $dir "chunk_$name.txt"
    $chunkOut = Join-Path $dir "chunk_${name}_$name.csv"   # executor 输出 = <输入名>_<suffix>.csv
    for ($i = 0; $i -lt $todo.Count; $i += $ChunkSize) {
      $n = [Math]::Min($ChunkSize, $todo.Count - $i)
      [IO.File]::WriteAllLines($chunkIn, $todo.GetRange($i, $n))
      if (Test-Path $chunkOut) { Remove-Item $chunkOut -Force }
      $chunkIn | & $exe 2>&1 | Where-Object { $_ -notmatch '^\[PROG\]' } | Out-Null
      if ($LASTEXITCODE -ne 0) { throw "[$name] analyzer 失败 (块 @$i)" }
      $outRows = 0; foreach($l in [IO.File]::ReadLines($chunkOut)){ $outRows++ }
      if ($outRows -ne $n + 1) { throw "[$name] 块 @$i 行数不符: 期望 $($n+1)(含 header) 实得 $outRows" }
      # master 不存在 *或* 空(被清空重灌)都要保留 chunk 表头,否则 build 报缺列
      $withHeader = (-not (Test-Path $csv)) -or ((Get-Item $csv).Length -eq 0)
      Append-Lines $csv $chunkOut (-not $withHeader)
      Write-Host "  块 @$i +$n -> $csv"
    }
    foreach ($f in @($chunkIn, $chunkOut)) { if (Test-Path $f) { Remove-Item $f -Force } }
  }
}

# ---- 2.5 SQ1 精确档(增量): 不在注册表(无全表查表型 analyzer), 走 inject 脚本 ----
#   WCA 12c4 最优(Sq1WcaSolver, 需 13GB sq1_wca_jsqfull.bin) + slash 最优(Sq1Solver, 零盘表)。
#   两 inject 脚本都按 id 跳过已完成 → 只解本次新增打乱; 无新打乱则跳过(不白载 13GB 表); 表缺失则告警跳过。
if ($Sq1Requested -and -not $BuildOnly) {
  Step "[sq1] 精确档增量 (WCA 12c4 + slash 最优)"
  $sq1Dir = Join-Path $PuzzleRoot 'sq1'
  $sq1Txt = Join-Path $sq1Dir 'scrambles.txt'
  $sq1Wca = Join-Path $sq1Dir 'sq1_wca_exact.csv'
  New-Item -ItemType Directory -Force $sq1Dir | Out-Null

  # 1. 语料增量抽取 (event=sq1; 同注册 puzzle 的过滤逻辑)
  $tsv = Ensure-ScramblesTsv
  $known = Load-Ids $sq1Txt $false
  Write-Host "  已有语料 $($known.Count) 条"
  $added = 0
  $sw = New-Object IO.StreamWriter($sq1Txt, $true, [Text.UTF8Encoding]::new($false))
  try {
    $idIdx = -1; $scrIdx = -1; $evIdx = -1
    foreach ($line in [IO.File]::ReadLines($tsv)) {
      if ($idIdx -lt 0) {
        $h = $line.Split("`t")
        $idIdx = [Array]::IndexOf($h, 'id'); $scrIdx = [Array]::IndexOf($h, 'scramble'); $evIdx = [Array]::IndexOf($h, 'event_id')
        if ($idIdx -lt 0 -or $scrIdx -lt 0 -or $evIdx -lt 0) { throw "Scrambles.tsv 缺关键列; 表头=$line" }
        continue
      }
      $c = $line.Split("`t")
      if ($c.Length -le $evIdx -or $c[$evIdx] -ne 'sq1') { continue }
      $id = $c[$idIdx]
      if ($known.Contains($id)) { continue }
      $sw.Write($id); $sw.Write(','); $sw.Write($c[$scrIdx].Trim()); $sw.Write("`n")
      $added++
      if ($MaxNew -gt 0 -and $added -ge $MaxNew) { break }
    }
  } finally { $sw.Close() }
  Write-Host "  新增 $added 条 -> $sq1Txt"

  # 2. delta = scrambles.txt 里尚未在 sq1_wca_exact.csv 的 id 数(待精确解算)
  $wcaDone = Load-Ids $sq1Wca $true
  $deltaWca = 0
  foreach ($line in [IO.File]::ReadLines($sq1Txt)) {
    if (-not $line) { continue }
    $i = $line.IndexOf(','); if ($i -gt 0 -and -not $wcaDone.Contains($line.Substring(0,$i))) { $deltaWca++ }
  }

  # 3. 13GB jsqfull 表在场检查(WCA 精确求解器必需)
  $jsqFull = 'D:/cube/cuberoot.me/solver/tables/sq1_wca_jsqfull.bin'
  $tableOk = (Test-Path $jsqFull) -and ((Get-Item $jsqFull).Length -eq 13005619200)

  if ($deltaWca -eq 0) {
    Write-Host "  无新 SQ1 打乱, 精确档已最新 (跳过解算)" -ForegroundColor DarkGray
  } elseif (-not $tableOk) {
    Write-Warning "  $deltaWca 条新 SQ1 打乱待精确解算, 但 13GB 表缺失/不完整 ($jsqFull) → 跳过 SQ1 精确刷新 (分布暂留旧值)。补表后重跑即增量补上。"
  } else {
    # 3a. 【① 大部分】WCA 12c4 精确(增量, 跳过已完成 id; 单次载表 ~75s)。深态超时 → 记 id,M
    Write-Host "  $deltaWca 条新打乱 → WCA 12c4 精确 (inject_sq1_wca_exact.ps1)"
    pwsh (Join-Path $PkgDir 'inject_sq1_wca_exact.ps1')
    if ($LASTEXITCODE -ne 0) { throw 'inject_sq1_wca_exact.ps1 失败' }

    # 3b. 【②/③ 怪物啃到全清】新 WCA 怪物(id,M)→ grind 升级阶梯啃到 0 残留(WCA 口径必须全部可证最优,
    #     不留 id,M/不回退)。每趟带 ≤10min/条看门狗(不死等单条);啃不完就升级资源重试(满核 -Split → 加大 TT),
    #     复刻历史 278/278 全清(最硬 4798824 即满核+300M TT 在 10min 内解出=24)。grind 可续,只啃未解。
    $CountM = { param($p) $n = 0; foreach ($l in [IO.File]::ReadLines($p)) { if ($l.EndsWith(',M')) { $n++ } }; $n }
    $nMon = & $CountM $sq1Wca
    if ($nMon -gt 0) {
      Write-Host "  $nMon 条新 WCA 怪物 → 升级阶梯啃到全清"
      $ladder = @(
        @{ desc = '批量 4核/240M TT';        args = @() },
        @{ desc = '满核 -Split';             args = @('-Split', '2') },
        @{ desc = '满核 -Split + 300M TT';   args = @('-Split', '2', '-TtBudget', '300000000') }
      )
      foreach ($rung in $ladder) {
        $before = & $CountM $sq1Wca
        if ($before -eq 0) { break }
        Write-Host "    [$($rung.desc)] 还剩 $before 条 …"
        pwsh (Join-Path $PkgDir 'grind_sq1_monsters.ps1') @($rung.args)
        if ($LASTEXITCODE -ne 0) { Write-Warning "    grind 退出码 $LASTEXITCODE(可能检测到并跑的 sq1_analyzer 而拒绝)" }
        $after = & $CountM $sq1Wca
        if ($after -eq 0) { Write-Host "    ✓ WCA 全清 (0 残留, 全部可证最优)" -ForegroundColor Green; break }
        if ($after -lt $before) { Write-Host "    啃下 $($before - $after) 条, 升级资源继续 …" -ForegroundColor DarkYellow }
        else { Write-Host "    本趟无进展, 升级资源重试 …" -ForegroundColor DarkYellow }
      }
      $nLeft = & $CountM $sq1Wca
      if ($nLeft -gt 0) { Write-Warning "  仍剩 $nLeft 条 brutal 怪物(满核+300M TT/10min 仍没啃下, 比 4798824 还硬)→ 真·Tier 2(更大耦合 PDB / 紧凑 open-addressing TT 抬 h)。手动死磕: 'pwsh grind_sq1_monsters.ps1 -Split 2 -TtBudget 300000000 -TimeoutSecs 0'(慎,可能数小时/条),啃完重跑 -Jobs puzzles -Puzzles sq1。" }
    }

    # 3c. slash 最优(增量, 只解新歧义态 W=2s-1; 读已解 WCA → 正确判歧义; 深态超时→怪物回退 t=s 上界)
    Write-Host "  → slash 最优 (inject_sq1_slash_exact.ps1)"
    pwsh (Join-Path $PkgDir 'inject_sq1_slash_exact.ps1')
    if ($LASTEXITCODE -ne 0) { throw 'inject_sq1_slash_exact.ps1 失败' }
  }
}

# ---- 3. 重算 puzzle_distribution.json ----
Step "build_puzzle_dist (stats/scramble/puzzle_distribution.json)"
if (Test-Path $ExportDate) { $env:SCRAMBLE_STATS_STAMP = (Get-Content $ExportDate -Raw).Trim() }
Push-Location $PkgDir
try {
  pnpm exec tsx src/build_puzzle_dist.ts
  if ($LASTEXITCODE -ne 0) { throw 'build_puzzle_dist 失败' }
} finally { Pop-Location }

# ---- 4. TIER C/D 离线采样分布 (stats/scramble/dist_<event>.json) ----
# 铁律(solver/NONWCA_PUZZLE_LOOP.md §0.0 #6): TIER C/D(335 等大状态长方体/扭转/滑块)分布无法整图枚举,
# 必须**离线**采样预计算成静态 JSON,页面只 fetch+渲染,严禁浏览器现场求解采样。这些 puzzle 没有 Rust
# analyzer / 真题语料,求解器是 packages/client/lib/<puzzle>-solver.ts 的纯 TS 实现; build_puzzle_sampled_dist.ts
# 直接 import 它、用它自带的 cstimer 同款随机生成器采样。每条求解 ~0.2-0.4s,N 默认几百~两千 → 单 event 几分钟。
# 新接入一个 C/D 采样分布 = 在 build_puzzle_sampled_dist.ts 的 REGISTRY 加一行 + 此处 $SAMPLED_DIST_EVENTS 加 event。
$SAMPLED_DIST_EVENTS = @('335', '336', '337', '233', '334', 'crz3a', 'mpyrso', 'dino', 'sq2', 'ssq1', 'bsq')   # 已离线采样的 TIER C/D event(随后续 wave 退役各 DistView 现场采样而增长;15p 求解器太慢未接入)
$evToBuild = if ($SampledEvents -and $SampledEvents.Count -gt 0) { $SampledEvents } else { $SAMPLED_DIST_EVENTS }
if ($evToBuild.Count -gt 0) {
  Step "build_puzzle_sampled_dist (TIER C/D 离线采样: $($evToBuild -join ', '))"
  Push-Location $PkgDir
  # crz3a/15p 的求解器 import client 端 `@/` 别名(kociemba 等),tsx 需指向 client tsconfig 才能解析;
  # 对不用别名的 event(335/336/337/233/334/mpyrso/dino)无害。mpyrso/dino 走 cstimer-vm 原生引擎(不 import client lib)。
  $prevTsconfig = $env:TSX_TSCONFIG_PATH
  $env:TSX_TSCONFIG_PATH = (Resolve-Path (Join-Path $PkgDir '..\client\tsconfig.json')).Path
  try {
    foreach ($ev in $evToBuild) {
      $sampledArgs = @('exec', 'tsx', 'src/build_puzzle_sampled_dist.ts', $ev)
      if ($SampledN -gt 0) { $sampledArgs += "$SampledN" }
      Write-Host "  [$ev] 采样求解中 (单进程, 低优先级)…" -ForegroundColor DarkGray
      pnpm @sampledArgs
      if ($LASTEXITCODE -ne 0) { throw "build_puzzle_sampled_dist 失败 (event=$ev)" }
    }
  } finally { $env:TSX_TSCONFIG_PATH = $prevTsconfig; Pop-Location }
}

Write-Host "`n完成。发布(commit stats JSON + scp static)按 MANUAL 流程另行执行。" -ForegroundColor Green
