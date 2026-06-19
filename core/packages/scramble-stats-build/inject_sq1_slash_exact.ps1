#!/usr/bin/env pwsh
# 全量产 SQ1 slash 最优(twist metric,God 13)步数 + slash 最优等价打乱。
# ── via-WCA 路径(2026-06-19 重写)──────────────────────────────────────────────
# 旧版用慢的 Sq1Solver(零盘表)直接搜 slash 最优,深态 30s 三成超时 → 大量上界回退。
# 新版把"歧义态 t 能否 = s-1"归约到已造好的 WCA 最优机器(SQ1_SLASH_VIA_WCA):
#   WCA 步数锁死 = W,只问能否用 s-1 刀达成 ⇒ 复用 IDA*+TT,且能 root-split 并行啃怪物。
#
# 省算定理:设 W=WCA 12c4 最优步数(sq1_wca_exact.csv),s=该最优解里的 / 数,t=slash 最优。
#   W==2s 或 2s+1 ⇒ t=s 已证明(95.71%,免搜索)。
#   W==2s-1       ⇒ 歧义 t∈{s-1,s}(4.29%,全 s=11/12 深态),跑 via-wca 判定。
#
# 两档(用户:普通的留着、怪物的优化):
#   Tier1(默认)  单线程 lite via-wca,RAYON 条并行,-TimeoutSecs 60。~95% 当场判定。
#   Tier2(-Split) root-split 并行 IDA*(SQ1_SOLVE_PARALLEL),单条吃满全核 + 10min 看门狗,啃 Tier1 怪物。
#
# 产物(D:/cube/scramble/puzzle/sq1/):
#   sq1_slash_ambiguous.csv  歧义态判定累积 id,slash_exact,opt_scramble(怪物 id,M)
#   sq1_slash_exact.csv      全量 id,slash_exact,opt_scramble(证明态派生 + 歧义态判定/回退)
#   sq1_slash_monsters.csv   仍未判定的怪物 id,compact(加大 -Split / 资源重跑)
#
# 用法:
#   pwsh inject_sq1_slash_exact.ps1            # Tier1 续跑歧义态 + 合并
#   pwsh inject_sq1_slash_exact.ps1 -Split     # Tier2 root-split 啃怪物(10min/条)
#   pwsh inject_sq1_slash_exact.ps1 -MergeOnly # 只合并(不解算)
[CmdletBinding()]
param(
  [int]$ChunkSize = 140,
  [int]$Threads = 14,
  [int]$TimeoutSecs = 60,
  [switch]$Split,
  [int]$SplitDepth = 2,
  [int]$SplitTimeoutSecs = 600,
  [switch]$MergeOnly
)
$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch {}
try { (Get-Process -Id $PID).PriorityClass = 'BelowNormal' } catch {}

$dir   = 'D:/cube/scramble/puzzle/sq1'
$src   = "$dir/scrambles.txt"            # id,compact(SQ1 简写记号,无逗号)
$wca   = "$dir/sq1_wca_exact.csv"        # id,wca_exact,opt_scramble
$out   = "$dir/sq1_slash_ambiguous.csv"  # 歧义态判定累积
$final = "$dir/sq1_slash_exact.csv"      # 全量产物
$monf  = "$dir/sq1_slash_monsters.csv"
$work  = "$dir/_slash_chunks"
$logf  = "$dir/_slash_run.err"
$exe   = 'D:/cube/cuberoot.me/solver/target/release/sq1_analyzer.exe'
# 历史/外部已解来源(一次性 ingest 作种子,只读不删):
$seedSources = @("$dir/_xval_resolved.csv", "$dir/_tier1")

$env:SQ1_SLASH_VIA_WCA = '1'
$env:RAYON_NUM_THREADS = "$Threads"

New-Item -ItemType Directory -Force $work | Out-Null
if (-not (Test-Path $exe)) { throw "analyzer 不存在: $exe(先 cargo build --release --bin sq1_analyzer)" }
if (-not (Test-Path $wca)) { throw "WCA 精确不存在: $wca(先跑 inject_sq1_wca_exact.ps1)" }
if (-not (Test-Path $src)) { throw "语料不存在: $src" }

$HEADER = 'id,slash_exact,opt_scramble'

# ---- 读 WCA 精确 → wcaMap{W,s,opt} + 歧义 id ----
function Count-Slashes([string]$s) { return $s.Length - $s.Replace('/','').Length }
Write-Host "读 $wca …"
$wcaMap = @{}
$ambIds = [Collections.Generic.HashSet[string]]::new()
$first = $true
foreach ($l in [IO.File]::ReadLines($wca)) {
  if ($first) { $first = $false; continue }
  if (-not $l) { continue }
  $c = $l.Split(',')
  if ($c.Length -lt 3) { continue }
  $id = $c[0]
  if ($c[1] -eq 'M' -or $c[1] -eq '-') { continue }
  $W = [int]$c[1]; $opt = $c[2]; $s = Count-Slashes $opt
  $wcaMap[$id] = @{ W = $W; s = $s; opt = $opt }
  if ($W -eq 2*$s - 1) { [void]$ambIds.Add($id) }
}
Write-Host "  WCA 行 $($wcaMap.Count);歧义态(W=2s-1)$($ambIds.Count)"

