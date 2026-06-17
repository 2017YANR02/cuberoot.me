#!/usr/bin/env pwsh
# 全量灌注 SQ1 WCA 12c4 **精确**步数(可证最优;Sq1WcaSolver + 13GB jsq_full 表)。
#
# 与近最优管道解耦(**保留** sq1.csv 不动):本脚本只产独立 sq1_wca_exact.csv(2 列 id,wca_exact)。
# build_puzzle_dist.ts 的 sq1.exact 档读它,前端可切「精确 / 近最优」。
#
# 设计要点(14h 级长跑必须扛崩):
#   - **单次载表**:把所有 chunk 文件名一次喂给 analyzer 的 stdin 循环 → 13GB 表只载一次(~75s),逐块解算。
#   - **分块逐块写盘**:每块 analyzer 跑完即 flush <chunk>_sq1.csv(崩了已完成块不丢)。
#   - **可续**:重启先把残留 chunk CSV 并入 out + 按 id 跳过已完成,只解剩余。
#   - **进度**:analyzer 每块打 [PROG]/[DONE] 到 stderr 日志;外部挂 Monitor tail 该日志即可。
#   - BelowNormal 低优先级 + 线程默认 12(用户规则)。
#
# 用法:
#   pwsh inject_sq1_wca_exact.ps1                  # 全量(续跑)
#   pwsh inject_sq1_wca_exact.ps1 -ChunkSize 5000  # 调块大小
#   pwsh inject_sq1_wca_exact.ps1 -BuildOnly       # 只把 chunk CSV 并入 out(不解算)
[CmdletBinding()]
param(
  [int]$ChunkSize = 2000,
  [int]$Threads = 12,
  [switch]$BuildOnly
)
$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch {}
try { (Get-Process -Id $PID).PriorityClass = 'BelowNormal' } catch {}

$dir   = 'D:/cube/scramble/puzzle/sq1'
$src   = "$dir/scrambles.txt"          # id,scramble(近最优管道已增量抽好的全语料)
$out   = "$dir/sq1_wca_exact.csv"      # 产物:id,wca_exact
$work  = "$dir/_exact_chunks"
$logf  = "$dir/_exact_run.err"
$exe   = 'D:/cube/cuberoot.me/solver/target/release/sq1_analyzer.exe'

$env:CUBE_TABLE_DIR  = 'D:/cube/cuberoot.me/solver/tables'
$env:SQ1_WCA_EXACT   = '1'
$env:SQ1_WCA_SOLN    = '1'   # 多出第 3 列 opt_scramble(最优等价打乱),供网站「原始/最优」+ 示例
$env:RAYON_NUM_THREADS = "$Threads"

New-Item -ItemType Directory -Force $work | Out-Null
if (-not (Test-Path $exe)) { throw "analyzer 不存在: $exe(先 cargo build --release --bin sq1_analyzer)" }
if (-not (Test-Path $src)) { throw "语料不存在: $src(先跑 update_puzzle_stats.ps1 -Puzzles sq1 抽语料)" }

# header(out 不存在/空时写)
$HEADER = 'id,wca_exact,opt_scramble'

# ---- 把残留 chunk CSV 并入 out(可续:上次崩在并入前)----
function Ingest-Chunks {
  $chunks = Get-ChildItem $work -Filter '*_sq1.csv' -ErrorAction SilentlyContinue | Sort-Object Name
  if (-not $chunks) { return 0 }
  $withHeader = (-not (Test-Path $out)) -or ((Get-Item $out).Length -eq 0)
  # LF 安全追加
  $needNL = $false
  if ((Test-Path $out) -and ((Get-Item $out).Length -gt 0)) {
    $fs = [IO.File]::Open($out,'Open','ReadWrite'); [void]$fs.Seek(-1,'End'); $needNL = ($fs.ReadByte() -ne 10); $fs.Close()
  }
  $sw = New-Object IO.StreamWriter($out, $true, [Text.UTF8Encoding]::new($false))
  $added = 0
  try {
    if ($withHeader) { $sw.Write($HEADER); $sw.Write("`n") }
    elseif ($needNL) { $sw.Write("`n") }
    foreach ($c in $chunks) {
      $i = 0
      foreach ($line in [IO.File]::ReadLines($c.FullName)) {
        if ($i -eq 0) { $i++; continue }     # 跳每块表头
        if (-not $line) { continue }
        $sw.Write($line); $sw.Write("`n"); $added++
      }
    }
  } finally { $sw.Close() }
  foreach ($c in $chunks) { Remove-Item $c.FullName -Force }
  Write-Host "  并入 $added 行(来自 $($chunks.Count) 块)-> $out"
  return $added
}

Ingest-Chunks | Out-Null
if ($BuildOnly) { Write-Host '仅并入,完成。'; exit 0 }

# ---- 已完成 id(out 首列)----
$done = [Collections.Generic.HashSet[string]]::new()
if (Test-Path $out) {
  $first = $true
  foreach ($l in [IO.File]::ReadLines($out)) {
    if ($first) { $first = $false; continue }
    if (-not $l) { continue }
    $i = $l.IndexOf(','); if ($i -gt 0) { [void]$done.Add($l.Substring(0,$i)) }
  }
}

# ---- 待解 = src - done ----
$total = 0
$todo  = [Collections.Generic.List[string]]::new()
foreach ($l in [IO.File]::ReadLines($src)) {
  if (-not $l) { continue }
  $total++
  $i = $l.IndexOf(','); if ($i -gt 0 -and -not $done.Contains($l.Substring(0,$i))) { [void]$todo.Add($l) }
}
Write-Host "语料 $total 条;已完成 $($done.Count);待解 $($todo.Count)"
if ($todo.Count -eq 0) { Write-Host '全部已完成。'; exit 0 }

# ---- 写 chunk 文件 ----
Get-ChildItem $work -Filter 'chunk_*.txt' -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
$chunkPaths = [Collections.Generic.List[string]]::new()
for ($i = 0; $i -lt $todo.Count; $i += $ChunkSize) {
  $n = [Math]::Min($ChunkSize, $todo.Count - $i)
  $name = "chunk_{0:D5}.txt" -f ($i / $ChunkSize)
  $p = Join-Path $work $name
  [IO.File]::WriteAllLines($p, $todo.GetRange($i, $n))
  [void]$chunkPaths.Add($p)
}
Write-Host "分 $($chunkPaths.Count) 块(每块 $ChunkSize)。单次载表逐块解算,日志 -> $logf"

# ---- 一次喂全部 chunk 文件名 + exit 给 analyzer(单进程单次载表)----
$stdin = ($chunkPaths -join "`n") + "`nexit`n"
$stdin | & $exe 2> $logf
$code = $LASTEXITCODE

# ---- 并入本轮 chunk 输出 ----
Ingest-Chunks | Out-Null

if ($code -ne 0) { throw "analyzer 退出码 $code(已并入完成块,可重跑本脚本续解剩余)" }

# ---- 校验:out 行数(去表头)应 == 语料(无解析失败行)----
$outRows = 0; foreach ($l in [IO.File]::ReadLines($out)) { $outRows++ }
$outRows = $outRows - 1
$bad = 0
foreach ($l in [IO.File]::ReadLines($out)) { if ($l -match ',-\s*$') { $bad++ } }
Write-Host "完成:out $outRows 行 / 语料 $total$(if($bad){" ;⚠ $bad 行解析失败(id,-)"})"
if ($outRows -lt $total) { Write-Host "  仍差 $($total - $outRows) 条,重跑本脚本续解。" }
