#!/usr/bin/env pwsh
# WCA 十字步数分布 手动增量刷新管道 (按需触发, 非定时; 仅本地: 需 solver 的 ~34GB 表 + ~16GB 内存余量)
#
# 一键:        pwsh update_cross_stats.ps1          (真人终端裸跑 -> 开场先问「一键全跑 / 逐项自定义」: 选一键 = 后续 0 交互,
#                                                   全作业 + 下载最新 export + 全变体补满 + 发布; AI/非交互终端 -> 直接一键直跑, 不弹)
# 一条龙(默认):pwsh update_cross_stats.ps1          (= -Jobs all: stages 3x3阶段难度 + 333opt 整解最优 + puzzles 非3x3, 共享一次发布)
# 只跑某作业:  pwsh update_cross_stats.ps1 -Jobs 333opt        (任选 stages/333opt/puzzles; 多个: -Jobs stages,puzzles)
# 选 puzzle:   pwsh update_cross_stats.ps1 -Jobs puzzles -Puzzles sq1
#   注: 333opt = 先求解(solve_loop 把 master 池没解的 333 整解最优补齐, 续跑可断点)再 inject(折 out.0.csv)。
#       首次全量 ~3.5 天(15G opt9 表, 12 线程, ~4/s), 之后每次只补增量缺口(快)。只想 inject 不求解加 -SkipSolve333。
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
  [switch]$SkipSolve333,  # 跳过 333opt 整解最优求解(solve_loop), 只 inject 当前 out.0.csv(快路径: 已解部分直接发布)
  [string[]]$Variants = @('eo','pseudo','pseudo_pair','pair','f2leo','pseudo_f2leo','222','roux','223','eoline','dr','f2b'),  # 跟 std 锁步补缺的全部 12 变体 (@()=只 std)。瓶颈始终是 eo ~0.9/s; 想快跑显式 -Variants eo,pseudo,pseudo_pair 跳过重型
  [int]$ChunkSize = 20000, # 显式传则覆盖所有变体的分块大小; 不传则用每变体默认(见 $VARIANT_CHUNK: eo/pair=2000, 其余=20000)。逐块追加, 中断只丢当前块
  [int]$MaxChunks = 0,     # >0: 每个变体最多跑 N 块就停, 之后照常重算+发布(还差的下次 run 自动续)。0=补满。用于"只跑一两块"而无需人工盯/中途 kill
  [switch]$PublishOnly,    # 跳过取数/解算/变体, 直接用当前 CSV 状态重算 distribution+comp-steps 并发布(把已落盘但未发布的累积变更推上线)
  [switch]$Interactive,    # 强制走交互向导(取数后弹问题: 跑哪些变体 / 每变体几块 / 是否发布)。裸跑(无任何参数)且在交互终端时自动开; AI/带任意 flag/非交互终端(stdin 重定向)一律不弹, 行为同旧
  [switch]$UseCached,      # 取数用本地 cache/ 最新 export zip, 不联网下载/不查官方元数据(export_date 从文件名还原, stamp 仍稳定)。向导会先问这一步
  [ValidateSet('all','stages','333opt','puzzles')]
  [string[]]$Jobs = @('all'),   # 一条龙作业选择: stages(3x3阶段难度) / 333opt(整解最优HTM) / puzzles(非3x3) / all。AI 按用户"跑X/不跑Y"映射; 默认全跑
  [string[]]$Puzzles = @('222','pyraminx','skewb','sq1')   # puzzles 作业跑哪些非3x3 对象
)
$ErrorActionPreference = 'Stop'
$ChunkExplicit = $PSBoundParameters.ContainsKey('ChunkSize')  # 显式 -ChunkSize 覆盖每变体默认
# 真人终端 (AI 工具/CI/scheduled task 的 stdin 被重定向 -> IsInputRedirected=True)。向导 + 退出暂停都看它。
$HumanTerm = [Environment]::UserInteractive -and -not [Console]::IsInputRedirected
# 向导触发: 显式 -Interactive, 或裸跑(无参数)+ 真人终端。AI/非交互 -> 不弹, 保持旧一键。
$Wizard = $Interactive -or ($PSBoundParameters.Count -eq 0 -and $HumanTerm)
# UTF-8 控制台输出: 否则中文 Windows 默认 GBK(936) 码页下 ›/■/●/◆ 等非 GBK 字形被编成 ?。
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

