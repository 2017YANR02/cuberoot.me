#!/usr/bin/env pwsh
# WCA 十字步数分布 手动增量刷新管道 (按需触发, 非定时; 仅本地: 需 solver 的 ~34GB 表 + ~16GB 内存余量)
#
# 一键:        pwsh update_cross_stats.ps1          (真人终端裸跑 -> 自动进交互向导; AI/非交互终端 -> 旧一键直跑)
# 一条龙(默认):pwsh update_cross_stats.ps1          (= -Jobs all: stages 3x3阶段难度 + 333opt 整解最优 + puzzles 非3x3, 共享一次发布)
# 只跑某作业:  pwsh update_cross_stats.ps1 -Jobs 333opt        (任选 stages/333opt/puzzles; 多个: -Jobs stages,puzzles)
# 选 puzzle:   pwsh update_cross_stats.ps1 -Jobs puzzles -Puzzles sq1
#   注: 333opt 只做 inject(折当前 solver/333opt/out.*.csv); 那条 ~3.5 天全量求解仍是独立后台 `node solve_loop.mjs`。
#   注: stages 的 build 会覆写 distribution/examples 的 '333' 变体, 故 stages 一跑脚本会自动补 333 inject 还原(免手动)。
# 强制向导:    pwsh update_cross_stats.ps1 -Interactive   (取数前问 TSV 来源, 取数后问: 跑哪些变体 / 每变体几块 / 是否发布)
# 用本地缓存:  pwsh update_cross_stats.ps1 -UseCached     (取数不联网, 用 cache/ 最新 export zip)
# 干跑(只读):  pwsh update_cross_stats.ps1 -DryRun -SourceCsv D:\cube\scramble\wca_scramble\input\wca_scrambles_info.csv
# 只本地不发布: pwsh update_cross_stats.ps1 -NoPublish
# 选变体补缺: pwsh update_cross_stats.ps1 -Variants pseudo,pseudo_pair   (默认全 6: eo,pseudo,pseudo_pair,pair,f2leo,pseudo_f2leo)
# pair 单独跑: pwsh update_cross_stats.ps1 -Variants pair                (~2/s, 全量补 ~165h, 分块可中断续跑; 现已入默认, 增量只补 delta)
# f2leo 系:   pwsh update_cross_stats.ps1 -Variants f2leo,pseudo_f2leo  (大表快路径, 真实打乱实测: f2leo 用 huge 联合表 ~31/s, pseudo_f2leo 用 huge 电池 ~81/s; 首次需全量补, 现已入默认)
# 只跑一两块: pwsh update_cross_stats.ps1 -Variants eo -MaxChunks 1     (eo 一块=2000≈40min, 跑完照常发布, 还差的下次续; 免人工盯/kill)
# 不补变体:   pwsh update_cross_stats.ps1 -Variants @()
#
# 流程: results export 下载/抽取 -> 增量 diff (vs std.csv) -> std_analyzer 全 5 阶段 -> 追加 std/no_wide_move/split_mbf
#       -> 对每个变体按 "master no_wide_move 的 id - 该变体已有 id" 补缺 (分块 solve + 逐块校验追加, 可中断续跑)
#       -> 重算 distribution (有新 std 时再 wca_cross/comp-steps) -> git commit&push + tar 发布 static。
#       任一步失败即停 (ErrorActionPreference=Stop)。
[CmdletBinding()]
param(
  [switch]$DryRun,        # 严格只读: 算新增规模即停, 不碰任何 master / 不解算 / 不发布
  [string]$SourceCsv,     # 测试源 (input 形状 csv) 替代下载 export
  [switch]$NoPublish,     # 跑完只更新本地 csv + JSON, 不 commit/push/scp
  [switch]$SkipSolve,     # 调试: 跳过 incremental + std 解算, 复用上次取数/solver 产出, 直接走追加/变体/发布
  [string[]]$Variants = @('eo','pseudo','pseudo_pair','pair','f2leo','pseudo_f2leo','222','roux','223','eoline','dr','f2b'),  # 跟 std 锁步补缺的全部 12 变体 (@()=只 std)。瓶颈始终是 eo ~0.9/s; 想快跑显式 -Variants eo,pseudo,pseudo_pair 跳过重型
  [int]$ChunkSize = 20000, # 显式传则覆盖所有变体的分块大小; 不传则用每变体默认(见 $VARIANT_CHUNK: eo/pair=2000, 其余=20000)。逐块追加, 中断只丢当前块
  [int]$MaxChunks = 0,     # >0: 每个变体最多跑 N 块就停, 之后照常重算+发布(还差的下次 run 自动续)。0=补满。用于"只跑一两块"而无需人工盯/中途 kill
  [switch]$PublishOnly,    # 跳过取数/解算/变体, 直接用当前 CSV 状态重算 distribution+comp-steps 并发布(把已落盘但未发布的累积变更推上线)
  [switch]$Interactive,    # 强制走交互向导(取数后弹问题: 跑哪些变体 / 每变体几块 / 是否发布)。裸跑(无任何参数)且在交互终端时自动开; AI/带任意 flag/非交互终端(stdin 重定向)一律不弹, 行为同旧
  [switch]$UseCached,      # 取数用本地 cache/ 最新 export zip, 不联网下载/不查官方元数据(export_date 从文件名还原, stamp 仍稳定)。向导会先问这一步
  [ValidateSet('all','stages','333opt','puzzles')]
  [string[]]$Jobs = @('all'),   # 一条龙作业选择: stages(3x3阶段难度) / 333opt(整解最优HTM) / puzzles(非3x3) / all。AI 按用户"跑X/不跑Y"映射; 默认全跑
  [string[]]$Puzzles = @('pocket','pyraminx','skewb','sq1')   # puzzles 作业跑哪些非3x3 对象
)
$ErrorActionPreference = 'Stop'
$ChunkExplicit = $PSBoundParameters.ContainsKey('ChunkSize')  # 显式 -ChunkSize 覆盖每变体默认
# 向导触发: 显式 -Interactive, 或裸跑(无参数)+ 真人终端(stdin 未重定向)。AI 工具/scheduled task stdin 被重定向 -> IsInputRedirected=True -> 不弹, 保持旧一键。
$Wizard = $Interactive -or ($PSBoundParameters.Count -eq 0 -and [Environment]::UserInteractive -and -not [Console]::IsInputRedirected)
# UTF-8 控制台输出: 否则中文 Windows 默认 GBK(936) 码页下 ›/■/●/◆ 等非 GBK 字形被编成 ?。
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

# ---- 本机算力限额 (全局规则: 重计算最多 7 核 14 线程, 留 1 核给系统; 长跑进程低优先级) ----
# solver 各 analyzer 走 rayon 全局池 (executor.rs par_iter), 无自建 ThreadPoolBuilder, 故 RAYON_NUM_THREADS 直接钉死线程数。
# env 在本 session 持久, 此处设一次, 后续每个 `& $exe` 子进程都继承; 子进程也继承本 pwsh 的优先级类。
if (-not $env:RAYON_NUM_THREADS) { $env:RAYON_NUM_THREADS = '14' }  # 默认 14; 调用方可预设覆盖(如临时 10 线程)
try { (Get-Process -Id $PID).PriorityClass = 'BelowNormal' } catch {}

