#!/usr/bin/env pwsh
# WCA 十字步数分布 手动增量刷新管道 (按需触发, 非定时; 仅本地: 需 solver 的 ~34GB 表 + ~16GB 内存余量)
#
# 一键:        pwsh update_cross_stats.ps1
# 干跑(只读):  pwsh update_cross_stats.ps1 -DryRun -SourceCsv D:\cube\scramble\wca_scramble\input\wca_scrambles_info.csv
# 只本地不发布: pwsh update_cross_stats.ps1 -NoPublish
# 选变体补缺: pwsh update_cross_stats.ps1 -Variants pseudo,pseudo_pair   (默认 eo,pseudo,pseudo_pair)
# pair 单独跑: pwsh update_cross_stats.ps1 -Variants pair                (~2/s, 全量补 ~165h, 分块可中断续跑)
# f2leo 系:   pwsh update_cross_stats.ps1 -Variants f2leo,pseudo_f2leo  (大表快路径, 真实打乱实测: f2leo 用 huge 联合表 ~31/s, pseudo_f2leo 用 huge 电池 ~81/s; 首次需全量补, 默认不含)
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
  [string[]]$Variants = @('eo','pseudo','pseudo_pair'),  # 跟 std 锁步补缺的变体 (@()=只 std)。pair / f2leo / pseudo_f2leo 默认不含(pair ~2/s 太慢; f2leo 系首次需全量补), 需手动 -Variants 指定
  [int]$ChunkSize = 20000, # 显式传则覆盖所有变体的分块大小; 不传则用每变体默认(见 $VARIANT_CHUNK: eo/pair=2000, 其余=20000)。逐块追加, 中断只丢当前块
  [int]$MaxChunks = 0,     # >0: 每个变体最多跑 N 块就停, 之后照常重算+发布(还差的下次 run 自动续)。0=补满。用于"只跑一两块"而无需人工盯/中途 kill
  [switch]$PublishOnly     # 跳过取数/解算/变体, 直接用当前 CSV 状态重算 distribution+comp-steps 并发布(把已落盘但未发布的累积变更推上线)
)
$ErrorActionPreference = 'Stop'
$ChunkExplicit = $PSBoundParameters.ContainsKey('ChunkSize')  # 显式 -ChunkSize 覆盖每变体默认

# ---- 本机布局 ----
$ScrambleDir = 'D:\cube\scramble\wca_scramble'
$SolverDir   = 'D:\cube\cuberoot.me\solver'
$RepoRoot    = 'D:\cube\cuberoot.me'
$RelDir      = Join-Path $SolverDir 'target\release'
$StdAnalyzer = Join-Path $RelDir 'std_analyzer.exe'
$IncrDir     = Join-Path $ScrambleDir 'incremental'
$MasterTxt   = Join-Path $ScrambleDir 'wca_scrambles_no_wide_move.txt'
$StaticHost  = 'root@cuberoot'                 # 免密 ssh 别名
$StaticDest  = '/www/wwwroot/toolkit/stats'    # nginx 静态根 (self-hosted + Vercel fallback 都从这服)

# 变体 -> analyzer exe。suffix 恒为 _<变体名>, 故输出文件名 = <输入名>_<变体名>.csv。
# std 不在此: 它单独走 new_no_wide_move.txt 的全量 diff (见下)。pair ~2/s 最慢, 不在默认 -Variants 里, 需显式 -Variants pair。
$VARIANT_EXE = @{
  eo           = 'eo_cross_analyzer.exe'
  pseudo       = 'pseudo_analyzer.exe'
  pseudo_pair  = 'pseudo_pair_analyzer.exe'
  pair         = 'pair_analyzer.exe'
  f2leo        = 'f2leo_analyzer.exe'
  pseudo_f2leo = 'pseudo_f2leo_analyzer.exe'
}

# 每变体默认 chunk(显式 -ChunkSize 覆盖全部)。analyzer 攒完整块才写盘 + 追加 = 中断丢在飞的整块,
# 故慢变体用小块换更密的 save point。实测速率(2026-05-30, 16 核): eo ~0.9/s(一块 2000≈37min)、pair ~2/s、
# pseudo ~390/s、pseudo_pair ~47/s(2000 才几十秒,重启占比高,故快变体保持 20000≈数分钟)。
$VARIANT_CHUNK = @{
  eo           = 2000
  pair         = 2000
  pseudo       = 20000
  pseudo_pair  = 20000
  f2leo        = 20000
  pseudo_f2leo = 20000
}