# ---- 读 compact 打乱(id -> compact)----
$compact = @{}
foreach ($l in [IO.File]::ReadLines($src)) {
  if (-not $l) { continue }
  $i = $l.IndexOf(','); if ($i -le 0) { continue }
  $compact[$l.Substring(0,$i)] = $l.Substring($i+1)
}

# ---- 已解 map:id -> @{v; opt}(数值优先 M;多数值取最小 t)----
$resolved = @{}
function Add-Resolved([string]$id, [string]$v, [string]$opt) {
  if (-not $ambIds.Contains($id)) { return }   # 只收歧义态
  $bad = ($v -eq 'M' -or $v -eq '' -or $v -eq '-')
  if (-not $resolved.ContainsKey($id)) { $resolved[$id] = @{ v = $v; opt = $opt }; return }
  $cur = $resolved[$id]
  $curBad = ($cur.v -eq 'M' -or $cur.v -eq '' -or $cur.v -eq '-')
  if ($curBad -and -not $bad) { $resolved[$id] = @{ v = $v; opt = $opt } }
  elseif (-not $curBad -and -not $bad -and [int]$v -lt [int]$cur.v) { $resolved[$id] = @{ v = $v; opt = $opt } }
}
function Ingest-File([string]$path) {
  if (-not (Test-Path $path)) { return }
  $f = $true
  foreach ($l in [IO.File]::ReadLines($path)) {
    if (-not $l) { continue }
    if ($f -and $l.StartsWith('id,')) { $f = $false; continue }
    $f = $false
    $c = $l.Split(',')
    if ($c.Length -lt 2) { continue }
    $opt = if ($c.Length -ge 3) { $c[2] } else { '' }
    Add-Resolved $c[0] $c[1] $opt
  }
}
function Ingest-Dir([string]$d) {
  if (-not (Test-Path $d)) { return }
  Get-ChildItem $d -Filter '*_sq1.csv' -ErrorAction SilentlyContinue | Sort-Object Name | ForEach-Object { Ingest-File $_.FullName }
}

# ingest 顺序:out(权威累积)→ 种子(_xval/_tier1)→ work chunks
Ingest-File $out
foreach ($s in $seedSources) {
  if (Test-Path $s) {
    if ((Get-Item $s).PSIsContainer) { Ingest-Dir $s } else { Ingest-File $s }
  }
}
Ingest-Dir $work
Get-ChildItem $work -Filter '*_sq1.csv' -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue

# ---- 重写 out(规范化:每歧义 id 一行最优)----
function Write-Out {
  $sw = New-Object IO.StreamWriter($out, $false, [Text.UTF8Encoding]::new($false))
  try {
    $sw.Write($HEADER); $sw.Write("`n")
    foreach ($id in $resolved.Keys) {
      $r = $resolved[$id]
      $sw.Write("$id,$($r.v),$($r.opt)"); $sw.Write("`n")
    }
  } finally { $sw.Close() }
}
Write-Out

# ---- Build-Final:证明态派生 + 歧义态判定/回退 → 全量 ----
function Build-Final {
  $sw = New-Object IO.StreamWriter($final, $false, [Text.UTF8Encoding]::new($false))
  $nProv=0;$nEq=0;$nLess=0;$nFallback=0
  try {
    $sw.Write($HEADER); $sw.Write("`n")
    foreach ($id in $wcaMap.Keys) {
      $e = $wcaMap[$id]
      if ($ambIds.Contains($id)) {
        $r = $resolved[$id]
        $bad = (-not $r) -or ($r.v -eq 'M') -or ($r.v -eq '') -or ($r.v -eq '-')
        if (-not $bad) {
          $t = [int]$r.v
          if ($t -lt $e.s -and $r.opt -ne '') {
            $sw.Write("$id,$t,$($r.opt)"); $sw.Write("`n"); $nLess++       # SmallerExists:真省刀,用 slash 解逆
          } else {
            $sw.Write("$id,$t,$($e.opt)"); $sw.Write("`n"); $nEq++         # ProvenEqual:t=s,用 WCA 最优打乱
          }
        } else {
          $sw.Write("$id,$($e.s),$($e.opt)"); $sw.Write("`n"); $nFallback++  # 怪物回退上界 t=s
        }
      } else {
        $sw.Write("$id,$($e.s),$($e.opt)"); $sw.Write("`n"); $nProv++       # 证明态 t=s
      }
    }
  } finally { $sw.Close() }
  $tot = $nProv+$nEq+$nLess+$nFallback
  Write-Host "合并 -> $final"
  Write-Host "  全量 ${tot}: 证明态 $nProv;歧义 t=s $nEq;歧义 t=s-1(真省刀)$nLess;回退上界(怪物)$nFallback"
  if ($nFallback) { Write-Host "  残留怪物 $nFallback 条(slash_exact 为紧上界),跑 -Split 续解" }
  # meta:前端/build 数据驱动 provisional(残留怪物>0 ⇒ slash 视图仍标"上界、计算中")。
  $meta = @{ ambiguous = $ambIds.Count; eq = $nEq; less = $nLess; fallback = $nFallback; provisional = ($nFallback -gt 0) }
  [IO.File]::WriteAllText("$dir/sq1_slash_meta.json", ($meta | ConvertTo-Json -Compress))
  return $nFallback
}