# ---- 本机布局 ----
$ScrambleDir = 'D:\cube\scramble\wca_scramble'
$SolverDir   = 'D:\cube\cuberoot.me\solver'
$RepoRoot    = 'D:\cube\cuberoot.me'
$RelDir      = Join-Path $SolverDir 'target\release'
$StdAnalyzer = Join-Path $RelDir 'std_analyzer.exe'
$IncrDir     = Join-Path $ScrambleDir 'incremental'
$CacheDir    = Join-Path $IncrDir 'cache'                # incremental.py 下的 WCA_export_*.tsv.zip 缓存
$MasterTxt   = Join-Path $ScrambleDir 'wca_scrambles_no_wide_move.txt'
$StaticHost  = 'root@cuberoot'                 # 免密 ssh 别名
$StaticDest  = '/www/wwwroot/toolkit/stats'    # nginx 静态根 (self-hosted + Vercel fallback 都从这服)

# 变体 -> analyzer exe。suffix 恒为 _<变体名>, 故输出文件名 = <输入名>_<变体名>.csv。
# std 不在此: 它单独走 new_no_wide_move.txt 的全量 diff (见下)。eo ~0.9/s 是瓶颈; pair/f2leo/pseudo_f2leo 现已入默认(增量只补 delta, 想跳过用显式 -Variants)。
$VARIANT_EXE = @{
  eo           = 'eo_cross_analyzer.exe'
  pseudo       = 'pseudo_analyzer.exe'
  pseudo_pair  = 'pseudo_pair_analyzer.exe'
  pair         = 'pair_analyzer.exe'
  f2leo        = 'f2leo_analyzer.exe'
  pseudo_f2leo = 'pseudo_f2leo_analyzer.exe'
  '222'        = 'block222_analyzer.exe'   # 键必须字符串: $Name 是 string, int 键查不到
  roux         = 'roux_analyzer.exe'       # FB 方块 + 1x2x3 双阶段, 全表直查
  '223'        = 'block223_analyzer.exe'   # Petrus 2x2x3, IDA* (h = max(s1 全表, 角2+DB/DF 表))
  eoline       = 'eoline_analyzer.exe'     # EO + EOLine 双阶段, 微表直查 (零外部表)
  dr           = 'dr_analyzer.exe'         # Kociemba phase-1 最优, IDA* 微表 (零外部表)
  f2b          = 'f2b_analyzer.exe'        # 双 1x2x3 联合最优, IDA*; 首跑建 pt_f2b_be3c2.bin (1.34GB) 后 mmap
}

# 每变体默认 chunk(显式 -ChunkSize 覆盖全部)。analyzer 攒完整块才写盘 + 追加 = 中断丢在飞的整块,
# 故慢变体用小块换更密的 save point。实测速率(2026-05-30, 旧 16 核满核基准; 现钉 14 线程略低, 下方 chunk 仍适用):
# eo ~0.9/s(一块 2000≈37min)、pair ~2/s、pseudo ~390/s、pseudo_pair ~47/s(2000 才几十秒,重启占比高,故快变体保持 20000≈数分钟)。
$VARIANT_CHUNK = @{
  eo           = 2000
  pair         = 2000
  pseudo       = 20000
  pseudo_pair  = 20000
  f2leo        = 20000
  pseudo_f2leo = 20000
  '222'        = 200000   # 查表零搜索 ~1.25M/s, 一块秒级
  roux         = 200000   # 同 222 全表直查, 一块秒级
  '223'        = 50000    # IDA* ~19k/s (WCA 集; 难题集 ~4.4k/s), 一块数秒
  eoline       = 200000   # 微表直查 ~350k/s, 一块秒级
  dr           = 50000    # IDA* ~12k/s, 一块数秒
  f2b          = 10000    # IDA* ~220/s (heavy 表), 一块 ~1min
}

# 实测速率 (条/秒, 旧 16 核满核 huge 表全模式基准; 仅向导估时用, 见 RUNBOOK)。std ~115/s。
# 注: 现钉 RAYON_NUM_THREADS=14, 实际略低于下列值, 向导估时偏乐观。
$VARIANT_RATE = @{
  eo           = 0.9
  pair         = 2
  pseudo       = 390
  pseudo_pair  = 47
  f2leo        = 31
  pseudo_f2leo = 81
  '222'        = 1250000
  roux         = 600000
  '223'        = 19000
  eoline       = 350000
  dr           = 12000
  f2b          = 220
}

function Step($m){ Write-Host "`n=== $m ===" -ForegroundColor Cyan }
function Lc($p){ $n=0; foreach($l in [IO.File]::ReadLines($p)){ $n++ }; $n }

# /timer「原始/最优打乱」最优数据 -> prod PG wca_scramble_optimal(自动灌库, 取代手动 \copy)。
# 每份 export 都是该批项目的"全量"最优集, 故按 event_id 整批替换(DELETE+COPY in tx), 幂等可重跑。
# 服务器端密码从自身 /root/core-api/.env 读, 不把任何凭据写进(进 git 的)本脚本。
function Load-OptimalToPg {
  param([string]$LocalCsv, [string]$Tag, [string]$EventsInList)
  if(-not (Test-Path $LocalCsv)){ Write-Host "  [timer-optimal] ${Tag}: 缺 $LocalCsv, 跳过" -ForegroundColor DarkGray; return }
  $rows = (Lc $LocalCsv) - 1
  if($rows -le 0){ Write-Host "  [timer-optimal] ${Tag}: CSV 0 行, 跳过" -ForegroundColor DarkGray; return }
  $remoteCsv = "/root/_timer_optimal_$Tag.csv"
  $remoteSql = "/root/_timer_optimal_$Tag.sql"
  $sql = @"
\set ON_ERROR_STOP on
BEGIN;
DELETE FROM wca_scramble_optimal WHERE event_id IN ($EventsInList);
\copy wca_scramble_optimal (competition_id,event_id,round_type_id,group_id,is_extra,scramble_num,htm,optimal_scramble) FROM '$remoteCsv' WITH (FORMAT csv, HEADER true)
COMMIT;
SELECT count(*) AS wca_scramble_optimal_total FROM wca_scramble_optimal;
"@
  $localSql = Join-Path $env:TEMP "_timer_optimal_$Tag.sql"
  [IO.File]::WriteAllText($localSql, ($sql -replace "`r`n","`n"), [Text.UTF8Encoding]::new($false))
  Write-Host "  [timer-optimal] ${Tag}: scp $rows 行 + 整批替换 wca_scramble_optimal ($EventsInList) ..." -ForegroundColor DarkCyan
  scp $LocalCsv "${StaticHost}:$remoteCsv"
  if($LASTEXITCODE -ne 0){ throw "[timer-optimal] $Tag CSV scp 失败" }
  scp $localSql "${StaticHost}:$remoteSql"
  if($LASTEXITCODE -ne 0){ throw "[timer-optimal] $Tag SQL scp 失败" }
  $pwExpr = '$(grep -oP ''DB_PASS=\K.*'' /root/core-api/.env | tr -d ''[:space:]'')'
  $remoteCmd = "PGPASSWORD=$pwExpr psql -U recon_user -h 127.0.0.1 -d cuberoot_db -v ON_ERROR_STOP=1 -f $remoteSql; rc=`$?; rm -f $remoteCsv $remoteSql; exit `$rc"
  ssh $StaticHost $remoteCmd
  if($LASTEXITCODE -ne 0){ throw "[timer-optimal] $Tag psql 灌库失败" }
  Remove-Item $localSql -Force -ErrorAction SilentlyContinue
  Write-Host "  [timer-optimal] ${Tag}: 完成 ($rows 行已上线)。" -ForegroundColor Green
}
function AppendData($master,$src,$skipHeader){
  # LF 安全追加: 先确保 master 末尾有换行, 再逐行 append (跳过源 header)
  $needNL=$false
  if((Test-Path $master) -and ((Get-Item $master).Length -gt 0)){
    $fs=[IO.File]::Open($master,'Open','ReadWrite'); [void]$fs.Seek(-1,'End'); $needNL=($fs.ReadByte() -ne 10); $fs.Close()
  }
  $sw=New-Object IO.StreamWriter($master,$true,[Text.UTF8Encoding]::new($false))
  if($needNL){ $sw.Write("`n") }
  $i=0
  foreach($line in [IO.File]::ReadLines($src)){ if($skipHeader -and $i -eq 0){ $i++; continue }; $sw.Write($line); $sw.Write("`n"); $i++ }
  $sw.Close()
}

