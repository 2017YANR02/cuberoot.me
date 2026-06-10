#!/usr/bin/env pwsh
# xcross_2_col_10f 集 单变体 (f2leo / pseudo_f2leo) 回填: 分块 + 可续 + 限时 + 限线程。
#
# 这个 set 是静态打乱 (scrambles.txt 固定 1,271,727 条 "10步双色底 xcross" 难题), 只缺 f2leo/pseudo_f2leo
# 两个变体 CSV。与 update_cross_stats.ps1 (WCA set) 解耦: 不取数 / 不算 std / 不 build / 不发布 ——
# 只把该变体 CSV 补到与 master scrambles.txt 同 id 集。补满后再单独 `pnpm -F @cuberoot/scramble-stats-build build`
# 重算 distribution.json + 发布 (样本不全前别 build, 否则该变体分布 partial)。
#
# 限时跑: 到 -Hours 墙钟即在 chunk 边界停 (最后一块按剩余时间裁剪贴近 Hours), 已追加的块持久, 下次重跑自动接上。
#
# 例:  pwsh backfill_xcross_variant.ps1 -Variant pseudo_f2leo -Hours 5 -Threads 10
#      pwsh backfill_xcross_variant.ps1 -Variant pseudo_f2leo                 (补满, 14 线程)
[CmdletBinding()]
param(
  [ValidateSet('f2leo','pseudo_f2leo','222','roux','223','eoline','dr','f2b')]
  [string]$Variant = 'pseudo_f2leo',
  [double]$Hours = 0,        # >0: 本次最多跑几小时 (墙钟), 到点 chunk 边界停; 0=补满不限时
  [int]$Threads = 14,        # RAYON 线程数 (全局上限 14)
  [int]$ChunkSize = 10000,   # 每块条数; analyzer 整块攒内存跑完才写 -> 中断只丢当前块
  [int]$MaxChunks = 0        # >0 时最多跑 N 块 (调试)
)
$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
$env:RAYON_NUM_THREADS = "$Threads"
try { (Get-Process -Id $PID).PriorityClass = 'BelowNormal' } catch {}

$SolverDir = 'D:\cube\cuberoot.me\solver'
$RelDir    = Join-Path $SolverDir 'target\release'
$SetDir    = 'D:\cube\scramble\xcross_2_col_10f'
$Master    = Join-Path $SetDir 'scrambles.txt'
$StatDir   = Join-Path $SetDir 'stat'
$WorkDir   = Join-Path $SetDir '_backfill'
$null = New-Item -ItemType Directory -Force -Path $WorkDir

$EXE = @{ f2leo = 'f2leo_analyzer.exe'; pseudo_f2leo = 'pseudo_f2leo_analyzer.exe'; '222' = 'block222_analyzer.exe'; roux = 'roux_analyzer.exe'; '223' = 'block223_analyzer.exe'; eoline = 'eoline_analyzer.exe'; dr = 'dr_analyzer.exe'; f2b = 'f2b_analyzer.exe' }
$exe = Join-Path $RelDir $EXE[$Variant]
if(-not (Test-Path $exe)){ throw "analyzer 不存在: $exe" }
$csv = Join-Path $StatDir "$Variant.csv"
$log = Join-Path $WorkDir "backfill_$Variant.log"

# huge 表快路径 (与 WCA set 同 env), 否则回退小表慢很多。
$env:CUBE_TABLE_DIR = Join-Path $SolverDir 'tables'
$env:CUBE_ALLOW_HUGE_TABLES = '1'

function Log($m){ $line = "[{0}] {1}" -f (Get-Date -Format 'HH:mm:ss'), $m; Write-Host $line; Add-Content -LiteralPath $log -Value $line }
function Lc($p){ $n=0; foreach($l in [IO.File]::ReadLines($p)){ $n++ }; $n }
function AppendData($dst,$src,$skipHeader){
  # LF 安全追加: 先确保 dst 末尾有换行, 再逐行 append (可选跳过源 header)
  $needNL=$false
  if((Test-Path $dst) -and ((Get-Item $dst).Length -gt 0)){
    $fs=[IO.File]::Open($dst,'Open','ReadWrite'); [void]$fs.Seek(-1,'End'); $needNL=($fs.ReadByte() -ne 10); $fs.Close()
  }
  $sw=New-Object IO.StreamWriter($dst,$true,[Text.UTF8Encoding]::new($false))
  if($needNL){ $sw.Write("`n") }
  $i=0
  foreach($line in [IO.File]::ReadLines($src)){ if($skipHeader -and $i -eq 0){ $i++; continue }; $sw.Write($line); $sw.Write("`n"); $i++ }
  $sw.Close()
}