# ---- 退出前别让窗口自己关 (双击 / Terminal profile 起的 pwsh 一退出就消失, 报错信息全看不到) ----
# 成功/失败都停在这;AI/CI/scheduled task (stdin 重定向) 不阻塞。
function Hold-Console {
  if(-not $HumanTerm){ return }
  Write-Host ''
  Write-Host '按 Enter 关闭窗口...' -ForegroundColor DarkGray
  try { [void][Console]::ReadLine() } catch {}
}
trap {
  Write-Host ''
  Write-Host "!! 失败: $_" -ForegroundColor Red
  if($_.ScriptStackTrace){ Write-Host $_.ScriptStackTrace -ForegroundColor DarkGray }
  Hold-Console
  exit 1
}

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
#
# 灌库全增量(2026-06-25): static 文件早已增量发布; PG 这条(optimal + steps)以前每次全量 DELETE+COPY /
# TRUNCATE 重灌(单次 ~270MB), 现也改行级 sha1 内容 diff —— 本地照常 build 全量 CSV(本地算力不计成本),
# 灌库时只 UPSERT 内容真变的行 + DELETE 已消失的自然键(典型增量几千行=KB 级)。manifest 存 incremental/,
# 仅在远端灌库成功后才落盘(失败则不更新, 下次重试)。无 manifest=基线: 走原全量路径并建基线。
# 想强制全量重建: 删对应 pg_*_manifest.tsv 即回退基线路径。
function Invoke-PgDiff {
  param([string]$Csv, [string]$Manifest, [int]$KeyCols = 6, [switch]$Header)
  $diff = Join-Path $PSScriptRoot 'pg_incremental_diff.mjs'
  $bn = [IO.Path]::GetFileNameWithoutExtension($Manifest)
  $delta = Join-Path $env:TEMP "${bn}_delta.csv"
  $deleted = Join-Path $env:TEMP "${bn}_deleted.txt"
  $newMan = "$Manifest.new"
  $argv = @('--csv',$Csv,'--manifest',$Manifest,'--key-cols',"$KeyCols",'--out-delta',$delta,'--out-deleted',$deleted,'--out-manifest',$newMan)
  if($Header){ $argv += '--header' }
  $json = & node $diff @argv
  if($LASTEXITCODE -ne 0){ throw "pg_incremental_diff 失败 ($Csv)" }
  [pscustomobject]@{ Stat = ($json | Select-Object -Last 1 | ConvertFrom-Json); DeltaCsv = $delta; DeletedTxt = $deleted; NewManifest = $newMan }
}
function Load-OptimalToPg {
  param([string]$LocalCsv, [string]$Tag, [string]$EventsInList)
  if(-not (Test-Path $LocalCsv)){ Write-Host "  [timer-optimal] ${Tag}: 缺 $LocalCsv, 跳过" -ForegroundColor DarkGray; return }
  $rows = (Lc $LocalCsv) - 1
  if($rows -le 0){ Write-Host "  [timer-optimal] ${Tag}: CSV 0 行, 跳过" -ForegroundColor DarkGray; return }
  $pwExpr = '$(grep -oP ''DB_PASS=\K.*'' /root/core-api/.env | tr -d ''[:space:]'')'
  $manifest = Join-Path $IncrDir "pg_optimal_${Tag}_manifest.tsv"
  $manifestExisted = Test-Path $manifest
  $d = Invoke-PgDiff -Csv $LocalCsv -Manifest $manifest -KeyCols 6 -Header
  $st = $d.Stat
  if($manifestExisted){
    if($st.deltaRows -eq 0 -and $st.deleted -eq 0){
      Write-Host "  [timer-optimal] ${Tag}: 无变化, 跳过 (manifest 命中全量 $rows 行)" -ForegroundColor DarkGray
      Move-Item -Force $d.NewManifest $manifest; Remove-Item $d.DeltaCsv,$d.DeletedTxt -Force -EA SilentlyContinue; return
    }
    Write-Host "  [timer-optimal] ${Tag}: 增量 UPSERT $($st.deltaRows) 行 + DELETE $($st.deleted) 键 (全量 $rows) ..." -ForegroundColor DarkCyan
    $remoteDelta="/root/_opt_${Tag}_delta.csv"; $remoteDel="/root/_opt_${Tag}_del.csv"; $remoteSql="/root/_opt_${Tag}.sql"
    $sql = @"
\set ON_ERROR_STOP on
BEGIN;
CREATE TEMP TABLE _opt_stage (LIKE wca_scramble_optimal) ON COMMIT DROP;
\copy _opt_stage (competition_id,event_id,round_type_id,group_id,is_extra,scramble_num,htm,optimal_scramble) FROM '$remoteDelta' WITH (FORMAT csv, HEADER true)
INSERT INTO wca_scramble_optimal AS t (competition_id,event_id,round_type_id,group_id,is_extra,scramble_num,htm,optimal_scramble)
  SELECT competition_id,event_id,round_type_id,group_id,is_extra,scramble_num,htm,optimal_scramble FROM _opt_stage
  ON CONFLICT (competition_id,event_id,round_type_id,group_id,is_extra,scramble_num)
  DO UPDATE SET htm=EXCLUDED.htm, optimal_scramble=EXCLUDED.optimal_scramble;
CREATE TEMP TABLE _opt_del (competition_id varchar(32), event_id varchar(6), round_type_id varchar(1), group_id varchar(3), is_extra smallint, scramble_num int) ON COMMIT DROP;
\copy _opt_del FROM '$remoteDel' WITH (FORMAT csv)
DELETE FROM wca_scramble_optimal t USING _opt_del d
  WHERE t.competition_id=d.competition_id AND t.event_id=d.event_id AND t.round_type_id=d.round_type_id AND t.group_id=d.group_id AND t.is_extra=d.is_extra AND t.scramble_num=d.scramble_num;
COMMIT;
SELECT count(*) AS wca_scramble_optimal_total FROM wca_scramble_optimal;
"@
    $localSql = Join-Path $env:TEMP "_opt_${Tag}.sql"
    [IO.File]::WriteAllText($localSql, ($sql -replace "`r`n","`n"), [Text.UTF8Encoding]::new($false))
    scp $d.DeltaCsv "${StaticHost}:$remoteDelta"; if($LASTEXITCODE -ne 0){ throw "[timer-optimal] $Tag delta scp 失败" }
    scp $d.DeletedTxt "${StaticHost}:$remoteDel"; if($LASTEXITCODE -ne 0){ throw "[timer-optimal] $Tag del scp 失败" }
    scp $localSql "${StaticHost}:$remoteSql"; if($LASTEXITCODE -ne 0){ throw "[timer-optimal] $Tag SQL scp 失败" }
    $remoteCmd = "PGPASSWORD=$pwExpr psql -U recon_user -h 127.0.0.1 -d cuberoot_db -v ON_ERROR_STOP=1 -f $remoteSql; rc=`$?; rm -f $remoteDelta $remoteDel $remoteSql; exit `$rc"
    ssh $StaticHost $remoteCmd
    if($LASTEXITCODE -ne 0){ throw "[timer-optimal] $Tag 增量灌库失败" }
    Remove-Item $localSql -Force -EA SilentlyContinue
  } else {
    $remoteCsv = "/root/_timer_optimal_$Tag.csv"; $remoteSql = "/root/_timer_optimal_$Tag.sql"
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
    Write-Host "  [timer-optimal] ${Tag}: 基线全量 scp $rows 行 + 整批替换 ($EventsInList) ..." -ForegroundColor DarkCyan
    scp $LocalCsv "${StaticHost}:$remoteCsv"; if($LASTEXITCODE -ne 0){ throw "[timer-optimal] $Tag CSV scp 失败" }
    scp $localSql "${StaticHost}:$remoteSql"; if($LASTEXITCODE -ne 0){ throw "[timer-optimal] $Tag SQL scp 失败" }
    $remoteCmd = "PGPASSWORD=$pwExpr psql -U recon_user -h 127.0.0.1 -d cuberoot_db -v ON_ERROR_STOP=1 -f $remoteSql; rc=`$?; rm -f $remoteCsv $remoteSql; exit `$rc"
    ssh $StaticHost $remoteCmd
    if($LASTEXITCODE -ne 0){ throw "[timer-optimal] $Tag psql 灌库失败" }
    Remove-Item $localSql -Force -EA SilentlyContinue
  }
  Move-Item -Force $d.NewManifest $manifest
  Remove-Item $d.DeltaCsv,$d.DeletedTxt -Force -EA SilentlyContinue
  Write-Host "  [timer-optimal] ${Tag}: 完成 (manifest 已更新, 全量 $rows 行)。" -ForegroundColor Green
}
# 难度 steps 索引 -> prod PG wca_scramble_steps(+ layout meta)。CSV 无 rnd 列:先 \copy 进临时表,
# 再 INSERT JOIN wca_scrambles 补 rnd(顺带丢掉云表暂无的自然键,即覆盖缺口)。layout 内联灌 meta 单行。
# DISTINCT ON(自然键): WCA dump 偶有同场同轮配两套 scramble(两 id / 同自然键, 如 CuboMaticaCuiaba2026 333),
#   _wss_stage 因此会有 2 行/自然键 -> JOIN 后撞 wca_scramble_steps 的自然键主键。DISTINCT ON 确定性收一行
#   (rnd 取自唯一的 canonical wca_scrambles 行), 任何比赛的同类重复都自动兜住, 不再灌库失败。
# 失败非致命(只警告不 throw):migration 0057 未部署到 prod 时这步会失败,部署后下次 run 自动灌上。
# 服务器密码从其自身 /root/core-api/.env 读,不把凭据写进(进 git 的)本脚本。
function Load-StepsToPg {
  param([string]$LocalCsv, [string]$LocalLayout, [string]$Stamp)
  if(-not (Test-Path $LocalCsv) -or -not (Test-Path $LocalLayout)){ Write-Host '  [steps] 缺 CSV/layout, 跳过灌库' -ForegroundColor DarkGray; return }
  $rows = (Lc $LocalCsv)
  $pwExpr = '$(grep -oP ''DB_PASS=\K.*'' /root/core-api/.env | tr -d ''[:space:]'')'
  # layout JSONB 内联(单引号字面串 + dollar-quote tag,避免 PowerShell/SQL 转义);json 内无 $/反引号
  $layout = ([IO.File]::ReadAllText($LocalLayout)).Trim()
  $metaIns = "INSERT INTO wca_scramble_steps_meta (id,layout,generated_at) VALUES (1, " + '$WSSL$' + $layout + '$WSSL$' + "::jsonb, '$Stamp') ON CONFLICT (id) DO UPDATE SET layout=EXCLUDED.layout, generated_at=EXCLUDED.generated_at;"
  $manifest = Join-Path $IncrDir 'pg_wss_manifest.tsv'
  $manifestExisted = Test-Path $manifest
  $d = Invoke-PgDiff -Csv $LocalCsv -Manifest $manifest -KeyCols 6   # steps CSV 无 header
  $st = $d.Stat
  if($manifestExisted){
    if($st.deltaRows -eq 0 -and $st.deleted -eq 0){
      Write-Host "  [steps] 无变化, 只刷新 meta (manifest 命中全量 $rows 行)" -ForegroundColor DarkGray
      $remoteSql='/root/_wss_meta.sql'
      $sql = "\set ON_ERROR_STOP on`nBEGIN;`n$metaIns`nCOMMIT;`n"
      $localSql = Join-Path $env:TEMP '_wss_meta.sql'
      [IO.File]::WriteAllText($localSql, ($sql -replace "`r`n","`n"), [Text.UTF8Encoding]::new($false))
      scp $localSql "${StaticHost}:$remoteSql" | Out-Null
      if($LASTEXITCODE -eq 0){ ssh $StaticHost "PGPASSWORD=$pwExpr psql -U recon_user -h 127.0.0.1 -d cuberoot_db -v ON_ERROR_STOP=1 -f $remoteSql; rc=`$?; rm -f $remoteSql; exit `$rc" | Out-Null }
      Remove-Item $localSql -Force -EA SilentlyContinue
      Move-Item -Force $d.NewManifest $manifest; Remove-Item $d.DeltaCsv,$d.DeletedTxt -Force -EA SilentlyContinue; return
    }
    Write-Host "  [steps] 增量 UPSERT $($st.deltaRows) 行 + DELETE $($st.deleted) 键 (全量 $rows) ..." -ForegroundColor DarkCyan
    $remoteDelta='/root/_wss_delta.csv'; $remoteDel='/root/_wss_del.csv'; $remoteSql='/root/_wss.sql'
    $sql = @"
\set ON_ERROR_STOP on
BEGIN;
CREATE TEMP TABLE _wss_stage (competition_id varchar(32), event_id varchar(6), round_type_id varchar(1), group_id varchar(3), is_extra smallint, scramble_num int, gm_cross6 smallint, gm_xcross6 smallint, steps smallint[]) ON COMMIT DROP;
\copy _wss_stage (competition_id,event_id,round_type_id,group_id,is_extra,scramble_num,gm_cross6,gm_xcross6,steps) FROM '$remoteDelta' WITH (FORMAT csv)
INSERT INTO wca_scramble_steps AS t (competition_id,event_id,round_type_id,group_id,is_extra,scramble_num,rnd,steps,gm_cross6,gm_xcross6)
  SELECT DISTINCT ON (s.competition_id,s.event_id,s.round_type_id,s.group_id,s.is_extra,s.scramble_num)
         s.competition_id,s.event_id,s.round_type_id,s.group_id,s.is_extra,s.scramble_num,w.rnd,s.steps,s.gm_cross6,s.gm_xcross6
  FROM _wss_stage s JOIN wca_scrambles w USING (competition_id,event_id,round_type_id,group_id,is_extra,scramble_num)
  ORDER BY s.competition_id,s.event_id,s.round_type_id,s.group_id,s.is_extra,s.scramble_num, s.gm_cross6 NULLS LAST, s.gm_xcross6 NULLS LAST, w.rnd
  ON CONFLICT (competition_id,event_id,round_type_id,group_id,is_extra,scramble_num)
  DO UPDATE SET rnd=EXCLUDED.rnd, steps=EXCLUDED.steps, gm_cross6=EXCLUDED.gm_cross6, gm_xcross6=EXCLUDED.gm_xcross6;
CREATE TEMP TABLE _wss_del (competition_id varchar(32), event_id varchar(6), round_type_id varchar(1), group_id varchar(3), is_extra smallint, scramble_num int) ON COMMIT DROP;
\copy _wss_del FROM '$remoteDel' WITH (FORMAT csv)
DELETE FROM wca_scramble_steps t USING _wss_del d
  WHERE t.competition_id=d.competition_id AND t.event_id=d.event_id AND t.round_type_id=d.round_type_id AND t.group_id=d.group_id AND t.is_extra=d.is_extra AND t.scramble_num=d.scramble_num;
$metaIns
COMMIT;
SELECT 'wca_scramble_steps_total='||count(*) FROM wca_scramble_steps;
"@
    $localSql = Join-Path $env:TEMP '_wss.sql'
    [IO.File]::WriteAllText($localSql, ($sql -replace "`r`n","`n"), [Text.UTF8Encoding]::new($false))
    scp $d.DeltaCsv "${StaticHost}:$remoteDelta"; if($LASTEXITCODE -ne 0){ Write-Host '  [steps] delta scp 失败, 跳过(manifest 不更新)' -ForegroundColor Yellow; Remove-Item $d.NewManifest -Force -EA SilentlyContinue; return }
    scp $d.DeletedTxt "${StaticHost}:$remoteDel" | Out-Null; if($LASTEXITCODE -ne 0){ Write-Host '  [steps] del scp 失败, 跳过' -ForegroundColor Yellow; Remove-Item $d.NewManifest -Force -EA SilentlyContinue; return }
    scp $localSql "${StaticHost}:$remoteSql" | Out-Null; if($LASTEXITCODE -ne 0){ Write-Host '  [steps] SQL scp 失败, 跳过' -ForegroundColor Yellow; Remove-Item $localSql,$d.NewManifest -Force -EA SilentlyContinue; return }
    $remoteCmd = "PGPASSWORD=$pwExpr psql -U recon_user -h 127.0.0.1 -d cuberoot_db -v ON_ERROR_STOP=1 -f $remoteSql; rc=`$?; rm -f $remoteDelta $remoteDel $remoteSql; exit `$rc"
    ssh $StaticHost $remoteCmd
    $loadRc=$LASTEXITCODE
    Remove-Item $localSql -Force -ErrorAction SilentlyContinue
    if($loadRc -ne 0){ Write-Host '  [steps] 增量灌库失败(非致命): 0057 未部署? manifest 不更新, 下次重试。' -ForegroundColor Yellow; Remove-Item $d.NewManifest -Force -EA SilentlyContinue; return }
  } else {
    Write-Host "  [steps] 基线全量 gzip+scp $rows 行 -> TRUNCATE+INSERT ..." -ForegroundColor DarkCyan
    $gz = "$LocalCsv.gz"
    Remove-Item $gz -Force -ErrorAction SilentlyContinue
    $fin=[IO.File]::OpenRead($LocalCsv); $fout=[IO.File]::Create($gz)
    $gzs=New-Object IO.Compression.GZipStream($fout,[IO.Compression.CompressionLevel]::Fastest)
    $fin.CopyTo($gzs); $gzs.Close(); $fout.Close(); $fin.Close()
    $remoteGz='/root/_wss.csv.gz'; $remoteCsv='/root/_wss.csv'; $remoteSql='/root/_wss.sql'
    scp $gz "${StaticHost}:$remoteGz"; $scpRc=$LASTEXITCODE
    Remove-Item $gz -Force -ErrorAction SilentlyContinue
    if($scpRc -ne 0){ Write-Host '  [steps] scp 失败, 跳过灌库' -ForegroundColor Yellow; Remove-Item $d.NewManifest -Force -EA SilentlyContinue; return }
    $sql = @"
\set ON_ERROR_STOP on
BEGIN;
CREATE TEMP TABLE _wss_stage (competition_id varchar(32), event_id varchar(6), round_type_id varchar(1), group_id varchar(3), is_extra smallint, scramble_num int, gm_cross6 smallint, gm_xcross6 smallint, steps smallint[]) ON COMMIT DROP;
\copy _wss_stage (competition_id,event_id,round_type_id,group_id,is_extra,scramble_num,gm_cross6,gm_xcross6,steps) FROM '$remoteCsv' WITH (FORMAT csv)
TRUNCATE wca_scramble_steps;
INSERT INTO wca_scramble_steps (competition_id,event_id,round_type_id,group_id,is_extra,scramble_num,rnd,steps,gm_cross6,gm_xcross6)
  SELECT DISTINCT ON (s.competition_id,s.event_id,s.round_type_id,s.group_id,s.is_extra,s.scramble_num)
         s.competition_id,s.event_id,s.round_type_id,s.group_id,s.is_extra,s.scramble_num,w.rnd,s.steps,s.gm_cross6,s.gm_xcross6
  FROM _wss_stage s JOIN wca_scrambles w USING (competition_id,event_id,round_type_id,group_id,is_extra,scramble_num)
  ORDER BY s.competition_id,s.event_id,s.round_type_id,s.group_id,s.is_extra,s.scramble_num, s.gm_cross6 NULLS LAST, s.gm_xcross6 NULLS LAST, w.rnd;
$metaIns
COMMIT;
SELECT 'wca_scramble_steps_total='||count(*) FROM wca_scramble_steps;
"@
    $localSql = Join-Path $env:TEMP '_wss_load.sql'
    [IO.File]::WriteAllText($localSql, ($sql -replace "`r`n","`n"), [Text.UTF8Encoding]::new($false))
    scp $localSql "${StaticHost}:$remoteSql" | Out-Null
    if($LASTEXITCODE -ne 0){ Write-Host '  [steps] SQL scp 失败, 跳过' -ForegroundColor Yellow; Remove-Item $localSql,$d.NewManifest -Force -EA SilentlyContinue; return }
    # 先 gunzip,再 psql -f(\copy 读已解压文件),最后清理远端临时文件
    $remoteCmd = "gunzip -f $remoteGz && PGPASSWORD=$pwExpr psql -U recon_user -h 127.0.0.1 -d cuberoot_db -v ON_ERROR_STOP=1 -f $remoteSql; rc=`$?; rm -f $remoteCsv $remoteGz $remoteSql; exit `$rc"
    ssh $StaticHost $remoteCmd
    $loadRc=$LASTEXITCODE
    Remove-Item $localSql -Force -ErrorAction SilentlyContinue
    if($loadRc -ne 0){ Write-Host '  [steps] psql 灌库失败(非致命): migration 0057 可能尚未部署到 prod,部署后下次 run 自动灌。manifest 不更新。' -ForegroundColor Yellow; Remove-Item $d.NewManifest -Force -EA SilentlyContinue; return }
  }
  Move-Item -Force $d.NewManifest $manifest
  Remove-Item $d.DeltaCsv,$d.DeletedTxt -Force -EA SilentlyContinue
  Write-Host "  [steps] 完成 (manifest 已更新, 全量 $rows 行)。" -ForegroundColor Green
}
# 镜像 wca_scrambles 增量灌库(comp 级 DELETE+INSERT)+ wca_competitions upsert(幂等兜底)。
# 真相源 = prod 现有 (competition_id -> 行数);不维护本地 manifest -> 首跑即正确、自愈、与 prod 永不漂移。
# 数据来自 incremental.py 解出的 incremental/tsv/{Scrambles,Competitions}.tsv(全项目, 非仅 333 系)。
# wca_scrambles 无 6 列自然键 UNIQUE(且 WCA dump 同场偶有两套 scramble)-> 不能 ON CONFLICT, 按场 DELETE+INSERT。
# 返回 $true 表示镜像有变(新场)。服务器密码从其自身 /root/core-api/.env 读, 不入(进 git 的)脚本。
function Load-MirrorToPg {
  $scrTsv  = Join-Path $IncrDir 'tsv\Scrambles.tsv'
  $compTsv = Join-Path $IncrDir 'tsv\Competitions.tsv'
  if(-not (Test-Path $scrTsv)){ Write-Host '  [mirror] 缺 tsv/Scrambles.tsv (incremental.py 没解出?), 跳过' -ForegroundColor Yellow; return $false }
  $pwExpr   = '$(grep -oP ''DB_PASS=\K.*'' /root/core-api/.env | tr -d ''[:space:]'')'
  $psqlBase = "PGPASSWORD=$pwExpr psql -U recon_user -h 127.0.0.1 -d cuberoot_db"
  # 1. prod 现有 (comp -> 行数) 作真相源(chr(9)=tab 分隔)
  $prodCounts = Join-Path $IncrDir 'prod_comp_counts.tsv'
  ssh $StaticHost "$psqlBase -t -A -c 'SELECT competition_id||chr(9)||count(*) FROM wca_scrambles GROUP BY competition_id'" |
    Set-Content -LiteralPath $prodCounts -Encoding utf8
  if($LASTEXITCODE -ne 0){ Write-Host '  [mirror] 拉 prod comp 行数失败, 跳过' -ForegroundColor Yellow; return $false }
  # 2. comp 级 diff -> delta(镜像列序)+ competitions upsert CSV
  $delta    = Join-Path $IncrDir 'mirror_delta.csv'
  $comps    = Join-Path $IncrDir 'mirror_comps.txt'
  $compsCsv = Join-Path $IncrDir 'wca_competitions_upsert.csv'
  $argv = @((Join-Path $PSScriptRoot 'build_mirror_delta.mjs'),'--scrambles',$scrTsv,'--prod-counts',$prodCounts,'--out-delta',$delta,'--out-comps',$comps)
  if(Test-Path $compTsv){ $argv += @('--competitions',$compTsv,'--out-comps-csv',$compsCsv) }
  $json = & node @argv
  if($LASTEXITCODE -ne 0){ throw '[mirror] build_mirror_delta.mjs 失败' }
  $st = ($json | Select-Object -Last 1 | ConvertFrom-Json)
  Write-Host ("  [mirror] export {0} 场 / prod {1} 场 -> 待灌 {2} 场 ({3} 行) + competitions {4} 行" -f $st.exportComps,$st.prodComps,$st.toLoadComps,$st.deltaRows,$st.compsRows) -ForegroundColor DarkCyan
  $changed = $false
  # 3. 镜像 delta: staging -> 按场 DELETE+INSERT
  if($st.toLoadComps -gt 0){
    $sql = @"
\set ON_ERROR_STOP on
BEGIN;
CREATE TEMP TABLE _scr_stage (competition_id varchar(32), event_id varchar(6), round_type_id varchar(1), group_id varchar(3), is_extra smallint, scramble_num int, scramble text) ON COMMIT DROP;
\copy _scr_stage (competition_id,event_id,round_type_id,group_id,is_extra,scramble_num,scramble) FROM '/root/_mirror_delta.csv' WITH (FORMAT csv, HEADER true)
DELETE FROM wca_scrambles WHERE competition_id IN (SELECT DISTINCT competition_id FROM _scr_stage);
INSERT INTO wca_scrambles (competition_id,event_id,round_type_id,group_id,is_extra,scramble_num,scramble)
  SELECT competition_id,event_id,round_type_id,group_id,is_extra,scramble_num,scramble FROM _scr_stage;
COMMIT;
SELECT 'wca_scrambles_total='||count(*) FROM wca_scrambles;
"@
    $localSql = Join-Path $env:TEMP '_mirror_load.sql'
    [IO.File]::WriteAllText($localSql, ($sql -replace "`r`n","`n"), [Text.UTF8Encoding]::new($false))
    scp $delta "${StaticHost}:/root/_mirror_delta.csv"; if($LASTEXITCODE -ne 0){ throw '[mirror] delta scp 失败' }
    scp $localSql "${StaticHost}:/root/_mirror_load.sql"; if($LASTEXITCODE -ne 0){ throw '[mirror] SQL scp 失败' }
    ssh $StaticHost "$psqlBase -v ON_ERROR_STOP=1 -f /root/_mirror_load.sql; rc=`$?; rm -f /root/_mirror_delta.csv /root/_mirror_load.sql; exit `$rc"
    if($LASTEXITCODE -ne 0){ throw '[mirror] 镜像灌库失败' }
    Remove-Item $localSql -Force -EA SilentlyContinue
    $changed = $true
    Write-Host "  [mirror] 镜像增量灌库完成 ($($st.toLoadComps) 场 / $($st.deltaRows) 行)。" -ForegroundColor Green
  } else { Write-Host '  [mirror] 镜像无新场, 跳过。' -ForegroundColor DarkGray }
  # 4. competitions upsert(幂等;保过去赛 name/date/country 齐全, 不把已有真值覆成 unknown)
  if((Test-Path $compsCsv) -and $st.compsRows -gt 0){
    $sql = @"
\set ON_ERROR_STOP on
BEGIN;
CREATE TEMP TABLE _comp_stage (id text, name text, country_id text, start_date text, end_date text) ON COMMIT DROP;
\copy _comp_stage (id,name,country_id,start_date,end_date) FROM '/root/_comps_upsert.csv' WITH (FORMAT csv, HEADER true)
INSERT INTO wca_competitions (id,name,country_id,start_date,end_date)
  SELECT id, name, COALESCE(NULLIF(country_id,''),'unknown'), NULLIF(start_date,'')::date, NULLIF(end_date,'')::date FROM _comp_stage
  ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,
    country_id = CASE WHEN EXCLUDED.country_id <> 'unknown' THEN EXCLUDED.country_id ELSE wca_competitions.country_id END,
    start_date=EXCLUDED.start_date, end_date=EXCLUDED.end_date;
COMMIT;
SELECT 'wca_competitions_total='||count(*) FROM wca_competitions;
"@
    $localSql = Join-Path $env:TEMP '_comps_upsert.sql'
    [IO.File]::WriteAllText($localSql, ($sql -replace "`r`n","`n"), [Text.UTF8Encoding]::new($false))
    scp $compsCsv "${StaticHost}:/root/_comps_upsert.csv"; if($LASTEXITCODE -ne 0){ throw '[mirror] comps scp 失败' }
    scp $localSql "${StaticHost}:/root/_comps_upsert.sql"; if($LASTEXITCODE -ne 0){ throw '[mirror] comps SQL scp 失败' }
    ssh $StaticHost "$psqlBase -v ON_ERROR_STOP=1 -f /root/_comps_upsert.sql; rc=`$?; rm -f /root/_comps_upsert.csv /root/_comps_upsert.sql; exit `$rc"
    if($LASTEXITCODE -ne 0){ throw '[mirror] competitions upsert 失败' }
    Remove-Item $localSql -Force -EA SilentlyContinue
    Write-Host "  [mirror] competitions upsert 完成 ($($st.compsRows) 行)。" -ForegroundColor Green
  }
  return $changed
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

# ---- 开场: 一键 / 逐项自定义 ----
# 一键 = 就地关掉向导 -> 后面 5 个问题(作业/TSV来源/变体/块数/发布)一个都不弹, 直接吃 param 默认值:
# 全作业 + 下载最新 export + 全 12 变体补满 + 发布。想改任何一项就选逐项, 或直接带 flag 跑(带参数本就不弹)。
if($Wizard){
  Write-Host ''
  $mi = Read-SingleSelect -Prompt '怎么跑?' -Options @(
    '一键全跑 (全作业 + 最新 export + 全变体补满 + 发布) — 后续不再询问',
    '逐项自定义 (作业 / TSV 来源 / 变体 / 块数 / 发布)'
  ) -Default 0
  if($mi -eq -1){ Write-Host '已取消。' -ForegroundColor Yellow; Hold-Console; return }
  if($mi -eq 0){
    $Wizard = $false
    Write-Host '  -> 一键全跑, 后续无交互 (Ctrl+C 可中断; 变体分块已落盘, 下次自动续)' -ForegroundColor DarkGray
  }
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
  if(-not (Read-MultiSelect -Prompt '跑哪些作业?' -Items $jItems)){ Write-Host '已取消。' -ForegroundColor Yellow; Hold-Console; return }
  $runStages  = [bool]$jItems[0].Selected
  $run333opt  = [bool]$jItems[1].Selected
  $runPuzzles = [bool]$jItems[2].Selected
}
Write-Host ("作业: {0}" -f ((@(if($runStages){'stages'}; if($run333opt){'333opt'}; if($runPuzzles){'puzzles'})) -join ' + ')) -ForegroundColor Cyan

# ===== JOB: stages (3x3 阶段难度: 取数 + std + 变体) =====
$nNew = 0; $stdChanged = $false; $variantChanged = $false; $mirrorChanged = $false
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
      if($ti -eq -1){ Write-Host '已取消, 未改动任何 master/JSON。' -ForegroundColor Yellow; Hold-Console; return }
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
  if($null -eq $plan){ Write-Host '已取消, 未改动任何 master/JSON。' -ForegroundColor Yellow; Hold-Console; return }
  $Variants  = $plan.Variants
  $MaxChunks = $plan.MaxChunks
  $NoPublish = [bool]$plan.NoPublish
}

