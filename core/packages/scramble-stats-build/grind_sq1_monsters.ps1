#!/usr/bin/env pwsh
# 专啃 SQ1 怪物清单 → 算出可证 WCA 12c4 **最优**,合并回主 CSV。
#
# 背景:全量灌注(inject_sq1_wca_exact.ps1)对单条 solve >60s 的深尾(actual 24-25)超时跳过、
# 记 id,M + 回捞进 sq1_wca_monsters.csv。本脚本拿那份清单,**关超时**(必出最优)+ 少线程
# (每条独占更多全局 TT ⇒ 剪枝更狠,复刻 217111 单线程 125M TT 成功的条件)死磕,解完把
# sq1_wca_exact.csv 里对应的 `id,M` 行**原地替换**成 `id,wca_exact,opt_scramble`。
#
# 为什么"一定能拿到最优":求解器 IDA* 完备 + 可采纳,TT 满了只少剪枝**绝不出错** ⇒ 给够时间
# 一定收敛到可证最优。怪物是速度问题,不是正确性问题;本脚本只解决"啃完它"。
#
# 可续:① 启动先合并上轮残留结果块(硬杀后已解的不白重算);② 已解的(out 不再是 M)自动跳过。
# 可反复跑(空闲就啃)直到全清。⚠️ 严禁与主 inject run 并跑(两个 13GB 表 = OOM);检测到 sq1_analyzer
# 在跑会直接拒绝。
#
# 硬约束(用户 2026-06-18):**每条打乱 ≤10min**,必须有看门狗、处理超时、绝不死等 ⇒ 默认
# TimeoutSecs=600(超即留 M、下轮/调参再啃)。看门狗两层:① 求解器内每条墙钟 deadline(到点 unwind,
# 并行版 = scope 看门狗线程,串行版 = dfs 内 deadline_check);② 进程级 ANALYZER_STUCK_SECS 安全网。
#
# 用法:
#   pwsh grind_sq1_monsters.ps1                      # 默认 4 线程、240M TT、10min/条超时,啃所有待解
#   pwsh grind_sq1_monsters.ps1 -Split 2             # EPIC ④ 并行:单条吃满全核(自动 ChunkSize=1 + 12 线程)
#   pwsh grind_sq1_monsters.ps1 -Threads 1           # 串行啃硬尾:单线程 ⇒ 每条独占全部 TT
#   pwsh grind_sq1_monsters.ps1 -TtBudget 300000000  # 调大 TT(RAM 上限:13GB 表 + TT + OS < 32GB ⇒ ≲300M)
#   pwsh grind_sq1_monsters.ps1 -TimeoutSecs 0       # 关超时死磕(慎用:可能单条数小时,违反 10min 约束)
# 啃完后发布:pwsh update_cross_stats.ps1 -Jobs puzzles -Puzzles sq1
[CmdletBinding()]
param(
  [int]$Threads = 4,
  [long]$TtBudget = 240000000,
  [int]$TimeoutSecs = 600,
  [int]$ChunkSize = 12,
  [int]$Split = 0
)
$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch {}
try { (Get-Process -Id $PID).PriorityClass = 'BelowNormal' } catch {}

# ---- EPIC ④ 并行模式:root-split 让单条怪物吃满全核(默认一次一条、12 线程内部并行)----
if ($Split -gt 0) {
  if ($ChunkSize -eq 12) { $ChunkSize = 1 }   # 一次一条:每条独占全核 + 全 TT
  if ($Threads -eq 4)    { $Threads = 12 }     # 全核给单条(内部 root-split)
}

$dir   = 'D:/cube/scramble/puzzle/sq1'
$out   = "$dir/sq1_wca_exact.csv"      # 主 CSV:id,wca_exact[,opt_scramble](怪物行 = id,M)
$mon   = "$dir/sq1_wca_monsters.csv"   # 怪物清单:id,scramble
$work  = "$dir/_monster_chunks"
$logf  = "$dir/_monster_run.err"
$progf = "$dir/_monster_progress.log"
$exe   = 'D:/cube/cuberoot.me/solver/target/release/sq1_analyzer.exe'

