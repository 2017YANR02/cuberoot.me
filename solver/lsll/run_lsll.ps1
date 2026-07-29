<#
.SYNOPSIS
  LSLL 批量求解的一键入口:开跑 / 看进度 / 停 / 合并。

.DESCRIPTION
  默认单进程 + h9 大表(15.6G),与手跑 `node solve_loop.mjs` 等价,只是顺手压低了优先级、
  接上了日志、并且 `-Status` 能立刻告诉你到哪儿了。

  `-Procs N` 开 N 个进程分片并跑。分片各写各的 out,互不抢文件,最后 `-Merge` 并进 out.csv。
  2026-07-28 实测(本机 16 逻辑核 / 31.8G):

      1 进程 × 12 线程 · h9(15.0G)  1.35 case/s      ← 默认
      4 进程 ×  3 线程 · h6( 7.8G)  4.90 case/s  3.6×
      7 进程 ×  2 线程 · h6(13.6G)  7.04 case/s  5.2×  ← 579,368 个约 23 小时

  为什么单进程吃不满 CPU:LSLL 局面只有 12~14 步,一次求解 44ms 就结束,12 个线程来不及铺开,
  实测系统总 CPU 只到 30%。把核分给几个**互相独立**的搜索,利用率才上得来。

  **换表不改答案** —— h5/h6/h9 都是可采纳剪枝表,htm 是同一个最优值;变的只是并列最优解里
  吐出哪一条(out.csv 的 solution 列),灌库时 sha 行清单会多几行 diff,仅此而已。

.EXAMPLE
  pwsh run_lsll.ps1                      # 默认:1 进程 × 12 线程 + h9 大表
  pwsh run_lsll.ps1 -Procs 7 -Threads 2 -Table h6   # 5.2× 那套
  pwsh run_lsll.ps1 -Status              # 到哪儿了(随时可跑,不打扰求解)
  pwsh run_lsll.ps1 -Stop                # 停(每个 case 即落盘,随停随续)
  pwsh run_lsll.ps1 -Merge               # 分片结果并进 out.csv(灌库前跑一次)
#>
[CmdletBinding(DefaultParameterSetName = 'Run')]
param(
  [Parameter(ParameterSetName = 'Run')][int]$Procs = 1,
  [Parameter(ParameterSetName = 'Run')][int]$Threads = 12,
  [Parameter(ParameterSetName = 'Run')][ValidateSet('h5', 'h6', 'h9')][string]$Table = 'h9',
  [Parameter(ParameterSetName = 'Status')][switch]$Status,
  [Parameter(ParameterSetName = 'Stop')][switch]$Stop,
  [Parameter(ParameterSetName = 'Merge')][switch]$Merge
)

$ErrorActionPreference = 'Stop'
$Here     = $PSScriptRoot
$RepoRoot = Resolve-Path (Join-Path $Here '..' '..')
$Corpus   = Join-Path $Here 'corpus.txt'
$Out      = Join-Path $Here 'out.csv'
$ShardDir = Join-Path $Here 'shards'

# 一行的 key = 第一个逗号之前那段。语料和结果同一套 key 空间,所以用同一个取法。
function Get-Key([string]$line) {
  $i = $line.IndexOf(',')
  if ($i -lt 1) { return $null }
  return $line.Substring(0, $i)
}

# 大文件不走 Get-Content(579,368 行会慢到没法看),一律 StreamReader。
function Read-Keys([string]$path, [System.Collections.Generic.HashSet[string]]$into) {
  if (-not (Test-Path $path)) { return 0 }
  $n = 0
  $r = [System.IO.StreamReader]::new($path)
  try {
    while ($null -ne ($l = $r.ReadLine())) {
      $k = Get-Key $l
      if ($k) { [void]$into.Add($k); $n++ }
    }
  } finally { $r.Dispose() }
  return $n
}

function Get-ShardOuts { if (Test-Path $ShardDir) { Get-ChildItem $ShardDir -Filter 'out_*.csv' } else { @() } }

function Get-Running {
  Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" |
    Where-Object { $_.CommandLine -and $_.CommandLine -match 'solve_loop\.mjs' }
}

