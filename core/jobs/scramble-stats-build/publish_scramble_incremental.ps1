#!/usr/bin/env pwsh
# stats/scramble 增量发布到 static —— 只传内容真变的文件 + 删远端孤儿,替代整包 ~590MB tar。
#
# 机制: 维护本地 sha1 清单(上次发布的内容快照, gitignored 在 incremental/)。每次发布:
#   1. 原生扫描文件元数据, 复用未变化文件的 sha1, 只重算新增/变化文件
#   2. vs 上次清单 diff -> changed(新增/内容变) + deleted(远端孤儿)
#   3. 打 changed 小包 -> scp -> 远端解包覆盖; ssh rm deleted
#   4. 存当前清单为新基线
# 首次无发布清单时全量发布; -Baseline 只存清单(假定远端已由一次全量 tar 同步), 不发。
#
# sha1 缓存独立于发布基线; 首次建立缓存需读取全部内容, 后续只读变化文件; -VerifyAll 强制全量重算。
# 生成与发布须串行, 扫描/打包期间不要写入源目录; 缓存不是防恶意篡改的完整性审计。
[CmdletBinding()]
param(
  [switch]$DryRun,     # 只算 diff 打印 changed/deleted, 不实发
  [switch]$Baseline,   # 只存当前清单为基线(配合一次全量 tar 用), 不发
  [switch]$VerifyAll   # 忽略本地指纹缓存, 重新读取全部文件计算 sha1
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
function Save-PublishBaseline {
  $temporary = "$Manifest.$PID.tmp"
  [void][IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($Manifest))
  Copy-Item -LiteralPath $cur -Destination $temporary -Force
  [IO.File]::Move($temporary, $Manifest, $true)
}
$bLocal = BashPath $Local

# ---- 1. 算当前 sha1 清单 (格式: '<sha1>  ./relpath') ----
$scratch = Join-Path $PSScriptRoot '../../../.tmp/png/scramble-publish'
[void][IO.Directory]::CreateDirectory($scratch)
$cur = Join-Path $scratch "manifest-$PID.sha1"
Write-Host "[1/4] 正在检查文件变化…" -ForegroundColor Cyan
# steps/wca_scramble_steps.csv (~600MB) 是本地灌 PG 的中间产物, 远端无消费方(layout json 才被前端拉), 不发布
$scanArgs = @('--root', $Local, '--cache', "$Manifest.cache.json", '--output', $cur)
if($VerifyAll){ $scanArgs += '--force' }
& node (Join-Path $PSScriptRoot 'scramble_manifest.mjs') @scanArgs
if($LASTEXITCODE -ne 0){ throw 'sha1 清单生成失败' }
$curCount = @([IO.File]::ReadLines($cur)).Count
Write-Host "      $curCount 文件" -ForegroundColor DarkGray

# ---- 2. Baseline: 只存清单(配合外部一次全量 tar 用) ----
if($Baseline){
  Save-PublishBaseline
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
  Save-PublishBaseline
  Write-Host "[首次] 全量发布完成 + 建基线 ($curCount 文件)。" -ForegroundColor Green
  return
}

# ---- 3. diff ----
function Load($p){
  $h = [System.Collections.Generic.Dictionary[string,string]]::new([StringComparer]::Ordinal)
  foreach($l in [IO.File]::ReadLines($p)){
    if($l -notmatch '^([a-fA-F0-9]{40}) [ *](\./[^\r\n\\]+)$'){ throw "非法 SHA1 清单行: $p" }
    $hash = $Matches[1].ToLowerInvariant()
    $name = $Matches[2]
    if($name.Substring(2) -match '(^|/)\.\.?(/|$)'){ throw "非法清单路径: $name" }
    if(-not $h.TryAdd($name, $hash)){ throw "重复清单路径: $name" }
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
Write-Host "[2/4] 有 $($changed.Count) 个文件更新，$($deleted.Count) 个删除" -ForegroundColor Cyan

if($DryRun){
  Write-Host "[dry-run] 不实发。前 20 changed / deleted:" -ForegroundColor Yellow
  $changed | Select-Object -First 20 | ForEach-Object { Write-Host "  + $_" -ForegroundColor DarkGray }
  $deleted | Select-Object -First 20 | ForEach-Object { Write-Host "  - $_" -ForegroundColor DarkGray }
  return
}
if($changed.Count -eq 0 -and $deleted.Count -eq 0){
  Write-Host "无变化, 跳过发布。" -ForegroundColor Green
  Save-PublishBaseline
  return
}

# ---- 4. 打包 changed -> scp -> 远端解包覆盖; rm deleted ----
if($changed.Count -gt 0){
  $list = Join-Path $env:TEMP '_scramble_changed.txt'
  [IO.File]::WriteAllText($list, ($changed -join "`n") + "`n", [Text.UTF8Encoding]::new($false))
  $listB = BashPath $list
  $delta = Join-Path $env:TEMP '_scramble_delta.tgz'
  $deltaB = BashPath $delta
  Write-Host "[3/4] 正在上传 $($changed.Count) 个文件…" -ForegroundColor Cyan
  & $bash -c "cd '$bLocal' && tar -czf '$deltaB' --verbatim-files-from -T '$listB'"
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
  Write-Host "[4/4] 正在移除 $($deleted.Count) 个旧文件…" -ForegroundColor Cyan
  # 用 stdin 喂列表给远端 xargs rm, 避开命令行长度限制
  $delList = ($deleted -join "`n") + "`n"
  # Write exact LF bytes; PowerShell's Windows pipeline can otherwise append CRLF to the last path.
  $deleteScript = "cd '$RDest' && xargs -d '\n' -r rm -f --"
  $sshInfo = [Diagnostics.ProcessStartInfo]::new('ssh')
  $sshInfo.UseShellExecute = $false
  $sshInfo.RedirectStandardInput = $true
  $sshInfo.StandardInputEncoding = [Text.UTF8Encoding]::new($false)
  $sshInfo.ArgumentList.Add($RHost)
  $sshInfo.ArgumentList.Add($deleteScript)
  $sshProcess = [Diagnostics.Process]::Start($sshInfo)
  try {
    $sshProcess.StandardInput.Write($delList)
    $sshProcess.StandardInput.Close()
    $sshProcess.WaitForExit()
    if($sshProcess.ExitCode -ne 0){ throw '远端删孤儿失败, 保留发布基线以便下次重试' }
  } finally { $sshProcess.Dispose() }
}
Save-PublishBaseline
Write-Host "发布完成：更新 $($changed.Count) 个，删除 $($deleted.Count) 个。" -ForegroundColor Green