# -DryRun: 只读, 算完 delta 立即停, 绝不碰 master / JSON / 不发布 / 不补变体
if($DryRun){
  Write-Host "[DryRun] 新 std 打乱: $nNew 条 (不动任何 master/JSON/变体/不发布)" -ForegroundColor Yellow
  # 关键: 即使 0 新打乱, 变体回填仍可能有缺口 (慢变体没追平 master)。纯行数比对(只读), 与向导 survey 同口径。
  # 实跑工作量 = (master 现有 - 变体已有) + 新 std; 各变体串行跑, 总墙钟 ≈ 各 ETA 之和 (eo 为长杆)。
  $masterN = if(Test-Path $MasterTxt){ Lc $MasterTxt } else { 0 }
  $dryOrder = @('eo','pseudo','pseudo_pair','pair','f2leo','pseudo_f2leo','222','roux','223','eoline','dr','f2b')
  $dryShow  = @($dryOrder | Where-Object { $Variants -contains $_ })
  if($dryShow.Count -gt 0){
    Write-Host "[DryRun] 变体回填积压 (待补 = master $masterN - 变体已有; 实跑 = 待补 + 新std):" -ForegroundColor Yellow
    $dryTot = 0
    foreach($v in $dryShow){
      $csv = Join-Path $ScrambleDir "stats\$v.csv"
      if(-not (Test-Path $csv)){ Write-Host ("  {0,-14} CSV 不存在" -f $v) -ForegroundColor DarkGray; continue }
      $have = (Lc $csv) - 1
      $back = [Math]::Max($masterN - $have, 0)
      $proj = $back + $nNew
      $dryTot += $proj
      Write-Host ("  {0,-14} 已有 {1,9}  待补 {2,6}  实跑 {3,6}  ≈{4}" -f $v,$have,$back,$proj,(Estimate $proj $VARIANT_RATE[$v]))
    }
    Write-Host ("[DryRun] 合计实跑 ~$dryTot 条 (串行, 总墙钟 ≈ 各 ETA 之和)") -ForegroundColor Yellow
  }
  Hold-Console
  return
}

