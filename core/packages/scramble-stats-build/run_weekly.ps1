#!/usr/bin/env pwsh
# WCA 十字步数分布 周更增量管道 (仅本地: 需 solver 的 ~34GB 表 + ~16GB 内存余量)
#
# 一键:   pwsh run_weekly.ps1
# 干跑:   pwsh run_weekly.ps1 -DryRun -SourceCsv D:\cube\scramble\wca_scramble\input\wca_scrambles_info.csv
# 只本地不发布: pwsh run_weekly.ps1 -NoPublish
#
# 流程: results export 下载/抽取 -> 增量 diff (vs std.csv 已处理集合) -> std_analyzer 全 5 阶段
#       -> 追加 std.csv/no_wide_move.txt/split_mbf.csv -> 重算 distribution+wca_cross
#       -> git commit&push + scp static。任一步失败即停 (ErrorActionPreference=Stop)。
[CmdletBinding()]
param(
  [switch]$DryRun,        # 严格只读: 算新增规模即停, 不碰任何 master / 不解算 / 不发布
  [string]$SourceCsv,     # 测试源 (input 形状 csv) 替代下载 export
  [switch]$NoPublish,     # 跑完只更新本地 std.csv + JSON, 不 commit/push/scp
  [switch]$SkipSolve      # 调试: 复用上次 solver 产出
)
$ErrorActionPreference = 'Stop'

# ---- 本机布局 ----
$ScrambleDir = 'D:\cube\scramble\wca_scramble'
$SolverDir   = 'D:\cube\solver-rust'
$RepoRoot    = 'D:\cube\cuberoot.me'
$StdAnalyzer = Join-Path $SolverDir 'target\release\std_analyzer.exe'
$IncrDir     = Join-Path $ScrambleDir 'incremental'
$StaticHost  = 'root@cuberoot'                 # 免密 ssh 别名
$StaticDest  = '/www/wwwroot/toolkit/stats'    # nginx 静态根 (self-hosted + Vercel fallback 都从这服)

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

# ---- 1. 增量取数 ----
Step '1/6 增量取数 (results export -> 新打乱)'
$incrArgs = @('run','--project',$ScrambleDir,'python',(Join-Path $ScrambleDir 'incremental.py'))
if($SourceCsv){ $incrArgs += @('--source-csv',$SourceCsv) }
if($DryRun){ $incrArgs += '--dry-run' }   # 严格只读: 不覆写 competitions.tsv 等 master
& uv @incrArgs
if($LASTEXITCODE -ne 0){ throw 'incremental.py 失败' }

$newTxt = Join-Path $IncrDir 'new_no_wide_move.txt'
if(-not (Test-Path $newTxt) -or (Lc $newTxt) -eq 0){ Write-Host '没有新打乱, 结束。' -ForegroundColor Yellow; return }
$nNew = Lc $newTxt
Write-Host "新打乱(去宽层后)行数: $nNew"

# -DryRun: 只读, 算完 delta 立即停, 绝不碰 master / JSON / 发布
if($DryRun){ Write-Host "[DryRun] 将处理 $nNew 条新打乱; 不动任何 master/JSON/不发布。" -ForegroundColor Yellow; return }

# ---- 2. solver (全 5 阶段, 实时进度) ----
Step "2/6 std_analyzer 解算 $nNew 条 (cross..xxxxcross x 6 底色)"
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

# ---- 3. 追加 masters ----
Step '3/6 追加 std.csv / no_wide_move.txt / split_mbf.csv'
$std = Join-Path $ScrambleDir 'stat\std.csv'
$old = Lc $std
AppendData $std $stdOut $true
AppendData (Join-Path $ScrambleDir 'wca_scrambles_no_wide_move.txt') $newTxt $false
AppendData (Join-Path $ScrambleDir 'input\wca_scrambles_split_mbf.csv') (Join-Path $IncrDir 'new_split_mbf.csv') $true
Write-Host "std.csv: $old -> $(Lc $std) (+$nNew)"

# ---- 4. 重算 JSON (RNG 固定种子 + 稳定时间戳: 同一份 export 重跑逐字节不变) ----
$stamp = if(Test-Path (Join-Path $IncrDir 'export_date.txt')){ (Get-Content (Join-Path $IncrDir 'export_date.txt') -Raw).Trim() } else { Get-Date -Format 'yyyy-MM-dd' }
$env:SCRAMBLE_STATS_STAMP = $stamp
Step "4/6 重算 distribution.json + wca_cross/*.json (stamp=$stamp)"
Push-Location (Join-Path $RepoRoot 'core')
try {
  pnpm --filter @cuberoot/scramble-stats-build build
  if($LASTEXITCODE -ne 0){ throw 'build (distribution) 失败' }
  pnpm --filter @cuberoot/scramble-stats-build build:wca-cross
  if($LASTEXITCODE -ne 0){ throw 'build:wca-cross 失败' }
  pnpm --filter @cuberoot/scramble-stats-build build:comp-steps   # 每场预计算表(gen 页秒出),gitignore+只 scp
  if($LASTEXITCODE -ne 0){ throw 'build:comp-steps 失败' }
} finally { Pop-Location }

# ---- 5. 发布 ----
if($NoPublish){
  Step '5/6 发布 (跳过)'
} else {
  Step '5/6 commit & push + scp static'
  git -C $RepoRoot pull --rebase --autostash origin main
  git -C $RepoRoot add stats/scramble
  if(git -C $RepoRoot status --porcelain stats/scramble){
    git -C $RepoRoot commit -m "chore(scramble-stats): weekly cross-distribution refresh ($stamp, +$nNew scrambles)"
    git -C $RepoRoot push origin main
    if($LASTEXITCODE -ne 0){ throw 'git push 失败' }
    scp -r (Join-Path $RepoRoot 'stats\scramble') "${StaticHost}:${StaticDest}/"
    if($LASTEXITCODE -ne 0){ throw 'scp static 失败' }
  } else { Write-Host 'stats/scramble 无变化, 跳过 commit。' -ForegroundColor Yellow }
}

Step "完成 (+$nNew scrambles)"
