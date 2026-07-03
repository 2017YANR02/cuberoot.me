#!/usr/bin/env pwsh
# stats/scramble 增量发布到 static —— 只传内容真变的文件 + 删远端孤儿,替代整包 ~590MB tar。
#
# 机制: 维护本地 sha1 清单(上次发布的内容快照, gitignored 在 incremental/)。每次发布:
#   1. 算当前 stats/scramble 全文件 sha1 清单
#   2. vs 上次清单 diff -> changed(新增/内容变) + deleted(远端孤儿)
#   3. 打 changed 小包 -> scp -> 远端解包覆盖; ssh rm deleted
#   4. 存当前清单为新基线
# 首次(无清单)或 -Baseline: 只存清单(假定远端已由一次全量 tar 同步), 不发。
#
# 复用现有免密 `ssh root@cuberoot` 通道(不引入 rsync / 不碰服务器地址)。sha1 全扫 ~2-3min(196k 文件),
# 远小于 35min 全量 tar; 传输从 ~590MB 降到 changed 小包(典型增量 run 仅几十个 comp_steps 文件 + 变动 JSON)。
[CmdletBinding()]
param(
  [switch]$DryRun,     # 只算 diff 打印 changed/deleted, 不实发
  [switch]$Baseline    # 只存当前清单为基线(配合一次全量 tar 用), 不发
)
$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$Local    = 'D:\cube\cuberoot.me\stats\scramble'
$Manifest = 'D:\cube\scramble\wca_scramble\incremental\publish_manifest.sha1'   # gitignored 区
$RHost    = 'root@cuberoot'
$RDest    = '/www/wwwroot/toolkit/stats/scramble'
$bash     = 'C:\Program Files\Git\bin\bash.exe'
if(-not (Test-Path $bash)){ $bash = 'bash' }   # PATH fallback

function BashPath($winPath){ (& $bash -c "cygpath -u '$winPath'").Trim() }
$bLocal = BashPath $Local

# ---- 1. 算当前 sha1 清单 (格式: '<sha1>  ./relpath') ----
$cur = Join-Path $env:TEMP '_scramble_cur_manifest.sha1'
$curB = BashPath $cur
Write-Host "[1/4] 算当前 sha1 清单 (find + sha1sum, 196k 文件约 2-3min) ..." -ForegroundColor Cyan
# steps/wca_scramble_steps.csv (~600MB) 是本地灌 PG 的中间产物, 远端无消费方(layout json 才被前端拉), 不发布
& $bash -c "cd '$bLocal' && find . -type f ! -path './steps/wca_scramble_steps.csv' | LC_ALL=C sort | xargs -d '\n' sha1sum > '$curB'"
if($LASTEXITCODE -ne 0){ throw 'sha1 清单生成失败' }
$curCount = @([IO.File]::ReadLines($cur)).Count
Write-Host "      $curCount 文件" -ForegroundColor DarkGray

# ---- 2. Baseline: 只存清单(配合外部一次全量 tar 用) ----
if($Baseline){
  Copy-Item $cur $Manifest -Force
  Write-Host "[baseline] 存基线清单 ($curCount 文件)。远端须已由一次全量 tar 同步到同一状态。" -ForegroundColor Green
  return
}

# ---- 2b. 首次(无基线): 全量 tar 发布 + 建基线(自包含, 之后即增量) ----
if(-not (Test-Path $Manifest)){
  if($DryRun){ Write-Host "[首次] 无基线清单, 将全量 tar 发布(dry-run 跳过)。" -ForegroundColor Yellow; return }
  Write-Host "[首次] 无基线清单, 全量 tar 发布 + 建基线 ..." -ForegroundColor Cyan
  $tgz = Join-Path $env:TEMP '_scramble_full.tgz'
  $tgzB = BashPath $tgz
  $statsB = BashPath 'D:\cube\cuberoot.me\stats'
  & $bash -c "cd '$statsB' && tar --exclude='scramble/steps/wca_scramble_steps.csv' -czf '$tgzB' scramble"
  if($LASTEXITCODE -ne 0){ throw '首次全量 tar 失败' }
  $fmb = [math]::Round((Get-Item $tgz).Length/1MB,1)
  Write-Host "      tar $fmb MB -> scp -> 远端原子替换 ..." -ForegroundColor DarkGray
  scp $tgz "${RHost}:/tmp/_scramble_full.tgz"
  if($LASTEXITCODE -ne 0){ throw '首次 scp 失败' }
  ssh $RHost "set -e; cd /www/wwwroot/toolkit/stats; rm -rf scramble.new scramble.prev; mkdir scramble.new; tar -xzf /tmp/_scramble_full.tgz -C scramble.new --strip-components=1; if [ -d scramble ]; then mv scramble scramble.prev; fi; mv scramble.new scramble; rm -rf scramble.prev /tmp/_scramble_full.tgz"
  if($LASTEXITCODE -ne 0){ throw '首次远端替换失败' }
  Remove-Item $tgz -Force -ErrorAction SilentlyContinue
  Copy-Item $cur $Manifest -Force
  Write-Host "[首次] 全量发布完成 + 建基线 ($curCount 文件)。" -ForegroundColor Green
  return
}

