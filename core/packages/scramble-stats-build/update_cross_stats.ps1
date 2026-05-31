#!/usr/bin/env pwsh
# WCA 十字步数分布 手动增量刷新管道 (按需触发, 非定时; 仅本地: 需 solver 的 ~34GB 表 + ~16GB 内存余量)
#
# 一键:        pwsh update_cross_stats.ps1
# 干跑(只读):  pwsh update_cross_stats.ps1 -DryRun -SourceCsv D:\cube\scramble\wca_scramble\input\wca_scrambles_info.csv
# 只本地不发布: pwsh update_cross_stats.ps1 -NoPublish
# 选变体补缺: pwsh update_cross_stats.ps1 -Variants pseudo,pseudo_pair   (默认 eo,pseudo,pseudo_pair)
# pair 单独跑: pwsh update_cross_stats.ps1 -Variants pair                (~2/s, 全量补 ~165h, 分块可中断续跑)
# f2leo 系:   pwsh update_cross_stats.ps1 -Variants f2leo,pseudo_f2leo  (小表 ~40MB 不碰 huge, 首次需全量补, 默认不含)
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
  [switch]$SkipSolve,     # 调试: 复用上次 std solver 产出, 跳过 std 解算
  [string[]]$Variants = @('eo','pseudo','pseudo_pair'),  # 跟 std 锁步补缺的变体 (@()=只 std)。pair / f2leo / pseudo_f2leo 默认不含(pair ~2/s 太慢; f2leo 系首次需全量补), 需手动 -Variants 指定
  [int]$ChunkSize = 20000 # 显式传则覆盖所有变体的分块大小; 不传则用每变体默认(见 $VARIANT_CHUNK: eo/pair=2000, 其余=20000)。逐块追加, 中断只丢当前块
)
$ErrorActionPreference = 'Stop'
$ChunkExplicit = $PSBoundParameters.ContainsKey('ChunkSize')  # 显式 -ChunkSize 覆盖每变体默认

# ---- 本机布局 ----
$ScrambleDir = 'D:\cube\scramble\wca_scramble'
$SolverDir   = 'D:\cube\solver-rust'
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
# 故慢变体用小块换更密的 save point。实测速率: eo ~0.9/s(一块 2000≈37min)、pair ~2/s、
# pseudo ~18/s、pseudo_pair ~35/s(2000 才 ~1min,重启占比高,故快变体保持 20000≈9-18min)。
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
  $done=0
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
    $done += $cnt
    Write-Host "[$Name] $done/$total"
  }
  Remove-Item $inTxt -Force -ErrorAction SilentlyContinue
  Write-Host "[$Name] 完成, 现 $(Lc $csv) 行(含表头)。" -ForegroundColor Green
  return $true
}

# ---- 1. 增量取数 ----
Step '1 增量取数 (results export -> 新打乱)'
$incrArgs = @('run','--project',$ScrambleDir,'python',(Join-Path $ScrambleDir 'incremental.py'))
if($SourceCsv){ $incrArgs += @('--source-csv',$SourceCsv) }
if($DryRun){ $incrArgs += '--dry-run' }   # 严格只读: 不覆写 competitions.tsv 等 master
& uv @incrArgs
if($LASTEXITCODE -ne 0){ throw 'incremental.py 失败' }

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
$compStepsChanged = $false   # f2leo 系变体有变 -> comp_steps_<variant> 需重算 (即便无新 std)
if($Variants.Count -gt 0){
  Step "4 变体补缺: $($Variants -join ', ')"
  if(-not (Test-Path $MasterTxt)){ throw "master $MasterTxt 不存在" }
  foreach($v in $Variants){
    if(Sync-Variant $v){
      $variantChanged = $true
      if($v -in @('f2leo','pseudo_f2leo')){ $compStepsChanged = $true }
    }
  }
} else {
  Write-Host '未指定变体补缺 (-Variants @())。' -ForegroundColor DarkGray
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
if($stdChanged -or $compStepsChanged){ $extra += ' + comp-steps' }
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
  if($stdChanged -or $compStepsChanged){
    # 每场预计算表(gen 页秒出, std + f2leo 系一把全产), gitignore+只 scp。
    # std 变 -> std comp_steps 重算; f2leo 系变 -> 其 comp_steps 重算 (build 内按 csv 存在与否决定)。
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
  git -C $RepoRoot add stats/scramble
  if(git -C $RepoRoot status --porcelain stats/scramble){
    $parts = @($stamp)
    if($stdChanged){ $parts += "+$nNew scrambles" }
    if($variantChanged){ $parts += "variants: $($Variants -join '/')" }
    git -C $RepoRoot commit -m "chore(scramble-stats): incremental refresh ($($parts -join ', '))"
    git -C $RepoRoot push origin main
    if($LASTEXITCODE -ne 0){ throw 'git push 失败' }
    # 发布 stats/scramble 到 static: 打成单个 .tgz -> scp 一个文件(二进制安全, 不走 pwsh 管道)
    # -> 远端 untar 覆盖。比 scp -r 逐个传 ~1.5w 小文件快一个量级。
    $tgz = Join-Path $env:TEMP 'cuberoot_scramble_publish.tgz'
    tar -czf $tgz -C (Join-Path $RepoRoot 'stats') scramble
    if($LASTEXITCODE -ne 0){ throw 'tar 打包失败' }
    scp $tgz "${StaticHost}:${StaticDest}/_publish.tgz"
    if($LASTEXITCODE -ne 0){ throw 'scp tgz 失败' }
    ssh $StaticHost "tar -xzf ${StaticDest}/_publish.tgz -C ${StaticDest} && rm -f ${StaticDest}/_publish.tgz"
    if($LASTEXITCODE -ne 0){ throw '远端 untar 失败' }
    Remove-Item $tgz -Force -ErrorAction SilentlyContinue
  } else { Write-Host 'stats/scramble 无变化, 跳过 commit。' -ForegroundColor Yellow }
}

Step "完成 (std +$nNew; 变体: $(if($variantChanged){$Variants -join '/'}else{'无变化'}))"