# ---- 1b. 镜像 wca_scrambles + competitions 增量灌库 ----
# 独立于 std/变体/333opt: 覆盖全项目新赛(连只有 2x2/金字塔的比赛也进镜像), 让 recon/timer 的「最优打乱」
# join 路径(只在 fromMirror 命中时 LEFT JOIN wca_scramble_optimal)对新赛也走得通。prod 行数为真相源, comp 级。
if((-not $SkipSolve) -and (-not $SourceCsv) -and (-not $NoPublish)){
  Step '1b 镜像 wca_scrambles + competitions 增量灌库 (prod 行数为真相源, comp 级 DELETE+INSERT)'
  if(Load-MirrorToPg){ $mirrorChanged = $true }
}

# ---- 2/3. std solver + 追加 master (只在有新打乱时) ----
$stdChanged = $false
if($nNew -gt 0){
  Step "2 std_analyzer 解算 $nNew 条 (cross..xxxxcross x 6 底色)"
  $stdOut = Join-Path $IncrDir 'new_no_wide_move_std.csv'
  if(-not $SkipSolve){
    $env:CUBE_TABLE_DIR        = Join-Path $SolverDir 'tables'
    $env:CUBE_ALLOW_HUGE_TABLES = '1'
    $env:CUBE_RUN_FULL_STD      = '1'
    # stdin=文件名; analyzer 是交互程序(有 banner + "Enter file (or exit):" 提示), 管道喂文件名时这些会漏到终端。
    # 同变体步骤(Sync-Variant)做法: 只放行 [PROG] 进度行, 其余(banner/提示/杂项)转存日志, 终端干净。
    $stdLog = Join-Path $IncrDir 'std_analyzer.log'
    if(Test-Path $stdLog){ Remove-Item $stdLog -Force }
    $newTxt | & $StdAnalyzer 2>&1 | ForEach-Object {
      $s = "$_"
      if($s -match '\[PROG\]'){ Write-Host $s } else { Add-Content -LiteralPath $stdLog -Value $s }
    }
    if($LASTEXITCODE -ne 0){ throw "std_analyzer 失败 (详见 $stdLog)" }
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
if(-not $PublishOnly){ $variantChanged = $false }   # PublishOnly: 保留行内设的 true, 否则变体待补 0 时这里重置成 false 会让步骤 5 build 不触发(修 PublishOnly 不重算的 bug)
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
  # 同会话 & 调用: 数组对象直接绑定 [string[]]$Puzzles。禁用 `pwsh file.ps1 -Puzzles $Puzzles`
  # (跨进程 -File 模式数组被拆成散 token, 余项落到位置参数 -MaxNew[int] 报错)。
  & (Join-Path $PSScriptRoot 'update_puzzle_stats.ps1') -Puzzles $Puzzles
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

if(-not $stdChanged -and -not $variantChanged -and -not $willInject -and -not $puzzleChanged -and -not $eventsChanged -and -not $mirrorChanged){
  Step '无任何数据变化, 结束。'
  Hold-Console
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
  } finally { Pop-Location }
}

# ---- 5a. 333opt 整解最优 全量求解 (solve_loop: 把 master 池没解的 333 整解最优补齐, 再由 5b inject) ----
# 续跑: out.0.csv 已有 id 自动跳过, 全解时 solve_loop 秒退(不载 15G 表)。-SkipSolve333 跳过只 inject。
# BelowNormal(本 ps1 顶部已设, 子 node 继承)+ 12 线程 in-proc(solve_loop 钉死)。15G opt9 表需 ~16G 空闲。
if($run333opt -and -not $SkipSolve333){
  $opt333Dir = Join-Path $SolverDir '333opt'
  $solveLoop = Join-Path $opt333Dir 'solve_loop.mjs'
  if(Test-Path $solveLoop){
    $freeGB = (Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory/1MB
    if($freeGB -lt 16){ Write-Host ("[333opt-solve] 警告: 空闲内存 {0:N1}G (<16G), 15G 表可能换页变慢(别让它写 C 盘)。" -f $freeGB) -ForegroundColor Yellow }
    Step '5a 333 整解最优全量求解 — node solver/333opt/solve_loop.mjs (续跑; 首次全量~3.5天, 增量缺口快; 已全解则秒退)'
    Push-Location $opt333Dir
    try { node solve_loop.mjs; $solveRc = $LASTEXITCODE } finally { Pop-Location }
    if($solveRc -eq 2){ throw '333opt solve_loop 连续 3 次零进展, 已停下报警(unwind/表加载问题)。未 inject 半成品, 请人工查。' }
    if($solveRc -ne 0){ throw "333opt solve_loop 失败 (rc=$solveRc)" }
  } else {
    Write-Host '[333opt-solve] 无 solve_loop.mjs, 跳过求解(仍尝试 inject 现有 out.0.csv)。' -ForegroundColor DarkGray
  }
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

# ---- 5b2. 近期打乱(recent_scrambles.json): 最近一批新增里各 (变体×类型×底色) 最简单的, 给首页 RecentScrambles。
# 必须在 5a/5b 之后: 首页显示的是**最优等态打乱**(读 solver/333opt/out.0.csv), 本批新 id 得先被 solve_loop 解出来,
# 否则这批全回退成原打乱。故 333opt 单独跑(新解了 id)也要重出这份。变体 CSV 在步骤 4/5 已就绪。
if($nNew -gt 0 -or $variantChanged -or $optChanged){
  Step '5b2 近期打乱(3x3) — build:recent-scrambles (显示最优等态打乱)'
  Push-Location (Join-Path $RepoRoot 'core')
  try {
    pnpm --filter @cuberoot/scramble-stats-build build:recent-scrambles
    if($LASTEXITCODE -ne 0){ throw 'build:recent-scrambles 失败' }
  } finally { Pop-Location }
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

# ---- 5e. 难度 steps 索引宽表 (wca_scramble_steps;依赖各变体 CSV,故跟 stages) ----
# build:scramble-steps 产 stats/scramble/steps/{wca_scramble_steps.csv, steps_layout.json}(gitignored),
# 非 NoPublish 时直接 \copy 灌 prod PG(供 /timer 按难度出题 + /scramble/stats 列举全部真题)。
if($runStages){
  Step '5e 难度 steps 索引 — build:scramble-steps (~0.75GB CSV, gitignored, \copy 灌 prod PG wca_scramble_steps)'
  Push-Location (Join-Path $RepoRoot 'core')
  try {
    pnpm --filter @cuberoot/scramble-stats-build build:scramble-steps
    if($LASTEXITCODE -ne 0){ Write-Host '[steps] 生成失败(非致命, 跳过)' -ForegroundColor Yellow }
    elseif(-not $NoPublish){
      Load-StepsToPg -LocalCsv (Join-Path $RepoRoot 'stats/scramble/steps/wca_scramble_steps.csv') `
        -LocalLayout (Join-Path $RepoRoot 'stats/scramble/steps/steps_layout.json') -Stamp $stamp
    }
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
    # stages: gitignored 的 comp_steps/bundle/downloads 也会变(git status 看不见整变更集),
    # 走 sha1 内容增量发布(publish_scramble_incremental.ps1): 维护本地 sha1 清单, 只传内容真变的
    # 文件 + 删远端孤儿; 首次(无清单)自动全量 tar 建基线。把每次 ~590MB 整包降到典型增量的 changed 小包。
    & (Join-Path $PSScriptRoot 'publish_scramble_incremental.ps1')
    if($LASTEXITCODE -ne 0){ throw '增量 static 发布失败' }
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
Hold-Console
