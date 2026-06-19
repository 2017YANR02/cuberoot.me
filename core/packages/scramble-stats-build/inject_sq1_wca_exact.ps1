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
  [int]$ChunkSize = 500,
  [int]$Threads = 12,
  [switch]$BuildOnly
)
$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch {}
try { (Get-Process -Id $PID).PriorityClass = 'BelowNormal' } catch {}

$dir   = 'D:/cube/scramble/puzzle/sq1'
$src   = "$dir/scrambles.txt"          # id,scramble(近最优管道已增量抽好的全语料)
$out   = "$dir/sq1_wca_exact.csv"      # 产物:id,wca_exact(怪物行 = id,M 占位)
$monf  = "$dir/sq1_wca_monsters.csv"   # 怪物清单:id,scramble(超时跳过的深尾,后续大 TT 单独跑)
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

# ---- 怪物回捞:out 里 wca_exact 列 == 'M' 的(超时跳过)→ 从 src 取原始打乱追加进 $monf(幂等去重)----
# 怪物已在 out 标记已处理(续跑跳过、build 侧 NaN 略过);此处只是给后续单独跑攒一份 id,scramble 清单。
function Update-Monsters {
  if (-not (Test-Path $out)) { return }
  $monIds = [Collections.Generic.HashSet[string]]::new()
  $first = $true
  foreach ($l in [IO.File]::ReadLines($out)) {
    if ($first) { $first = $false; continue }
    if (-not $l) { continue }
    $c = $l.Split(',')
    if ($c.Length -ge 2 -and $c[1] -eq 'M') { [void]$monIds.Add($c[0]) }
  }
  if ($monIds.Count -eq 0) { return }
  $have = [Collections.Generic.HashSet[string]]::new()
  if (Test-Path $monf) {
    foreach ($l in [IO.File]::ReadLines($monf)) {
      if (-not $l) { continue }
      $i = $l.IndexOf(','); if ($i -gt 0) { [void]$have.Add($l.Substring(0,$i)) }
    }
  }
  $want = [Collections.Generic.HashSet[string]]::new()
  foreach ($x in $monIds) { if (-not $have.Contains($x)) { [void]$want.Add($x) } }
  if ($want.Count -eq 0) { return }
  $sw = New-Object IO.StreamWriter($monf, $true, [Text.UTF8Encoding]::new($false))
  $added = 0
  try {
    foreach ($l in [IO.File]::ReadLines($src)) {
      if (-not $l) { continue }
      $i = $l.IndexOf(','); if ($i -le 0) { continue }
      if ($want.Contains($l.Substring(0,$i))) { $sw.Write($l); $sw.Write("`n"); $added++ }
    }
  } finally { $sw.Close() }
  Write-Host "  怪物清单 +$added -> $monf(累计 $($have.Count + $added))"
}

Ingest-Chunks | Out-Null
Update-Monsters
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

# 全局实时进度:analyzer 每 10 条往**专用进度文件**直写(自己 flush,绕过 PowerShell `2>` 缓冲)
# [PROG] (已完成base+本进程累计)/总数 + 每块 [DONE](含块名)。**实时看**:
#   Get-Content D:/cube/scramble/puzzle/sq1/_exact_progress.log -Wait -Tail 20
$progf = "$dir/_exact_progress.log"
Set-Content -Path $progf -Value '' -NoNewline   # 每次开跑清空,避免混入上次的 base
$env:ANALYZER_PROGRESS_FILE  = $progf
$env:ANALYZER_PROGRESS_EVERY = '10'
$env:ANALYZER_PROGRESS_TOTAL = "$total"
$env:ANALYZER_PROGRESS_BASE  = "$($done.Count)"
# 怪物超时:单条 solve >60s 判怪物 → 放弃 + 输出 id,M(标记已处理 ⇒ 续跑跳过、build 侧 NaN 自动略过)
# + 实时 [MONSTER] 报具体打乱。怪物(actual 24-25 深尾)回捞进 $monf,后续大 SQ1_TT_BUDGET 单独跑(仍可证最优)。
$env:SQ1_SOLVE_TIMEOUT_SECS  = '60'
# 看门狗当**安全网**:阈值 > 超时 ⇒ 正常怪物 60s 已被跳过、看门狗不响;若它响(>120s 仍在算)=
# 超时机制有路径没覆盖到(真 hang),立即暴露具体打乱。正常跑应永远只见 [MONSTER]、不见 [STUCK]。
$env:ANALYZER_STUCK_SECS     = '120'

# ---- 一次喂全部 chunk 文件名 + exit 给 analyzer(单进程单次载表)----
$stdin = ($chunkPaths -join "`n") + "`nexit`n"
$stdin | & $exe 2> $logf
$code = $LASTEXITCODE

# ---- 并入本轮 chunk 输出 + 回捞怪物 ----
Ingest-Chunks | Out-Null
Update-Monsters

if ($code -ne 0) { throw "analyzer 退出码 $code(已并入完成块,可重跑本脚本续解剩余)" }

# ---- 校验:out 行数(去表头)应 == 语料;怪物 id,M 算已处理,解析失败才是 id,-。----
$outRows = 0; $mon = 0
foreach ($l in [IO.File]::ReadLines($out)) {
  $outRows++
  $c = $l.Split(','); if ($c.Length -ge 2 -and $c[1] -eq 'M') { $mon++ }
}
$outRows = $outRows - 1
$bad = 0
foreach ($l in [IO.File]::ReadLines($out)) { if ($l -match ',-\s*$') { $bad++ } }
Write-Host "完成:out $outRows 行 / 语料 $total$(if($mon){" ;$mon 怪物(id,M)留 $monf 待单独跑"})$(if($bad){" ;⚠ $bad 行解析失败(id,-)"})"
if ($outRows -lt $total) { Write-Host "  仍差 $($total - $outRows) 条,重跑本脚本续解。" }