# ---- 3. diff ----
function Load($p){
  $h = [System.Collections.Generic.Dictionary[string,string]]::new()
  foreach($l in [IO.File]::ReadLines($p)){
    $i = $l.IndexOf('  ')
    if($i -gt 0){ $h[$l.Substring($i+2)] = $l.Substring(0,$i) }
  }
  $h
}
$saved = Load $Manifest
$curH  = Load $cur
$changed = [System.Collections.Generic.List[string]]::new()
foreach($k in $curH.Keys){
  $sv = $null
  if(-not $saved.TryGetValue($k,[ref]$sv) -or $sv -ne $curH[$k]){ [void]$changed.Add($k) }
}
$deleted = [System.Collections.Generic.List[string]]::new()
foreach($k in $saved.Keys){ if(-not $curH.ContainsKey($k)){ [void]$deleted.Add($k) } }
Write-Host "[2/4] diff: changed=$($changed.Count) deleted=$($deleted.Count)" -ForegroundColor Cyan

if($DryRun){
  Write-Host "[dry-run] 不实发。前 20 changed / deleted:" -ForegroundColor Yellow
  $changed | Select-Object -First 20 | ForEach-Object { Write-Host "  + $_" -ForegroundColor DarkGray }
  $deleted | Select-Object -First 20 | ForEach-Object { Write-Host "  - $_" -ForegroundColor DarkGray }
  return
}
if($changed.Count -eq 0 -and $deleted.Count -eq 0){
  Write-Host "无变化, 跳过发布。" -ForegroundColor Green
  Copy-Item $cur $Manifest -Force
  return
}

# ---- 4. 打包 changed -> scp -> 远端解包覆盖; rm deleted ----
if($changed.Count -gt 0){
  $list = Join-Path $env:TEMP '_scramble_changed.txt'
  [IO.File]::WriteAllLines($list, ($changed | ForEach-Object { $_ -replace '^\./','' }))
  $listB = BashPath $list
  $delta = Join-Path $env:TEMP '_scramble_delta.tgz'
  $deltaB = BashPath $delta
  Write-Host "[3/4] 打包 $($changed.Count) 个 changed -> scp -> 远端解包 ..." -ForegroundColor Cyan
  & $bash -c "cd '$bLocal' && tar -czf '$deltaB' -T '$listB'"
  if($LASTEXITCODE -ne 0){ throw 'tar delta 失败' }
  $dmb = [math]::Round((Get-Item $delta).Length/1MB,1)
  Write-Host "      delta $dmb MB" -ForegroundColor DarkGray
  scp $delta "${RHost}:/tmp/_scramble_delta.tgz"
  if($LASTEXITCODE -ne 0){ throw 'scp delta 失败' }
  ssh $RHost "cd '$RDest' && tar -xzf /tmp/_scramble_delta.tgz && rm -f /tmp/_scramble_delta.tgz"
  if($LASTEXITCODE -ne 0){ throw '远端解包失败' }
  Remove-Item $delta,$list -Force -ErrorAction SilentlyContinue
}
if($deleted.Count -gt 0){
  Write-Host "[4/4] 删远端孤儿 $($deleted.Count) 个 ..." -ForegroundColor Cyan
  # 用 stdin 喂列表给远端 xargs rm, 避开命令行长度限制
  $delList = ($deleted | ForEach-Object { $_ -replace '^\./','' }) -join "`n"
  $delList | ssh $RHost "cd '$RDest' && xargs -d '\n' -r rm -f"
  if($LASTEXITCODE -ne 0){ Write-Host '  [warn] 远端删孤儿非零退出(可能部分已不存在), 忽略' -ForegroundColor Yellow }
}
Copy-Item $cur $Manifest -Force
Write-Host "[done] 增量发布完成: +$($changed.Count) changed, -$($deleted.Count) deleted。" -ForegroundColor Green
