#!/usr/bin/env pwsh
# 非 3x3 puzzle 整解最优步数分布 手动增量管道 (EPIC 3 新管线; 2x2x2 pocket 先行, 后续 puzzle 注册即用)
#
# 一键:        pwsh update_puzzle_stats.ps1                     (全部已注册 puzzle, 增量补满)
# 小样本验形:  pwsh update_puzzle_stats.ps1 -MaxNew 300         (只取 300 条新打乱, 跑通全链验 JSON 形状)
# 选 puzzle:   pwsh update_puzzle_stats.ps1 -Puzzles pocket
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
  [switch]$BuildOnly       # 跳过取数/解算, 直接用现有 CSV 重算 JSON
)
$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

# 算力限额(全局规则: 重计算 ≤14 线程, 低优先级); 调用方可预设 RAYON_NUM_THREADS 覆盖(内存紧用 8)
if (-not $env:RAYON_NUM_THREADS) { $env:RAYON_NUM_THREADS = '14' }
try { (Get-Process -Id $PID).PriorityClass = 'BelowNormal' } catch {}

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
$PUZZLE = @{
  pocket   = @{ event = '222';   exe = 'pocket_analyzer.exe' }
  pyraminx = @{ event = 'pyram'; exe = 'pyraminx_analyzer.exe' }
}

if (-not $Puzzles -or $Puzzles.Count -eq 0) { $Puzzles = @($PUZZLE.Keys | Sort-Object) }

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
  foreach ($name in $Puzzles) {
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
      $withHeader = -not (Test-Path $csv)
      Append-Lines $csv $chunkOut (-not $withHeader)
      Write-Host "  块 @$i +$n -> $csv"
    }
    foreach ($f in @($chunkIn, $chunkOut)) { if (Test-Path $f) { Remove-Item $f -Force } }
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

Write-Host "`n完成。发布(commit stats JSON + scp static)按 MANUAL 流程另行执行。" -ForegroundColor Green
