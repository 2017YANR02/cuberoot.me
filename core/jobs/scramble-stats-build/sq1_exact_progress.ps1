#!/usr/bin/env pwsh
# SQ1 精确灌注(inject_sq1_wca_exact.ps1)进度 + 防卡快照。随时跑、或被监控循环调用。
#   pwsh sq1_exact_progress.ps1            # 打一次快照
#   pwsh sq1_exact_progress.ps1 -Json      # 机读(给 Monitor 用)
#
# 进度 = (主 CSV 行 + 所有已完成块行) / 语料总数。主 CSV 长跑中冻结(只启停 ingest),
# 故必须加上 _exact_chunks/*_sq1.csv 才反映真进度(同 build_puzzle_dist.ts 的口径)。
# 只报事实快照(done / alive / 块数)。**hang 检测交给监控循环做增量比对**(看 done 跨采样
# 是否增长),别用块文件的绝对 mtime 判 —— 跨 run / 单块含怪物 ~15min 都会误报。
[CmdletBinding()]
param([switch]$Json)

$dir   = 'D:/cube/scramble/puzzle/sq1'
$main  = Join-Path $dir 'sq1_wca_exact.csv'
$work  = Join-Path $dir '_exact_chunks'
$total = 125605

$mainRows = 0
if (Test-Path $main) { $mainRows = [Math]::Max(0, ([IO.File]::ReadLines($main) | Measure-Object).Count - 1) }

$chunkRows = 0; $nChunks = 0; $newest = $null
if (Test-Path $work) {
  $cs = Get-ChildItem $work -Filter '*_sq1.csv' -ErrorAction SilentlyContinue
  foreach ($c in $cs) {
    $nChunks++
    $chunkRows += [Math]::Max(0, ([IO.File]::ReadLines($c.FullName) | Measure-Object).Count - 1)
    if ($null -eq $newest -or $c.LastWriteTime -gt $newest) { $newest = $c.LastWriteTime }
  }
}

$done = $mainRows + $chunkRows
$pct  = if ($total -gt 0) { [math]::Round(100.0 * $done / $total, 2) } else { 0 }
$proc = Get-Process sq1_analyzer -ErrorAction SilentlyContinue
$alive = [bool]$proc

if ($Json) {
  [pscustomobject]@{
    done=$done; total=$total; pct=$pct; mainRows=$mainRows; chunkRows=$chunkRows
    chunks=$nChunks; alive=$alive
  } | ConvertTo-Json -Compress | Write-Output
} else {
  Write-Output "SQ1 精确灌注: $done / $total ($pct%)  [主 $mainRows + 块 $chunkRows / $nChunks 块]"
  $st = if ($alive) { "analyzer 活着 (WS $([math]::Round($proc.WorkingSet64/1GB,1))GB)" } else { "analyzer 未运行" }
  Write-Output "  $st"
}