if ($MergeOnly) { Build-Final | Out-Null; exit 0 }

# ---- 待解 ----
$todo = [Collections.Generic.List[string]]::new()
if ($Split) {
  foreach ($id in $ambIds) {
    $r = $resolved[$id]
    $isMon = (-not $r) -or ($r.v -eq 'M') -or ($r.v -eq '') -or ($r.v -eq '-')
    if ($isMon -and $compact.ContainsKey($id)) { [void]$todo.Add("$id,$($compact[$id]),$($wcaMap[$id].W)") }
  }
  Write-Host "Tier2(root-split,$SplitDepth 层,${SplitTimeoutSecs}s/条):怪物待解 $($todo.Count)"
} else {
  foreach ($id in $ambIds) {
    if (-not $resolved.ContainsKey($id) -and $compact.ContainsKey($id)) { [void]$todo.Add("$id,$($compact[$id]),$($wcaMap[$id].W)") }
  }
  Write-Host "Tier1(lite,${TimeoutSecs}s/条):新待解 $($todo.Count)(已解 $($resolved.Count)/$($ambIds.Count))"
}
if ($todo.Count -eq 0) { Write-Host '无待解,直接合并。'; Build-Final | Out-Null; exit 0 }

# ---- 写 chunk(id,compact,W)----
Get-ChildItem $work -Filter 'chunk_*.txt' -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
$cs = if ($Split) { 1 } else { $ChunkSize }
$chunkPaths = [Collections.Generic.List[string]]::new()
for ($i = 0; $i -lt $todo.Count; $i += $cs) {
  $n = [Math]::Min($cs, $todo.Count - $i)
  $p = Join-Path $work ("chunk_{0:D5}.txt" -f ($i / $cs))
  [IO.File]::WriteAllLines($p, $todo.GetRange($i, $n))
  [void]$chunkPaths.Add($p)
}
$to = if ($Split) { $SplitTimeoutSecs } else { $TimeoutSecs }
Write-Host "分 $($chunkPaths.Count) 块(每块 $cs),超时 ${to}s/条,日志 -> $logf"

# ---- 进度 + env ----
$progf = "$dir/_slash_progress.log"
Set-Content -Path $progf -Value '' -NoNewline
$env:ANALYZER_PROGRESS_FILE  = $progf
$env:ANALYZER_PROGRESS_EVERY = if ($Split) { '1' } else { '20' }
$env:ANALYZER_PROGRESS_TOTAL = "$($todo.Count)"
$env:ANALYZER_PROGRESS_BASE  = '0'
$env:SQ1_SOLVE_TIMEOUT_SECS  = "$to"
$env:ANALYZER_STUCK_SECS     = "$([Math]::Max(120, $to + 120))"
if ($Split) { $env:SQ1_SOLVE_PARALLEL = "$SplitDepth" }

# ---- 一次喂全部 chunk 文件名 + exit(单进程,轻量表只建一次)----
$stdin = ($chunkPaths -join "`n") + "`nexit`n"
$stdin | & $exe 2> $logf
$code = $LASTEXITCODE

# ---- ingest 新结果 + 重写 out ----
Ingest-Dir $work
Get-ChildItem $work -Filter '*_sq1.csv' -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
Write-Out

# ---- 怪物清单 ----
$monLines = [Collections.Generic.List[string]]::new()
foreach ($id in $ambIds) {
  $r = $resolved[$id]
  if (((-not $r) -or ($r.v -eq 'M') -or ($r.v -eq '') -or ($r.v -eq '-')) -and $compact.ContainsKey($id)) { [void]$monLines.Add("$id,$($compact[$id])") }
}
if ($monLines.Count -gt 0) { [IO.File]::WriteAllLines($monf, $monLines); Write-Host "怪物 $($monLines.Count) -> $monf" }

if ($code -ne 0) { throw "analyzer 退出码 $code(已并入完成块,可重跑续解剩余)" }
Build-Final | Out-Null