$limitTxt = if($Hours -gt 0){ "$Hours h" } else { '不限时(补满)' }
Log "=== 回填 $Variant (set=xcross_2_col_10f) 限时 $limitTxt / $Threads 线程 / chunk=$ChunkSize ==="

# 1. 该变体已有 id 集 (可续: 重跑跳过已算)
$have=[System.Collections.Generic.HashSet[string]]::new()
if(Test-Path $csv){
  $first=$true
  foreach($l in [IO.File]::ReadLines($csv)){ if($first){$first=$false;continue}; $c=$l.IndexOf(','); if($c -gt 0){ [void]$have.Add($l.Substring(0,$c)) } }
}
# 2. master 里有但该变体缺的整行 (id,scramble)
$missing=[System.Collections.Generic.List[string]]::new()
foreach($l in [IO.File]::ReadLines($Master)){ if(-not $l){continue}; $c=$l.IndexOf(','); if($c -le 0){continue}; if(-not $have.Contains($l.Substring(0,$c))){ [void]$missing.Add($l) } }
$total=$missing.Count
$masterN = $have.Count + $total
Log ("master {0} 条; 已有 {1}; 待补 {2}" -f $masterN, $have.Count, $total)
if($total -eq 0){ Log "已补满, 无需再跑。"; return }

$deadline = if($Hours -gt 0){ (Get-Date).AddHours($Hours) } else { [DateTime]::MaxValue }
$inTxt = Join-Path $WorkDir "chunk_$Variant.txt"
$out   = Join-Path $WorkDir ("chunk_{0}_{0}.csv" -f $Variant)   # analyzer 输出 = <输入base>_<variant>.csv
$alog  = Join-Path $WorkDir "analyzer_$Variant.log"

$done=0; $chunksRun=0; $started=Get-Date; $rate=20.0
for($i=0; $i -lt $total; ){
  $now = Get-Date
  if($now -ge $deadline){ Log "到时限, 停在 chunk 边界。"; break }
  if($MaxChunks -gt 0 -and $chunksRun -ge $MaxChunks){ Log "达 -MaxChunks $MaxChunks, 停。"; break }
  $cnt = [Math]::Min($ChunkSize, $total - $i)
  if($done -gt 0){ $rate = $done / ((Get-Date) - $started).TotalSeconds }
  if($Hours -gt 0){
    # 最后一块按剩余时间 + 观测速率裁剪, 贴近 -Hours (首块无观测用预设 20/s)
    $remainSec = ($deadline - $now).TotalSeconds
    $fit = [int]($remainSec * $rate)
    if($fit -lt $cnt){ $cnt = $fit }
    if($cnt -le 0){ Log "剩余时间不足一块, 停。"; break }
  }
  $slice = $missing.GetRange($i, $cnt)
  [IO.File]::WriteAllText($inTxt, ([string]::Join("`n",$slice)+"`n"), [Text.UTF8Encoding]::new($false))
  if(Test-Path $out){ Remove-Item $out -Force }
  $cs = Get-Date
  $inTxt | & $exe *> $alog
  if($LASTEXITCODE -ne 0){ throw "[$Variant] analyzer 失败 (块 @$i), 详见 $alog" }
  if(-not (Test-Path $out)){ throw "[$Variant] 无输出 $out, 详见 $alog" }
  $got = (Lc $out) - 1
  if($got -ne $cnt){ throw "[$Variant] 块行数 $got != 输入 $cnt" }
  $skip = (Test-Path $csv) -and ((Get-Item $csv).Length -gt 0)   # 首块 csv 不存在 -> 保留 header
  AppendData $csv $out $skip
  Remove-Item $out -Force
  $i += $cnt; $done += $cnt; $chunksRun++
  $secChunk = [Math]::Max(((Get-Date)-$cs).TotalSeconds, 0.001)
  $rate = $done / ((Get-Date)-$started).TotalSeconds
  $remainAll = $total - $done
  $etaAllH = if($rate -gt 0){ $remainAll/$rate/3600 } else { 0 }
  Log ("+{0} ({1:N0}s, {2:N1}/s) | 本次 {3}/{4} | 全集还差 {5} (≈{6:N1}h@{7:N1}/s)" -f $cnt,$secChunk,($cnt/$secChunk),$done,$total,$remainAll,$etaAllH,$rate)
}
Remove-Item $inTxt -Force -ErrorAction SilentlyContinue
$nowCsv = if(Test-Path $csv){ (Lc $csv)-1 } else { 0 }
$elapsedH = ((Get-Date)-$started).TotalHours
Log ("=== 本次完成: 跑 {0:N2}h, 补 {1} 条; {2}.csv 现 {3}/{4} 条; 还差 {5}。下次重跑自动续。" -f $elapsedH, $done, $Variant, $nowCsv, $masterN, ($masterN-$nowCsv))