# 合并 $work/*_sq1.csv 的解进 $out(覆盖对应 id,M 行),删已合并的结果块。返回 [solved, stillM, maxWca]。
function Merge-Results {
  $resChunks = Get-ChildItem $work -Filter '*_sq1.csv' -ErrorAction SilentlyContinue | Sort-Object Name
  if (-not $resChunks) { return @(0, 0, 0) }
  # 读 out → id->行(保序)
  $rows = [Collections.Generic.Dictionary[string,string]]::new()
  $order = [Collections.Generic.List[string]]::new()
  $header = $null; $f = $true
  foreach ($l in [IO.File]::ReadLines($out)) {
    if ($f) { $header = $l; $f = $false; continue }
    if (-not $l) { continue }
    $i = $l.IndexOf(','); if ($i -le 0) { continue }
    $id = $l.Substring(0,$i)
    if (-not $rows.ContainsKey($id)) { [void]$order.Add($id) }
    $rows[$id] = $l
  }
  if (-not $header) { $header = 'id,wca_exact,opt_scramble' }
  $solved = 0; $stillM = 0; $maxWca = 0
  foreach ($rc in $resChunks) {
    $fi = $true
    foreach ($l in [IO.File]::ReadLines($rc.FullName)) {
      if ($fi) { $fi = $false; continue }
      if (-not $l) { continue }
      $c = $l.Split(','); $id = $c[0]
      if ($c.Length -ge 2 -and $c[1] -eq 'M') { $stillM++; continue }   # 软超时仍没解出 → 留 M
      if ($c.Length -ge 2 -and $rows.ContainsKey($id)) {
        $rows[$id] = $l; $solved++
        $w = 0; if ([int]::TryParse($c[1], [ref]$w)) { if ($w -gt $maxWca) { $maxWca = $w } }
      }
    }
  }
  if ($solved -gt 0) {
    $tmp = "$out.tmp"
    $sw = New-Object IO.StreamWriter($tmp, $false, [Text.UTF8Encoding]::new($false))
    try { $sw.Write($header); $sw.Write("`n"); foreach ($id in $order) { $sw.Write($rows[$id]); $sw.Write("`n") } }
    finally { $sw.Close() }
    Move-Item -Force $tmp $out
  }
  foreach ($rc in $resChunks) { Remove-Item $rc.FullName -Force -ErrorAction SilentlyContinue }
  return @($solved, $stillM, $maxWca)
}

# ---- 防 OOM:不与主 inject run(同样载 13GB 表)并跑 ----
$running = Get-Process sq1_analyzer -ErrorAction SilentlyContinue
if ($running) {
  throw "已有 sq1_analyzer 在跑(PID $($running.Id),很可能是主 inject run)。两个 13GB 表进程会 OOM —— 等主 run 完再啃怪物。"
}
if (-not (Test-Path $exe)) { throw "analyzer 不存在: $exe" }
if (-not (Test-Path $out)) { throw "主 CSV 不存在: $out(先跑 inject_sq1_wca_exact.ps1)" }
if (-not (Test-Path $mon)) { Write-Host "无怪物清单 $mon(还没产生怪物 / 主 run 没超时跳过过)。无事可做。"; exit 0 }
New-Item -ItemType Directory -Force $work | Out-Null

# ---- 续跑:先合并上轮残留结果块(防硬杀后白重算)----
$pre = Merge-Results
if ($pre[0] -gt 0) { Write-Host "续跑:合并上轮残留 $($pre[0]) 条已解 -> $out" }

$env:CUBE_TABLE_DIR    = 'D:/cube/cuberoot.me/solver/tables'
$env:SQ1_WCA_EXACT     = '1'
$env:SQ1_WCA_SOLN      = '1'
$env:RAYON_NUM_THREADS = "$Threads"
$env:SQ1_TT_BUDGET     = "$TtBudget"
if ($Split -gt 0) { $env:SQ1_SOLVE_PARALLEL = "$Split" }
elseif (Test-Path Env:\SQ1_SOLVE_PARALLEL) { Remove-Item Env:\SQ1_SOLVE_PARALLEL }
if ($TimeoutSecs -gt 0) { $env:SQ1_SOLVE_TIMEOUT_SECS = "$TimeoutSecs" }
elseif (Test-Path Env:\SQ1_SOLVE_TIMEOUT_SECS) { Remove-Item Env:\SQ1_SOLVE_TIMEOUT_SECS }
# 进程级看门狗安全网:略高于单条超时(求解器内 deadline 应先生效;响 = 有路径漏了 deadline 的真 hang)。
# 关超时(TimeoutSecs=0)时退回 30min 兜底。
$env:ANALYZER_STUCK_SECS = if ($TimeoutSecs -gt 0) { "$($TimeoutSecs + 120)" } else { '1800' }