# ── -Stop ────────────────────────────────────────────────────────────────────
if ($Stop) {
  $procs = @(Get-Running)
  if (-not $procs) { Write-Host '没有在跑的求解进程。'; return }
  # 先杀外壳再杀子进程,否则外壳会立刻把子进程重新拉起来
  foreach ($p in $procs) { Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue }
  Start-Sleep -Milliseconds 300
  Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" |
    Where-Object { $_.CommandLine -and $_.CommandLine -match 'solve\.mjs' } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
  Write-Host "已停 $($procs.Count) 个分片。每个 case 都已落盘,重跑同一条命令按 key 续上。"
  return
}

# ── -Status ──────────────────────────────────────────────────────────────────
if ($Status) {
  $total = 0
  $r = [System.IO.StreamReader]::new($Corpus)
  try { while ($null -ne $r.ReadLine()) { $total++ } } finally { $r.Dispose() }

  $done = [System.Collections.Generic.HashSet[string]]::new()
  [void](Read-Keys $Out $done)
  $inMain = $done.Count
  foreach ($f in Get-ShardOuts) { [void](Read-Keys $f.FullName $done) }
  $n = $done.Count

  $live = @(Get-Running)
  Write-Host ("{0} / {1} = {2:P2}   (out.csv {3} · 分片 {4})" -f $n, $total, ($n / $total), $inMain, ($n - $inMain))
  if ($live) {
    # 采样 20 秒算真实速率 —— 比日志里那个 1% 一行的里程碑及时得多
    $t0 = Get-Date
    Start-Sleep -Seconds 20
    $d2 = [System.Collections.Generic.HashSet[string]]::new()
    [void](Read-Keys $Out $d2)
    foreach ($f in Get-ShardOuts) { [void](Read-Keys $f.FullName $d2) }
    $rate = ($d2.Count - $n) / ((Get-Date) - $t0).TotalSeconds
    if ($rate -gt 0) {
      $eta = ($total - $d2.Count) / $rate
      Write-Host ("{0} 个分片在跑 · {1:N2} case/s · 剩 {2:N1} 小时" -f $live.Count, $rate, ($eta / 3600))
    } else {
      Write-Host "$($live.Count) 个分片在跑,但 20 秒内没有新行 —— 多半正在载表(h9 约 30s)。"
    }
  } else {
    Write-Host '没有在跑的分片。'
    if ($n -ge $total) { Write-Host '全部算完了 —— 跑 -Merge 合并,然后 update_lsll.ps1 -Ingest 灌库。' }
  }
  return
}

# ── -Merge ───────────────────────────────────────────────────────────────────
# 幂等:按 key 去重,out.csv 里已有的优先。分片文件不删,再跑一次还是同样的结果。
if ($Merge) {
  $shards = @(Get-ShardOuts)
  if (-not $shards) { Write-Host '没有分片结果可合并。'; return }
  $seen = [System.Collections.Generic.HashSet[string]]::new()
  [void](Read-Keys $Out $seen)
  $before = $seen.Count
  $w = [System.IO.StreamWriter]::new($Out, $true)   # append
  try {
    foreach ($f in $shards) {
      $r = [System.IO.StreamReader]::new($f.FullName)
      try {
        while ($null -ne ($l = $r.ReadLine())) {
          $k = Get-Key $l
          if ($k -and $seen.Add($k)) { $w.WriteLine($l) }
        }
      } finally { $r.Dispose() }
    }
  } finally { $w.Dispose() }
  Write-Host ("out.csv {0} → {1}(并进 {2} 行,来自 {3} 个分片)" -f $before, $seen.Count, ($seen.Count - $before), $shards.Count)
  return
}

# ── 开跑 ─────────────────────────────────────────────────────────────────────
if (-not (Test-Path $Corpus)) {
  Write-Error "语料不存在:$Corpus`n先生成:cd $RepoRoot\core; `$env:NODE_OPTIONS='--no-experimental-strip-types'; pnpm --filter @cuberoot/client exec tsx scripts/lsll-corpus.mts"
}
if (Get-Running) { Write-Error '已经有分片在跑了。先 -Stop,或者 -Status 看进度。' }