function Step($m){ Write-Host "`n=== $m ===" -ForegroundColor Cyan }
function Lc($p){ $n=0; foreach($l in [IO.File]::ReadLines($p)){ $n++ }; $n }
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
  # 4. 分块: 写块输入 -> analyzer (stdout 丢弃, 进度走 stderr) -> 校验行数 -> 追加 -> 删中间产物
  $inTxt  = Join-Path $IncrDir "sync_$Name.txt"
  $outCsv = Join-Path $IncrDir ("sync_{0}_{0}.csv" -f $Name)
  $done=0; $chunksRun=0
  for($i=0; $i -lt $total; $i += $chunk){
    $cnt=[Math]::Min($chunk, $total-$i)
    $slice=$missing.GetRange($i, $cnt)
    [IO.File]::WriteAllText($inTxt, ([string]::Join("`n",$slice)+"`n"), [Text.UTF8Encoding]::new($false))
    if(Test-Path $outCsv){ Remove-Item $outCsv -Force }
    $inTxt | & $exe | Out-Null
    if($LASTEXITCODE -ne 0){ throw "[$Name] analyzer 失败 (块 @$i)" }
    if(-not (Test-Path $outCsv)){ throw "[$Name] 无输出 $outCsv" }
    $got=(Lc $outCsv)-1
    if($got -ne $cnt){ throw "[$Name] 块行数 $got != 输入 $cnt" }
    AppendData $csv $outCsv $true
    Remove-Item $outCsv -Force
    $done += $cnt; $chunksRun++
    Write-Host "[$Name] $done/$total"
    if($MaxChunks -gt 0 -and $chunksRun -ge $MaxChunks){
      Write-Host "[$Name] 已达 -MaxChunks $MaxChunks, 停止 (还差 $($total-$done) 条, 下次 run 自动续)。" -ForegroundColor Yellow
      break
    }
  }
  Remove-Item $inTxt -Force -ErrorAction SilentlyContinue
  if($done -ge $total){ Write-Host "[$Name] 完成, 现 $(Lc $csv) 行(含表头)。" -ForegroundColor Green }
  else { Write-Host "[$Name] 部分补缺 $done/$total, 现 $(Lc $csv) 行(含表头)。" -ForegroundColor Yellow }
  return $true
}

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
  $incrPy = Join-Path $PSScriptRoot 'incremental.py'   # 脚本在仓库内(进 git), 数据目录走 --data-dir 注入
  $incrArgs = @('run','--project',$ScrambleDir,'python',$incrPy,'--data-dir',$ScrambleDir)
  if($SourceCsv){ $incrArgs += @('--source-csv',$SourceCsv) }
  if($DryRun){ $incrArgs += '--dry-run' }   # 严格只读: 不覆写 competitions.tsv 等 master
  & uv @incrArgs
  if($LASTEXITCODE -ne 0){ throw 'incremental.py 失败' }
}

$newTxt = Join-Path $IncrDir 'new_no_wide_move.txt'
$nNew = if((Test-Path $newTxt) -and (Lc $newTxt) -gt 0){ Lc $newTxt } else { 0 }
Write-Host "新打乱(去宽层后)行数: $nNew"

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

if(-not $stdChanged -and -not $variantChanged){
  Step '无任何数据变化, 结束。'
  return
}

# ---- 5. 重算 JSON (RNG 固定种子 + 稳定时间戳: 同一份数据重跑逐字节不变) ----
$stamp = if(Test-Path (Join-Path $IncrDir 'export_date.txt')){ (Get-Content (Join-Path $IncrDir 'export_date.txt') -Raw).Trim() } else { Get-Date -Format 'yyyy-MM-dd' }
$env:SCRAMBLE_STATS_STAMP = $stamp
$extra = ''
if($stdChanged){ $extra += ' + wca_cross' }
if($stdChanged -or $variantChanged){ $extra += ' + comp-steps' }
Step "5 重算 distribution.json$extra (stamp=$stamp)"
Push-Location (Join-Path $RepoRoot 'core')
try {
  pnpm --filter @cuberoot/scramble-stats-build build      # distribution.json 读全部变体, 任一变 -> 必重算
  if($LASTEXITCODE -ne 0){ throw 'build (distribution) 失败' }
  if($stdChanged){
    # wca_cross 只依赖 std cross 步数 + 比赛元数据, 只在有新 std 时重算
    pnpm --filter @cuberoot/scramble-stats-build build:wca-cross
    if($LASTEXITCODE -ne 0){ throw 'build:wca-cross 失败' }
  }
  if($stdChanged -or $variantChanged){
    # 每场预计算表(gen 页秒出), gitignore+只 scp。任一变体(含 std)CSV 变 -> 对应 comp_steps_<v> 需重算
    # (build_comp_steps 内按 csv 存在与否逐个产);否则变体-only 补缺会发布陈旧的 comp_steps_<v>。
    pnpm --filter @cuberoot/scramble-stats-build build:comp-steps
    if($LASTEXITCODE -ne 0){ throw 'build:comp-steps 失败' }
  }
} finally { Pop-Location }

# ---- 6. 发布 ----
if($NoPublish){
  Step '6 发布 (跳过)'
} else {
  Step '6 commit & push + tar 发布 static'
  git -C $RepoRoot pull --rebase --autostash origin main
  if($LASTEXITCODE -ne 0){ throw 'git pull --rebase 失败 (可能冲突, 仓库可能停在 rebase 中, 别继续 push)' }
  git -C $RepoRoot add stats/scramble
  if(git -C $RepoRoot status --porcelain stats/scramble){
    $parts = @($stamp)
    if($stdChanged){ $parts += "+$nNew scrambles" }
    if($variantChanged){ $parts += "variants: $($Variants -join '/')" }
    git -C $RepoRoot commit -m "chore(scramble-stats): incremental refresh ($($parts -join ', '))"
    if($LASTEXITCODE -ne 0){ throw 'git commit 失败' }
    git -C $RepoRoot push origin main
    if($LASTEXITCODE -ne 0){ throw 'git push 失败' }
    # 发布 stats/scramble 到 static: 打成单个 .tgz -> scp 一个文件(二进制安全, 不走 pwsh 管道)
    # -> 远端原子替换。比 scp -r 逐个传 ~1.5w 小文件快一个量级。
    $tgz = Join-Path $env:TEMP 'cuberoot_scramble_publish.tgz'
    Write-Host "  [1/3] tar 打包 stats/scramble ..." -ForegroundColor DarkCyan
    $t0 = Get-Date
    tar -czf $tgz -C (Join-Path $RepoRoot 'stats') scramble
    if($LASTEXITCODE -ne 0){ throw 'tar 打包失败' }
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
  } else { Write-Host 'stats/scramble 无变化, 跳过 commit。' -ForegroundColor Yellow }
}

Step "完成 (std +$nNew; 变体: $(if($variantChanged){$Variants -join '/'}else{'无变化'}))"