# 把某变体补到与 master no_wide_move 同 id 集: 算缺 -> 分块 solve -> 逐块校验行数 + 追加。
# 返回 $true 表示有追加(数据变了)。分块可中断续跑: 已追加的块持久, 下次 run 重算 missing 自动接上。
function Sync-Variant($Name){
  $exeName = $VARIANT_EXE[$Name]
  if(-not $exeName){ throw "未知变体 $Name (合法: $($VARIANT_EXE.Keys -join ', '))" }
  $exe = Join-Path $RelDir $exeName
  $csv = Join-Path $ScrambleDir "stats\$Name.csv"
  if(-not (Test-Path $csv)){ throw "$csv 不存在" }
  # 有效 chunk: 显式 -ChunkSize 覆盖;否则按变体默认(慢变体小块,save point 更密)
  $chunk = if($ChunkExplicit){ $ChunkSize } elseif($VARIANT_CHUNK.ContainsKey($Name)){ $VARIANT_CHUNK[$Name] } else { $ChunkSize }
  # 1. 该变体已有 id 集
  $have=[System.Collections.Generic.HashSet[string]]::new()
  $first=$true
  foreach($l in [IO.File]::ReadLines($csv)){ if($first){$first=$false;continue}; $c=$l.IndexOf(','); if($c -gt 0){ [void]$have.Add($l.Substring(0,$c)) } }
  # 2. master 里有但该变体缺的行 (完整 "id,scramble")
  $missing=[System.Collections.Generic.List[string]]::new()
  foreach($l in [IO.File]::ReadLines($MasterTxt)){ if(-not $l){continue}; $c=$l.IndexOf(','); if($c -le 0){continue}; if(-not $have.Contains($l.Substring(0,$c))){ [void]$missing.Add($l) } }
  $total=$missing.Count
  if($total -eq 0){ Write-Host "[$Name] 已最新 ($($have.Count) 条), 跳过。" -ForegroundColor DarkGray; return $false }
  Write-Host "[$Name] 已有 $($have.Count) 条, 待补 $total 条 (chunk=$chunk)" -ForegroundColor Yellow
  # 3. env: huge 表 + 清掉 std-only / NO_DIAG / SKIP 标志 -> 跑权威全模式, 与现存数据一致
  $env:CUBE_TABLE_DIR = Join-Path $SolverDir 'tables'
  $env:CUBE_ALLOW_HUGE_TABLES = '1'
  foreach($k in 'CUBE_RUN_FULL_STD','CUBE_EO_NO_DIAG','CUBE_PAIR_NO_DIAG','CUBE_PSEUDO_SKIP_XCROSS','CUBE_PSEUDO_SKIP_XXCROSS','CUBE_PSEUDO_SKIP_XXXCROSS'){
    if(Test-Path "Env:$k"){ Remove-Item "Env:$k" }
  }
  # 4. 分块: 写块输入 -> analyzer (全部输出转存 $errLog, 终端零噪音) -> 校验行数 -> 追加 -> 删中间产物
  $inTxt  = Join-Path $IncrDir "sync_$Name.txt"
  $outCsv = Join-Path $IncrDir ("sync_{0}_{0}.csv" -f $Name)
  $errLog = Join-Path $IncrDir "sync_$Name.analyzer.log"  # analyzer 的 banner/提示/非进度行转存于此, 不刷终端
  $done=0; $chunksRun=0; $script:tick=Get-Date  # tick: 上次打印进度的时刻, 跨块保持 -> 每 5min 跳一行(按墙钟, 非按块)
  for($i=0; $i -lt $total; $i += $chunk){
    $cnt=[Math]::Min($chunk, $total-$i)
    $slice=$missing.GetRange($i, $cnt)
    [IO.File]::WriteAllText($inTxt, ([string]::Join("`n",$slice)+"`n"), [Text.UTF8Encoding]::new($false))
    if(Test-Path $outCsv){ Remove-Item $outCsv -Force }
    if(Test-Path $errLog){ Remove-Item $errLog -Force }
    # analyzer: stdout 噪音丢弃; stderr([PROG] x/n + banner) 逐行过滤 -> 满 5min 打一行干净总进度(~已算/total), 其余进 $errLog。
    $inTxt | & $exe 2>&1 | ForEach-Object {
      if($_ -isnot [System.Management.Automation.ErrorRecord]){ return }  # stdout, 丢弃
      $s = "$_"
      $mm = [regex]::Match($s, '\[PROG\]\s+(\d+)')
      if($mm.Success){
        $now = Get-Date
        if(($now - $script:tick).TotalMinutes -ge 5){
          Write-Host "[$Name] ~$($done + [int]$mm.Groups[1].Value)/$total  $($now.ToString('HH:mm:ss'))"
          $script:tick = $now
        }
      } else { Add-Content -LiteralPath $errLog -Value $s }
    }
    if($LASTEXITCODE -ne 0){ throw "[$Name] analyzer 失败 (块 @$i), 详见 $errLog" }
    if(-not (Test-Path $outCsv)){ throw "[$Name] 无输出 $outCsv" }
    $got=(Lc $outCsv)-1
    if($got -ne $cnt){ throw "[$Name] 块行数 $got != 输入 $cnt" }
    AppendData $csv $outCsv $true
    Remove-Item $outCsv -Force
    $done += $cnt; $chunksRun++
    if($MaxChunks -gt 0 -and $chunksRun -ge $MaxChunks){
      Write-Host "[$Name] 已达 -MaxChunks $MaxChunks, 停止 (还差 $($total-$done) 条, 下次 run 自动续)。" -ForegroundColor Yellow
      break
    }
  }
  Remove-Item $inTxt,$errLog -Force -ErrorAction SilentlyContinue
  if($done -ge $total){ Write-Host "[$Name] 完成, 现 $(Lc $csv) 行(含表头)。" -ForegroundColor Green }
  else { Write-Host "[$Name] 部分补缺 $done/$total, 现 $(Lc $csv) 行(含表头)。" -ForegroundColor Yellow }
  return $true
}

# 交互菜单 (移植自 D:\cube\upload-video\upload.ps1 的 UI: 原生配色 + SetCursorPosition 原地重绘)。
# UTF-8 输出已在顶部设好, 故 ›/■/□/●/○ 在 GBK 默认码页下也不会变 ?。