$TableFile = Join-Path $RepoRoot "solver\tables\h48\h48prun31$Table.dat"
$Module    = Join-Path $RepoRoot "core\packages\client\public\cubeopt\cube48opt$($Table.Substring(1)).mjs"
foreach ($f in @($TableFile, $Module)) { if (-not (Test-Path $f)) { Write-Error "找不到 $f" } }

# 本机规矩:重计算最多 14 线程,不吃满核。
$totalThreads = $Procs * $Threads
if ($totalThreads -gt 14) { Write-Error "总线程 $totalThreads 超过 14(Procs × Threads),调小再来。" }

# 每个进程都要**完整一份**表(in-proc 共享只在进程内部);挤不下就会换页到磁盘,比小表慢得多。
$tableGB = (Get-Item $TableFile).Length / 1GB
$needGB  = $tableGB * $Procs
$freeGB  = (Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory / 1MB
Write-Host ("表 {0} · {1:N1}G × {2} 进程 = {3:N1}G,空闲 {4:N1}G" -f (Split-Path $TableFile -Leaf), $tableGB, $Procs, $needGB, $freeGB)
if ($needGB -gt $freeGB - 1) {
  Write-Error "内存不够(要 $([math]::Round($needGB,1))G,空闲 $([math]::Round($freeGB,1))G)。换页到磁盘会慢一个量级 —— 先腾内存,或者减少 -Procs。"
}

New-Item -ItemType Directory -Force -Path $ShardDir | Out-Null

# 已完成 = out.csv ∪ 所有分片 out。分片语料只装没算过的,所以重跑本脚本天然就是续跑。
$done = [System.Collections.Generic.HashSet[string]]::new()
[void](Read-Keys $Out $done)
foreach ($f in Get-ShardOuts) { [void](Read-Keys $f.FullName $done) }

# 轮转分片:相邻行难度相近,轮转发牌比切成连续块更能让几个分片同时收工。
$writers = @()
for ($i = 0; $i -lt $Procs; $i++) {
  $writers += [System.IO.StreamWriter]::new((Join-Path $ShardDir "corpus_$i.txt"), $false)
}
$todo = 0; $total = 0
$r = [System.IO.StreamReader]::new($Corpus)
try {
  while ($null -ne ($l = $r.ReadLine())) {
    $k = Get-Key $l
    if (-not $k) { continue }
    $total++
    if ($done.Contains($k)) { continue }
    $writers[$todo % $Procs].WriteLine($l)
    $todo++
  }
} finally {
  $r.Dispose()
  foreach ($w in $writers) { $w.Dispose() }
}

if ($todo -eq 0) {
  Write-Host "全部 $total 个 case 都算完了 —— 跑 -Merge 合并,然后 update_lsll.ps1 -Ingest 灌库。"
  return
}
Write-Host ("待解 {0} / {1}(已完成 {2})" -f $todo, $total, $done.Count)

for ($i = 0; $i -lt $Procs; $i++) {
  $env:CORPUS = Join-Path $ShardDir "corpus_$i.txt"
  $env:OUT    = Join-Path $ShardDir "out_$i.csv"
  $env:MODULE = $Module
  $env:TABLE  = $TableFile
  $env:THREADS = $Threads
  $p = Start-Process node -ArgumentList 'solve_loop.mjs' -WorkingDirectory $Here `
    -RedirectStandardOutput (Join-Path $ShardDir "log_$i.txt") `
    -RedirectStandardError  (Join-Path $ShardDir "err_$i.txt") `
    -NoNewWindow -PassThru
  # 长跑压低优先级,别抢你正常用电脑的那份。Start-Process 没有 -PriorityClass,只能拿到对象再设。
  $p.PriorityClass = 'BelowNormal'
}
Remove-Item Env:CORPUS, Env:OUT, Env:MODULE, Env:TABLE, Env:THREADS

Write-Host ""
Write-Host "$Procs 个分片已启动($Threads 线程/个,BelowNormal)。"
Write-Host "  看进度   pwsh $PSCommandPath -Status"
Write-Host "  停下来   pwsh $PSCommandPath -Stop"
Write-Host "  算完之后 pwsh $PSCommandPath -Merge   然后  pwsh update_lsll.ps1 -Ingest"