# ---- 待解 = 怪物清单里、out 仍为 M 的(l = id,scramble)----
$stillM = [Collections.Generic.HashSet[string]]::new()
$first = $true
foreach ($l in [IO.File]::ReadLines($out)) {
  if ($first) { $first = $false; continue }
  if (-not $l) { continue }
  $c = $l.Split(','); if ($c.Length -ge 2 -and $c[1] -eq 'M') { [void]$stillM.Add($c[0]) }
}
$todo = [Collections.Generic.List[string]]::new()
$seen = [Collections.Generic.HashSet[string]]::new()
foreach ($l in [IO.File]::ReadLines($mon)) {
  if (-not $l) { continue }
  $i = $l.IndexOf(','); if ($i -le 0) { continue }
  $id = $l.Substring(0,$i)
  if (-not $seen.Add($id)) { continue }
  if ($stillM.Contains($id)) { [void]$todo.Add($l) }
}
Write-Host "怪物清单 $($seen.Count) 条;仍待解 $($todo.Count);已解 $($seen.Count - $todo.Count)"
if ($todo.Count -eq 0) { Write-Host '全部怪物已解 ✓  发布:update_cross_stats.ps1 -Jobs puzzles -Puzzles sq1'; exit 0 }

# ---- 写 chunk(小块 ⇒ 慢解也勤落盘可续)----
Get-ChildItem $work -Filter '*.txt' -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
$chunkPaths = [Collections.Generic.List[string]]::new()
for ($i = 0; $i -lt $todo.Count; $i += $ChunkSize) {
  $n = [Math]::Min($ChunkSize, $todo.Count - $i)
  $p = Join-Path $work ("mchunk_{0:D4}.txt" -f ($i / $ChunkSize))
  [IO.File]::WriteAllLines($p, $todo.GetRange($i, $n))
  [void]$chunkPaths.Add($p)
}
Set-Content -Path $progf -Value '' -NoNewline
$env:ANALYZER_PROGRESS_FILE  = $progf
$env:ANALYZER_PROGRESS_EVERY = '1'
$env:ANALYZER_PROGRESS_TOTAL = "$($todo.Count)"
$env:ANALYZER_PROGRESS_BASE  = '0'
$modeStr = if ($Split -gt 0) { "并行 root-split(split=$Split,单条吃满 $Threads 核)" } else { "串行 $Threads 线程(跨打乱并行)" }
Write-Host "分 $($chunkPaths.Count) 块(每块 $ChunkSize)、$modeStr、TT $([math]::Round($TtBudget/1e6))M、超时 $(if($TimeoutSecs){"${TimeoutSecs}s/条"}else{'关(死磕到最优)'})。"
Write-Host "实时:Get-Content $progf -Wait -Tail 20"

# ---- 单次载表、逐块解(13GB 表只载一次)----
$stdin = ($chunkPaths -join "`n") + "`nexit`n"
$stdin | & $exe 2> $logf
$code = $LASTEXITCODE

# ---- 合并本轮结果 ----
$r = Merge-Results
$solved = $r[0]; $stillMonster = $r[1]; $maxWca = $r[2]
$leftNow = $todo.Count - $solved
Write-Host "本轮:解出 $solved 条$(if($stillMonster){",仍超时 $stillMonster 留 M"});合并回 $out。剩 $leftNow 待解。"
if ($maxWca -gt 0) { Write-Host "本轮最深 WCA = $maxWca(D_WCA 经验下界候选)。" }
if ($code -ne 0 -and $TimeoutSecs -eq 0) { Write-Host "⚠ analyzer 退出码 $code(已合并完成的,可重跑续啃)。" }
if ($leftNow -gt 0) { Write-Host "再跑本脚本续啃(尾巴硬就 -Threads 1 让它独占 TT)。全清后:update_cross_stats.ps1 -Jobs puzzles -Puzzles sq1" }
else { Write-Host "✓ 怪物全清!发布:update_cross_stats.ps1 -Jobs puzzles -Puzzles sq1" }