# 多选: 方向键移动, Space 切换, [A] 全选, 分组快捷键, 单项字母/数字键; Enter 确认 / Esc 取消。
# 就地改 $Items[].Selected; 返回 $true=确认 / $false=Esc 取消。
function Read-MultiSelect {
  param(
    [string]$Prompt,
    [array]$Items,                     # @{Name; Key; Selected; Group(可选); Note(可选)}
    [hashtable]$GroupShortcuts = @{}   # 大写键 -> @{Group; Label}
  )
  function Show-Items { param([array]$MI,[int]$Cursor)
    foreach($i in 0..($MI.Count-1)){
      $isC = $i -eq $Cursor; $isS = $MI[$i].Selected
      $prefix = if($isC){'›'}else{' '}
      $check  = if($isS){'■'}else{'□'}
      $checkColor = if($isS){'Green'}else{'DarkGray'}
      $nameColor  = if($isC){'Cyan'}elseif($isS){'White'}else{'DarkGray'}
      Write-Host "  $prefix " -NoNewline -ForegroundColor $nameColor
      Write-Host "$check " -NoNewline -ForegroundColor $checkColor
      Write-Host "[$($MI[$i].Key)] $($MI[$i].Name)" -NoNewline -ForegroundColor $nameColor
      if($MI[$i].Note){ Write-Host "  $($MI[$i].Note)" -ForegroundColor DarkGray } else { Write-Host '' }
    }
    $sc=0; foreach($it in $MI){ if($it.Selected){$sc++} }
    Write-Host ''
    Write-Host "  $sc/$($MI.Count) selected" -NoNewline -ForegroundColor $(if($sc -gt 0){'Green'}else{'Red'})
    Write-Host '    ↑↓ 移动  Space 切换  Enter 确认  Esc 取消' -ForegroundColor DarkGray
  }
  Write-Host ''
  Write-Host '  ◆ ' -NoNewline -ForegroundColor Yellow
  Write-Host $Prompt -ForegroundColor White
  $sc = '[A]ll'
  foreach($g in ($GroupShortcuts.GetEnumerator() | Sort-Object Key)){ $sc += "  [$($g.Key)] $($g.Value.Label)" }
  Write-Host "    快捷: $sc" -ForegroundColor DarkGray
  Write-Host ''
  $cursor = 0
  [Console]::CursorVisible = $false
  Show-Items -MI $Items -Cursor $cursor
  $menuTop = [Console]::CursorTop - ($Items.Count + 2)   # 项数 + 空行 + 状态栏
  $done = $false; $cancel = $false
  while(-not $done){
    $key = [Console]::ReadKey($true)
    if($key.Key -eq 'UpArrow'){ $cursor = if($cursor -gt 0){$cursor-1}else{$Items.Count-1} }
    elseif($key.Key -eq 'DownArrow'){ $cursor = if($cursor -lt $Items.Count-1){$cursor+1}else{0} }
    elseif($key.Key -eq 'Spacebar'){ $Items[$cursor].Selected = -not $Items[$cursor].Selected }
    elseif($key.Key -eq 'Enter'){ $done = $true }
    elseif($key.Key -eq 'Escape'){ $done = $true; $cancel = $true }
    elseif($key.KeyChar -eq 'A' -or $key.KeyChar -eq 'a'){
      $all=$true; foreach($it in $Items){ if(-not $it.Selected){$all=$false;break} }
      $Items | ForEach-Object { $_.Selected = -not $all }
    }
    else {
      $uc = $key.KeyChar.ToString().ToUpper(); $grp=$null
      if($GroupShortcuts.ContainsKey($uc)){ $grp = $GroupShortcuts[$uc].Group }
      if($grp){
        $gi=@($Items | Where-Object { $_.Group -eq $grp })
        $allg=$true; foreach($g in $gi){ if(-not $g.Selected){$allg=$false;break} }
        $gi | ForEach-Object { $_.Selected = -not $allg }
      } else {
        $m=$Items | Where-Object { $_.Key -eq $uc }
        if($m){ $m.Selected = -not $m.Selected }
      }
    }
    if(-not $done){ [Console]::SetCursorPosition(0,$menuTop); Show-Items -MI $Items -Cursor $cursor }
  }
  [Console]::CursorVisible = $true
  return (-not $cancel)
}

# 单选: 方向键 / 数字键; Enter 确认。返回选中索引 (0-based); Esc 取消 -> -1。
function Read-SingleSelect {
  param([string]$Prompt,[string[]]$Options,[int]$Default=0)
  Write-Host ''
  Write-Host '  ◆ ' -NoNewline -ForegroundColor Yellow
  Write-Host $Prompt -ForegroundColor White
  [Console]::CursorVisible = $false
  $cursor = $Default
  function Show-Choices { param([int]$cur,[string[]]$opts)
    for($i=0;$i -lt $opts.Count;$i++){
      $marker = if($i -eq $cur){'›'}else{' '}
      $color  = if($i -eq $cur){'Cyan'}else{'DarkGray'}
      Write-Host "  $marker [$($i+1)] " -NoNewline -ForegroundColor $color
      Write-Host $opts[$i] -ForegroundColor $color
    }
  }
  Show-Choices $cursor $Options
  $optTop = [Console]::CursorTop - $Options.Count
  $cancel = $false
  while($true){
    $key = [Console]::ReadKey($true)
    if($key.Key -eq 'Enter'){ break }
    if($key.Key -eq 'Escape'){ $cancel=$true; break }
    if($key.Key -eq 'UpArrow'){ $cursor = if($cursor -gt 0){$cursor-1}else{$Options.Count-1} }
    elseif($key.Key -eq 'DownArrow'){ $cursor = if($cursor -lt $Options.Count-1){$cursor+1}else{0} }
    else { $num=[int]$key.KeyChar-[int][char]'0'; if($num -ge 1 -and $num -le $Options.Count){ $cursor=$num-1 } }
    [Console]::SetCursorPosition(0,$optTop); Show-Choices $cursor $Options
  }
  [Console]::CursorVisible = $true
  return $(if($cancel){-1}else{$cursor})
}

# Yes/No: ● 是 / ○ 否, ←→ 或 Y/N 切换, Enter 确认。返回 $bool。
function Read-Confirm {
  param([string]$Prompt,[bool]$Default=$true)
  Write-Host ''
  Write-Host '  ◆ ' -NoNewline -ForegroundColor Yellow
  Write-Host $Prompt -ForegroundColor White
  [Console]::CursorVisible = $false
  $sel = $Default
  function Show-Opt { param([bool]$s)
    $yDot = if($s){'●'}else{'○'}; $nDot = if(-not $s){'●'}else{'○'}
    $yC = if($s){'Green'}else{'DarkGray'}; $nC = if(-not $s){'Red'}else{'DarkGray'}
    Write-Host '    ' -NoNewline
    Write-Host "$yDot 是" -NoNewline -ForegroundColor $yC
    Write-Host '  /  ' -NoNewline -ForegroundColor DarkGray
    Write-Host "$nDot 否  " -ForegroundColor $nC
  }
  Show-Opt $sel
  $optTop = [Console]::CursorTop - 1
  while($true){
    $key = [Console]::ReadKey($true)
    if($key.Key -eq 'Enter'){ break }
    if($key.Key -eq 'LeftArrow' -or $key.KeyChar -eq 'Y' -or $key.KeyChar -eq 'y'){ $sel=$true }
    elseif($key.Key -eq 'RightArrow' -or $key.KeyChar -eq 'N' -or $key.KeyChar -eq 'n'){ $sel=$false }
    [Console]::SetCursorPosition(0,$optTop); Show-Opt $sel
  }
  [Console]::CursorVisible = $true
  return $sel
}

# 粗估解算耗时 (条数 / 速率 -> 人读字符串)。
function Estimate($count,$rate){
  if($count -le 0 -or $rate -le 0){ return '0s' }
  $sec = $count / $rate
  if($sec -lt 90){ return ('{0}s' -f [int]$sec) }
  if($sec -lt 5400){ return ('{0}min' -f [int][Math]::Round($sec/60)) }
  return ('{0}h' -f [Math]::Round($sec/3600,1))
}

# 交互向导: 取数后调。扫描各变体待补 -> 弹问题(变体/每变体几块/是否发布)-> 总览确认。
# 返回 @{Variants;MaxChunks;NoPublish} 套用到主流程; 取消返回 $null。
function Invoke-CrossWizard([int]$nNew){
  $order    = @('eo','pseudo','pseudo_pair','pair','f2leo','pseudo_f2leo','222','roux','223','eoline','dr','f2b')
  $coreFast = @('eo','pseudo','pseudo_pair')   # [D] 快速收窄到的"核心快"组; 全 6 现都是默认, 向导初始全勾选
  Write-Host "`n================ 交互向导 ================" -ForegroundColor Magenta
  Write-Host ("新 std 打乱: {0} 条  (≈{1} 解算)" -f $nNew,(Estimate $nNew 115)) -ForegroundColor White
  Write-Host '扫描各变体待补 (行数比对) ...' -ForegroundColor DarkGray
  # 变体 id 恒是 master 子集(只从 master 锁步补缺), 故 待补 = master 行数 - 变体已有行数。
  # 纯行数, 免逐行建 HashSet + 6x130 万次 Contains 的解释循环(那会静默卡几分钟)。survey 是估值, Sync-Variant 跑时仍做精确 diff。
  $masterN = if(Test-Path $MasterTxt){ Lc $MasterTxt } else { 0 }
  $miss=@{}
  foreach($v in $order){
    $csv = Join-Path $ScrambleDir "stats\$v.csv"
    if(-not (Test-Path $csv)){ $miss[$v]=-1; continue }
    $m = $masterN - ((Lc $csv) - 1)   # 减表头
    $miss[$v] = [Math]::Max($m, 0)
  }
  # ---- Q1 变体 (多选) ----
  $vItems = @()
  $ki = 1
  foreach($v in $order){
    $isCore = $coreFast -contains $v
    if($miss[$v] -lt 0){ $note = 'CSV 不存在' }
    else { $proj = $miss[$v] + $nNew; $note = ("待补 {0}  +新std {1}  ≈{2}" -f $miss[$v],$proj,(Estimate $proj $VARIANT_RATE[$v])) }
    $vItems += @{ Name=$v; Key="$ki"; Selected=$true; Group=$(if($isCore){'core'}else{'heavy'}); Note=$note }
    $ki++
  }
  $ok = Read-MultiSelect -Prompt '补哪些变体?' -Items $vItems `
    -GroupShortcuts @{ D=@{Group='core';Label='核心快(eo系)'}; O=@{Group='heavy';Label='重型(pair/f2leo系)'} }
  if(-not $ok){ return $null }   # Esc 取消
  $chosen = @($vItems | Where-Object { $_.Selected } | ForEach-Object { $_.Name })

  # ---- Q2 每变体几块 (单选) ----
  $ci = Read-SingleSelect -Prompt '每个变体最多跑几块就停?' -Options @(
    '补满 (一次补到与 master 齐)',
    '每变体 1 块 (跑一块就停, 余下次续)',
    '每变体 2 块',
    '每变体 5 块'
  ) -Default 0
  if($ci -eq -1){ return $null }
  $maxc = @(0,1,2,5)[$ci]

  # ---- Q3 是否发布 (Yes/No) ----
  $pub = Read-Confirm -Prompt '跑完发布 (commit + push 触发 Vercel + scp static)?' -Default $true

  # ---- 总览 + 最终确认 ----
  Write-Host ''
  Write-Host '  ◆ ' -NoNewline -ForegroundColor Yellow
  Write-Host '计划' -ForegroundColor White
  if($nNew -gt 0){ Write-Host ("    std        : 解算+追加 {0} 条 (≈{1})" -f $nNew,(Estimate $nNew 115)) -ForegroundColor Gray }
  else           { Write-Host '    std        : 无新打乱' -ForegroundColor Gray }
  if($chosen.Count){
    foreach($v in $chosen){
      $proj = [Math]::Max(($miss[$v]),0) + $nNew
      $chunk = $VARIANT_CHUNK[$v]
      $run = if($maxc -gt 0){ [Math]::Min($proj, $maxc*$chunk) } else { $proj }
      $note = if($maxc -gt 0 -and $run -lt $proj){ " (本次 $run, 余 $($proj-$run) 下次续)" } else { '' }
      Write-Host ("    {0,-11}: 补 {1} 条 ≈{2}{3}" -f $v,$run,(Estimate $run $VARIANT_RATE[$v]),$note) -ForegroundColor Gray
    }
  } else { Write-Host '    变体       : 不补' -ForegroundColor Gray }
  Write-Host ("    发布       : {0}" -f $(if($pub){'是 (push + scp static)'}else{'否 (仅本地)'})) -ForegroundColor Gray
  $go = Read-Confirm -Prompt '开始?' -Default $true
  if(-not $go){ return $null }
  return @{ Variants=$chosen; MaxChunks=$maxc; NoPublish=(-not $pub) }
}

# ---- 作业选择 (一条龙: stages / 333opt / puzzles) ----
$runStages  = ($Jobs -contains 'all') -or ($Jobs -contains 'stages')
$run333opt  = ($Jobs -contains 'all') -or ($Jobs -contains '333opt')
$runPuzzles = ($Jobs -contains 'all') -or ($Jobs -contains 'puzzles')
if($Wizard){
  $jItems = @(
    @{ Name='stages  3x3 阶段难度 (十字/F2L/EO/DR…)'; Key='1'; Selected=$runStages },
    @{ Name='333opt  整解最优 HTM'; Key='2'; Selected=$run333opt },
    @{ Name='puzzles 非3x3 (二阶/金字塔/斜转/SQ1)'; Key='3'; Selected=$runPuzzles }
  )
  if(-not (Read-MultiSelect -Prompt '跑哪些作业?' -Items $jItems)){ Write-Host '已取消。' -ForegroundColor Yellow; return }
  $runStages  = [bool]$jItems[0].Selected
  $run333opt  = [bool]$jItems[1].Selected
  $runPuzzles = [bool]$jItems[2].Selected
}
Write-Host ("作业: {0}" -f ((@(if($runStages){'stages'}; if($run333opt){'333opt'}; if($runPuzzles){'puzzles'})) -join ' + ')) -ForegroundColor Cyan

# ===== JOB: stages (3x3 阶段难度: 取数 + std + 变体) =====
$nNew = 0; $stdChanged = $false; $variantChanged = $false
if($runStages){
# ---- 1. 增量取数 ----
if($PublishOnly){
  Write-Host "[PublishOnly] 跳过取数/解算/变体补缺, 直接重算+发布当前 CSV 状态。" -ForegroundColor Yellow
  $nNew = 0; $stdChanged = $false; $variantChanged = $true
} else {
Step '1 增量取数 (results export -> 新打乱)'
if($SkipSolve){
  # 调试: incremental 启动会清掉上次 solver 产出, 故 -SkipSolve 时连它一起跳过, 复用上次
  # new_no_wide_move.txt + new_no_wide_move_std.csv 直接走追加/变体/发布 (不重算 diff)。
  Write-Host '[SkipSolve] 跳过 incremental.py, 复用上次取数 + std solver 产出 (调试)。' -ForegroundColor Yellow
} else {
  # 向导: 取数前先问 TSV 来源(下载官方最新 / 用本地缓存不联网)。仅当 cache 里确有可用 zip 才问。
  if($Wizard -and -not $SourceCsv){
    $cz = if(Test-Path $CacheDir){
      Get-ChildItem (Join-Path $CacheDir 'WCA_export_*.tsv.zip') -ErrorAction SilentlyContinue |
        Where-Object { $_.Length -gt 1MB } | Sort-Object Name -Descending | Select-Object -First 1
    } else { $null }
    if($cz){
      $czMb = [math]::Round($cz.Length/1MB,0)
      $czDate = ($cz.BaseName -replace '^WCA_export_','' -replace '\.tsv$','')
      $ti = Read-SingleSelect -Prompt 'TSV 来源' -Options @(
        '下载官方最新 export (联网, 按 export_date 缓存)',
        "用本地缓存 $czDate ($czMb MB, 不联网)"
      ) -Default 0
      if($ti -eq -1){ Write-Host '已取消, 未改动任何 master/JSON。' -ForegroundColor Yellow; return }
      if($ti -eq 1){ $UseCached = $true; Write-Host "  -> 用本地缓存 $czDate" -ForegroundColor DarkGray }
      else { Write-Host '  -> 下载官方最新 export' -ForegroundColor DarkGray }
    } else {
      Write-Host '  本地 cache 无可用 export, 将下载官方最新。' -ForegroundColor DarkGray
    }
  }
  $incrPy = Join-Path $PSScriptRoot 'incremental.py'   # 脚本在仓库内(进 git), 数据目录走 --data-dir 注入
  $incrArgs = @('run','--project',$ScrambleDir,'python',$incrPy,'--data-dir',$ScrambleDir)
  if($SourceCsv){ $incrArgs += @('--source-csv',$SourceCsv) }
  if($UseCached){ $incrArgs += '--use-cached' }   # 不联网, 用 cache/ 最新 zip
  if($DryRun){ $incrArgs += '--dry-run' }   # 严格只读: 不覆写 competitions.tsv 等 master
  & uv @incrArgs
  if($LASTEXITCODE -ne 0){ throw 'incremental.py 失败' }
}

$newTxt = Join-Path $IncrDir 'new_no_wide_move.txt'
$nNew = if((Test-Path $newTxt) -and (Lc $newTxt) -gt 0){ Lc $newTxt } else { 0 }
Write-Host "新打乱(去宽层后)行数: $nNew"

# 交互向导(裸跑+真人终端 或 -Interactive): 取数后弹问题, 把选择套回 $Variants/$MaxChunks/$NoPublish。
if($Wizard){
  $plan = Invoke-CrossWizard $nNew
  if($null -eq $plan){ Write-Host '已取消, 未改动任何 master/JSON。' -ForegroundColor Yellow; return }
  $Variants  = $plan.Variants
  $MaxChunks = $plan.MaxChunks
  $NoPublish = [bool]$plan.NoPublish
}

# -DryRun: 只读, 算完 delta 立即停, 绝不碰 master / JSON / 不发布 / 不补变体
if($DryRun){ Write-Host "[DryRun] 将处理 $nNew 条新打乱; 不动任何 master/JSON/变体/不发布。" -ForegroundColor Yellow; return }

# ---- 2/3. std solver + 追加 master (只在有新打乱时) ----
$stdChanged = $false
if($nNew -gt 0){
  Step "2 std_analyzer 解算 $nNew 条 (cross..xxxxcross x 6 底色)"
  $stdOut = Join-Path $IncrDir 'new_no_wide_move_std.csv'
  if(-not $SkipSolve){
    $env:CUBE_TABLE_DIR        = Join-Path $SolverDir 'tables'
    $env:CUBE_ALLOW_HUGE_TABLES = '1'
    $env:CUBE_RUN_FULL_STD      = '1'
    $newTxt | & $StdAnalyzer    # stdin=文件名; [PROG] N/total 直接打到终端
    if($LASTEXITCODE -ne 0){ throw 'std_analyzer 失败' }
  }
  if(-not (Test-Path $stdOut)){ throw "solver 没产出 $stdOut" }
  $gotRows = (Lc $stdOut) - 1
  if($gotRows -ne $nNew){ throw "solver 输出行数 $gotRows != 输入 $nNew" }

  Step '3 追加 std.csv / no_wide_move.txt / split_mbf.csv'
  $std = Join-Path $ScrambleDir 'stats\std.csv'
  $old = Lc $std
  AppendData $std $stdOut $true
  AppendData $MasterTxt $newTxt $false   # master 更新后, 变体补缺即以它为基准
  AppendData (Join-Path $ScrambleDir 'input\wca_scrambles_split_mbf.csv') (Join-Path $IncrDir 'new_split_mbf.csv') $true
  Write-Host "std.csv: $old -> $(Lc $std) (+$nNew)"
  $stdChanged = $true
} else {
  Write-Host '没有新打乱; 跳过 std 解算/追加, 继续变体补缺。' -ForegroundColor Yellow
}

# ---- 4. 变体补缺 (eo/pseudo/pseudo_pair/pair/f2leo 系 各自跟 master 锁步, 可中断续跑) ----
$variantChanged = $false
if($Variants.Count -gt 0){
  Step "4 变体补缺: $($Variants -join ', ')"
  if(-not (Test-Path $MasterTxt)){ throw "master $MasterTxt 不存在" }
  foreach($v in $Variants){
    if(Sync-Variant $v){ $variantChanged = $true }
  }
} else {
  Write-Host '未指定变体补缺 (-Variants @())。' -ForegroundColor DarkGray
}
}
} # /JOB stages

# ===== JOB: puzzles (非 3x3 整解: 二阶/金字塔/斜转/SQ1) =====
$puzzleChanged = $false
if($runPuzzles){
  Step "P 非3x3 puzzles 整解: $($Puzzles -join ', ')"
  pwsh (Join-Path $PSScriptRoot 'update_puzzle_stats.ps1') -Puzzles $Puzzles
  if($LASTEXITCODE -ne 0){ throw 'update_puzzle_stats.ps1 失败' }
  Push-Location (Join-Path $RepoRoot 'core\packages\scramble-stats-build')
  try {
    pnpm exec tsx src/build_puzzle_examples.ts
    if($LASTEXITCODE -ne 0){ throw 'build_puzzle_examples 失败' }
    # puzzle 整解步数「首次出现」时间线(puzzle_first_appearance.json):每步数 bin 最早一条比赛打乱
    pnpm exec tsx src/build_puzzle_first_appearance.ts
    if($LASTEXITCODE -ne 0){ throw 'build_puzzle_first_appearance 失败' }
    # /timer「原始/最优打乱」用:产 wca_optimal_puzzle.csv(自然键 + 最优等态打乱)。
    # 灌库是手动一步(同 3x3 export_optimal):\copy 到 prod wca_scramble_optimal(见末尾提示)。
    node export_puzzle_optimal.mjs
    if($LASTEXITCODE -ne 0){ throw 'export_puzzle_optimal 失败' }
  } finally { Pop-Location }
  $puzzleChanged = $true
}

# ===== JOB 附带: 近期打乱(全项目) recent_scrambles_events.json =====
# id-watermark 批次(复刻 333 的"本次 export 新增"概念到所有项目): 长度分桶(全项目) + 222/金字塔/斜转
# 难度分桶(整解最优步数, join puzzle CSV)。首页 RecentScrambles 选了非 333 项目时读这份。
# 须在 puzzles 之后(难度 join 要最新 puzzle CSV)、发布之前。只要跑了 stages(刷新 Scrambles.tsv)或 puzzles 就跑。
$eventsChanged = $false
if($runStages -or $runPuzzles){
  Step 'E 近期打乱(全项目) — build:recent-scrambles-events (长度全项目 + 222/金字塔/斜转难度)'
  $env:SCRAMBLE_STATS_STAMP = if(Test-Path (Join-Path $IncrDir 'export_date.txt')){ (Get-Content (Join-Path $IncrDir 'export_date.txt') -Raw).Trim() } else { Get-Date -Format 'yyyy-MM-dd' }
  Push-Location (Join-Path $RepoRoot 'core')
  try {
    pnpm --filter @cuberoot/scramble-stats-build build:recent-scrambles-events
    if($LASTEXITCODE -ne 0){ throw 'build:recent-scrambles-events 失败' }
  } finally { Pop-Location }
  $eventsChanged = $true
}

# 333opt inject: stages 的 build 会覆写 distribution/examples 的 '333' 变体, 故 stages build 一跑就必须补 inject 还原;
# 用户单点 333opt 也跑。实际跑在步骤 5 之后(必须在 build 之后)。
$optChanged = $false
$willInject = $run333opt -or ($runStages -and ($stdChanged -or $variantChanged))

if(-not $stdChanged -and -not $variantChanged -and -not $willInject -and -not $puzzleChanged -and -not $eventsChanged){
  Step '无任何数据变化, 结束。'
  return
}

# ---- 5. 重算 JSON (stages: RNG 固定种子 + 稳定时间戳, 同一份数据重跑逐字节不变) ----
$stamp = if(Test-Path (Join-Path $IncrDir 'export_date.txt')){ (Get-Content (Join-Path $IncrDir 'export_date.txt') -Raw).Trim() } else { Get-Date -Format 'yyyy-MM-dd' }
$env:SCRAMBLE_STATS_STAMP = $stamp
if($stdChanged -or $variantChanged){
  $extra = ''
  if($stdChanged){ $extra += ' + wca_cross' }
  $extra += ' + comp-steps'
  Step "5 重算 distribution.json$extra (stamp=$stamp)"
  Push-Location (Join-Path $RepoRoot 'core')
  try {
    pnpm --filter @cuberoot/scramble-stats-build build      # distribution.json 读全部变体, 任一变 -> 必重算
    if($LASTEXITCODE -ne 0){ throw 'build (distribution) 失败' }
    # 「首次出现」时间线(difficulty_first_appearance.json + per-event 分片): 读全部变体 + competitions.tsv 日期, 同 distribution 一起重算
    pnpm --filter @cuberoot/scramble-stats-build build:first-appearance
    if($LASTEXITCODE -ne 0){ throw 'build:first-appearance 失败' }
    if($stdChanged){
      # wca_cross 只依赖 std cross 步数 + 比赛元数据, 只在有新 std 时重算
      pnpm --filter @cuberoot/scramble-stats-build build:wca-cross
      if($LASTEXITCODE -ne 0){ throw 'build:wca-cross 失败' }
    }
    # 每场预计算表(gen 页秒出), gitignore+只 scp。任一变体(含 std)CSV 变 -> 对应 comp_steps_<v> 需重算。
    pnpm --filter @cuberoot/scramble-stats-build build:comp-steps
    if($LASTEXITCODE -ne 0){ throw 'build:comp-steps 失败' }
    if($nNew -gt 0 -or $variantChanged){
      # 近期打乱(recent_scrambles.json): 最近一批新增里各 (变体×类型×底色) 最简单的, 给首页 RecentScrambles。须在步骤4之后。
      pnpm --filter @cuberoot/scramble-stats-build build:recent-scrambles
      if($LASTEXITCODE -ne 0){ throw 'build:recent-scrambles 失败' }
    }
  } finally { Pop-Location }
}

# ---- 5b. 333opt inject (必须在 stages build 之后: build 会覆写 distribution/examples 的 '333' 变体, 这里还原/更新) ----
if($willInject){
  $has333 = @(Get-ChildItem (Join-Path $SolverDir '333opt') -Filter 'out.*.csv' -ErrorAction SilentlyContinue).Count -gt 0
  if($has333){
    Step '5b 注入 333 整解最优 (variant 333) — node solver/333opt/inject.mjs'
    node (Join-Path $SolverDir '333opt\inject.mjs')
    if($LASTEXITCODE -ne 0){ throw '333opt inject.mjs 失败' }
    # 首次出现时间线: 把 333 整解按比赛日期折成每 htm 步数最早一条, 注入 difficulty_first_appearance.json
    # (stages build 会覆写该文件 → 必须在 build:first-appearance 之后还原, 与 inject.mjs 同位)
    Step '5b 注入 333 整解首次出现 — node solver/333opt/inject_first_appearance.mjs'
    node (Join-Path $SolverDir '333opt\inject_first_appearance.mjs')
    if($LASTEXITCODE -ne 0){ throw '333opt inject_first_appearance.mjs 失败' }
    $optChanged = $true
    # 同步产 /timer 最优打乱 CSV(invert(最优解), 同态 333/oh/ft/fm), 供步骤 6b 自动灌库
    Step '5b+ 导出 /timer 333 最优打乱 — node solver/333opt/export_optimal.mjs'
    node (Join-Path $SolverDir '333opt\export_optimal.mjs')
    if($LASTEXITCODE -ne 0){ throw '333opt export_optimal.mjs 失败' }
  } else {
    Write-Host '[333opt] 无 out.*.csv (没跑过 solve_loop), 跳过 inject。' -ForegroundColor DarkGray
  }
}

# ---- 5c. 长度 tab「原始/最优」overlay (event_length_examples_opt.json) ----
# 给长度 tab 样例打乱算最优等态打乱(3x3 面转族走 cube48opt5,222/pyram/skewb 走 analyzer)。
# 增量(跳过已解),依赖本地 opt 表 + analyzer;缺则脚本内部自动跳过对应类。
if($runStages -or $runPuzzles){
  Step '5c 长度 tab 最优 overlay — node build_length_opt.mjs (增量)'
  Push-Location (Join-Path $RepoRoot 'core\packages\scramble-stats-build')
  try {
    node build_length_opt.mjs
    if($LASTEXITCODE -ne 0){ Write-Host '[length-opt] 失败(非致命, 跳过)' -ForegroundColor Yellow }
  } finally { Pop-Location }
}

# ---- 5d. 难度 tab「下载全部」全量语料 gz (bundles/;依赖 std.csv,故跟 stages) ----
if($runStages){
  Step '5d 全量语料下载包 — node build_scramble_bundle.mjs (~30MB/阶段, gitignored 只 scp)'
  Push-Location (Join-Path $RepoRoot 'core\packages\scramble-stats-build')
  try {
    node --max-old-space-size=3072 build_scramble_bundle.mjs
    if($LASTEXITCODE -ne 0){ Write-Host '[bundle] 失败(非致命, 跳过)' -ForegroundColor Yellow }
  } finally { Pop-Location }
}

# ---- 6. 发布 ----
if($NoPublish){
  Step '6 发布 (跳过)'
} else {
  Step '6 commit & push + 发布 static'
  git -C $RepoRoot pull --rebase --autostash origin main
  if($LASTEXITCODE -ne 0){ throw 'git pull --rebase 失败 (可能冲突, 仓库可能停在 rebase 中, 别继续 push)' }
  git -C $RepoRoot add stats/scramble
  if(git -C $RepoRoot status --porcelain stats/scramble){
    $parts = @($stamp)
    if($stdChanged){ $parts += "+$nNew scrambles" }
    if($variantChanged){ $parts += "variants: $($Variants -join '/')" }
    if($optChanged){ $parts += '333-optimal' }
    if($puzzleChanged){ $parts += "puzzles: $($Puzzles -join '/')" }
    if($eventsChanged){ $parts += 'recent-events' }
    git -C $RepoRoot commit -m "chore(scramble-stats): incremental refresh ($($parts -join ', '))"
    if($LASTEXITCODE -ne 0){ throw 'git commit 失败' }
    git -C $RepoRoot push origin main
    if($LASTEXITCODE -ne 0){ throw 'git push 失败' }
    # ---- static 发布 ----
    # 无 stages 的小作业(333opt/puzzles 只重写几个 tracked JSON)增量发布:只 scp 变化的文件,
    # 跳过整包 ~467MB tar(31min)。gitignored 的下载包/comp_steps 仅 stages 会变,故非 stages 跑里
    # `git status` 即完整变更集。stages 仍走整目录原子替换(文件可能新增/消失,整包最稳)。
    if(-not $runStages){
      $deltaRel = @(git -C $RepoRoot status --porcelain stats/scramble |
        ForEach-Object { if($_.Length -gt 3){ $_.Substring(3).Trim().Trim('"') } } |
        Where-Object { $_ -like 'stats/scramble/*' } |
        ForEach-Object { $_ -replace '^stats/scramble/','' } |
        Select-Object -Unique)
      Write-Host "  [delta] 无 stages,增量发布 $($deltaRel.Count) 个文件 -> static(跳过整包 tar)" -ForegroundColor DarkCyan
      foreach($f in $deltaRel){
        $lp = Join-Path $RepoRoot "stats/scramble/$f"
        if(-not (Test-Path $lp)){ continue }
        $kb = [math]::Round((Get-Item $lp).Length/1KB,1)
        Write-Host "        scp $f (${kb} KB) -> .tmp + 远端原子 mv ..." -ForegroundColor DarkGray
        $rdir = (Split-Path "scramble/$f" -Parent) -replace '\\','/'
        ssh $StaticHost "mkdir -p '${StaticDest}/$rdir'"
        scp $lp "${StaticHost}:${StaticDest}/scramble/${f}.tmp"
        if($LASTEXITCODE -ne 0){ throw "[delta] scp $f 失败" }
        ssh $StaticHost "mv -f '${StaticDest}/scramble/${f}.tmp' '${StaticDest}/scramble/$f'"
        if($LASTEXITCODE -ne 0){ throw "[delta] 远端 mv $f 失败" }
      }
      Write-Host "  [delta] 增量发布完成 ($($deltaRel -join ', '))。" -ForegroundColor DarkCyan
    } else {
    # 发布 stats/scramble 到 static: 打成单个 .tgz -> scp 一个文件(二进制安全, 不走 pwsh 管道)
    # -> 远端原子替换。比 scp -r 逐个传 ~1.5w 小文件快一个量级。
    $tgz = Join-Path $env:TEMP 'cuberoot_scramble_publish.tgz'
    Write-Host "  [1/3] tar 打包 stats/scramble ..." -ForegroundColor DarkCyan
    $t0 = Get-Date
    Remove-Item $tgz -Force -ErrorAction SilentlyContinue
    # tar 异步起进程 + 主线程每 5s 打当前压缩字节数(Start-Job 里 Write-Host 会被缓冲到
    # Receive-Job 才出, 看不到实时进度, 所以用主线程轮询)。上次全量 ~280MB 可对照估完成度。
    $tarP = Start-Process tar -ArgumentList '-czf',$tgz,'-C',(Join-Path $RepoRoot 'stats'),'scramble' -NoNewWindow -PassThru
    while(-not $tarP.HasExited){
      Start-Sleep -Seconds 5
      if(Test-Path $tgz){
        $cur = [math]::Round((Get-Item $tgz).Length/1MB,1)
        Write-Host ("        tar ... {0} MB ({1}s)" -f $cur, [int]((Get-Date)-$t0).TotalSeconds) -ForegroundColor DarkGray
      }
    }
    if($tarP.ExitCode -ne 0){ throw 'tar 打包失败' }
    $mb = [math]::Round((Get-Item $tgz).Length/1MB,1)
    Write-Host "  [1/3] tar 完成 ${mb} MB (用时 $([int]((Get-Date)-$t0).TotalSeconds)s)" -ForegroundColor DarkCyan
    # scp 单次网络传输, 非 TTY 下无内置进度条; 故起一个后台 poller 每 3s 读远端 _publish.tgz 大小, 打 N/total MB。
    Write-Host "  [2/3] scp ${mb} MB -> static (开始 $(Get-Date -Format HH:mm:ss)) ..." -ForegroundColor DarkCyan
    $t1 = Get-Date
    $poller = Start-Job -ArgumentList $StaticHost,$StaticDest,$mb -ScriptBlock {
      param($h,$d,$total)
      while($true){
        Start-Sleep -Seconds 3
        $sz = ssh $h "stat -c %s '$d/_publish.tgz' 2>/dev/null || echo 0" 2>$null
        $cur = [math]::Round(([double]($sz)) / 1MB, 1)
        if($cur -gt 0){ Write-Host "        scp ... ${cur}/${total} MB" -ForegroundColor DarkGray }
      }
    }
    scp $tgz "${StaticHost}:${StaticDest}/_publish.tgz"
    $scpExit = $LASTEXITCODE
    Stop-Job $poller -ErrorAction SilentlyContinue; Receive-Job $poller -ErrorAction SilentlyContinue; Remove-Job $poller -Force -ErrorAction SilentlyContinue
    if($scpExit -ne 0){ throw 'scp tgz 失败' }
    $sec = [Math]::Max([int]((Get-Date)-$t1).TotalSeconds, 1)
    Write-Host "  [2/3] scp 完成 (用时 ${sec}s, ~$([math]::Round($mb/$sec,1)) MB/s)" -ForegroundColor DarkCyan
    # 原子替换 + 清理孤儿: 解到 scramble.new -> 换上 (旧的暂留 scramble.prev 兜底) -> 删旧 + tgz。
    # 直接覆盖式 untar 不删"本次不再产出"的旧文件(如某 bin 样本数超 1000 不再出 txt), 故整目录替换。
    Write-Host "  [3/3] 远端原子替换 + 解包 ..." -ForegroundColor DarkCyan
    ssh $StaticHost "set -e; cd '${StaticDest}'; rm -rf scramble.new scramble.prev; mkdir scramble.new; tar -xzf _publish.tgz -C scramble.new --strip-components=1; if [ -d scramble ]; then mv scramble scramble.prev; fi; mv scramble.new scramble; rm -rf scramble.prev _publish.tgz"
    if($LASTEXITCODE -ne 0){ throw '远端原子替换失败' }
    Write-Host "  [3/3] 远端替换完成。" -ForegroundColor DarkCyan
    Remove-Item $tgz -Force -ErrorAction SilentlyContinue
    }
  } else { Write-Host 'stats/scramble 无变化, 跳过 commit。' -ForegroundColor Yellow }
}

# ---- 6b. /timer 最优打乱 -> prod PG (自动灌库, 同发布步, 不再手动 \copy) ----
# 数据走 PG wca_scramble_optimal(非 static), 故跟 static 发布并列;-NoPublish 一并跳过。
# 333 export 在 5b+ 已产 wca_optimal.csv;puzzle export 在 puzzles 作业内产 wca_optimal_puzzle.csv。
if($NoPublish){
  if($optChanged -or $puzzleChanged){
    Write-Host ''
    Write-Host '[timer 最优打乱] -NoPublish: 已产 CSV 但未灌库 (wca_optimal.csv / wca_optimal_puzzle.csv)。去掉 -NoPublish 即自动上线。' -ForegroundColor Yellow
  }
} elseif($optChanged -or $puzzleChanged){
  Step '6b /timer 最优打乱灌库 -> prod PG wca_scramble_optimal (按项目整批替换)'
  if($optChanged){
    Load-OptimalToPg (Join-Path $SolverDir '333opt\wca_optimal.csv') '333' "'333','333oh','333ft','333fm'"
  }
  if($puzzleChanged){
    Load-OptimalToPg (Join-Path $RepoRoot 'core\packages\scramble-stats-build\wca_optimal_puzzle.csv') 'puzzle' "'222','pyram','skewb'"
  }
}

Step ("完成 (std +{0}; 变体 {1}; 333opt {2}; puzzles {3})" -f $nNew, $(if($variantChanged){$Variants -join '/'}else{'-'}), $(if($optChanged){'是'}else{'-'}), $(if($puzzleChanged){$Puzzles -join '/'}else{'-'}))
