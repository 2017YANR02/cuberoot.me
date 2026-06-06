#!/usr/bin/env pwsh
# Sum-of-Ranks「查选手最优组合」(sor_player_best) 手动刷新管道 (按需触发, 非定时; 仅本地).
# 前置: 本机 .tmp/sor 下有 sorcalc 源 + 输入矩阵 pe.tsv/persons.tsv (由上游从 PG wca_person_ranks 导出).
#       这些是 local-only, gitignored. 本脚本只负责 sorcalc 预计算 -> 拼 copy.tsv -> 灌 prod -> 清缓存.
#
# 一键全跑:      pwsh update_sor.ps1                 (4 套预计算 ~1.5-2h + 灌库 + 清缓存)
# 复用已算:      pwsh update_sor.ps1 -SkipSolve      (用现有 best_{single,average}_{17,21}.tsv, 只拼+灌+清)
# 只本地不上线:  pwsh update_sor.ps1 -NoPublish      (跑完只产 sor_player_best.copy.tsv, 不 scp/灌/清)
# 干跑:          pwsh update_sor.ps1 -DryRun         (只报现有产物状态, 不算不灌)
#
# 口径: sor_player_best 跟 /wca/sum-of-ranks 的"废止项"开关二态 —
#   incl_cancelled=false → 仅 17 活跃项 (nev=17); true → 含 4 废止项 (nev=21). single/average 各一套 = 4 套.
#   与 sor_census_yearly / 主榜单同口径. 灌库走 ALTER(幂等) + TRUNCATE sor_player_best + \copy (不碰 sor_census*).
# 任一步失败即停 (ErrorActionPreference=Stop).
[CmdletBinding()]
param(
  [switch]$SkipSolve,                 # 跳过 sorcalc, 复用现有 best_*.tsv
  [switch]$NoPublish,                 # 只产本地 copy.tsv, 不 scp/灌库/清缓存
  [switch]$DryRun,                    # 只读: 报现有产物, 不算不灌
  [string]$DbPassword = $env:PGPASSWORD,  # 留空则从仓库根 .password.md 解析
  [int]$Threads = 14                  # sorcalc 线程 (全局规则: 留 2 核; 长跑 BelowNormal)
)
$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

# ---- 本机布局 ----
$SorDir   = 'D:\cube\cuberoot.me\core\.tmp\sor'
$Exe      = Join-Path $SorDir 'sorcalc\target\release\sorcalc.exe'
$CopyTsv  = Join-Path $SorDir 'sor_player_best.copy.tsv'
$LoadSql  = Join-Path $SorDir 'load_sor_pb.sql'        # 运行时生成的 pb-only 灌库脚本
$RepoRoot = 'D:\cube\cuberoot.me'
$Server   = 'root@cuberoot'                            # 免密 ssh 别名
$PgUser   = 'recon_user'; $PgDb = 'cuberoot_db'
# 四套: (类型, 事件全集). nev=17 仅活跃, nev=21 含废止.
$VARIANTS = @(
  @{ typ='single';  nev=17 }, @{ typ='single';  nev=21 },
  @{ typ='average'; nev=17 }, @{ typ='average'; nev=21 }
)

function Get-DbPassword {
  if ($DbPassword) { return $DbPassword }
  $pw = Join-Path $RepoRoot '.password.md'
  if (-not (Test-Path $pw)) { throw "no -DbPassword and $pw not found" }
  $m = [regex]::Match((Get-Content $pw -Raw), 'recon_user`\s*/\s*`(\d+)')
  if (-not $m.Success) { throw "could not parse recon_user password from .password.md" }
  return $m.Groups[1].Value
}

if (-not (Test-Path $Exe)) { throw "sorcalc not built: $Exe (cargo build --release in .tmp/sor/sorcalc)" }

# ---- 1. sorcalc 预计算 (4 套, 串行, BelowNormal, 留 2 核) ----
if ($DryRun) {
  Write-Host "[dry-run] 现有产物:"
  foreach ($v in $VARIANTS) {
    $f = Join-Path $SorDir "best_$($v.typ)_$($v.nev).tsv"
    if (Test-Path $f) { Write-Host ("  {0,-22} {1,9:N0} 行  {2}" -f (Split-Path $f -Leaf), (Get-Content $f | Measure-Object -Line).Lines, (Get-Item $f).LastWriteTime) }
    else { Write-Host "  $(Split-Path $f -Leaf)  缺" }
  }
  return
}
if (-not $SkipSolve) {
  $env:SORCALC_THREADS = [string]$Threads
  foreach ($v in $VARIANTS) {
    $out = Join-Path $SorDir "best_$($v.typ)_$($v.nev).tsv"
    Write-Host "[$(Get-Date -Format HH:mm:ss)] precompute $($v.typ) nev=$($v.nev) -> $(Split-Path $out -Leaf)"
    $p = Start-Process -FilePath $Exe -ArgumentList @($v.typ,'precompute','21',[string]$v.nev) `
      -WorkingDirectory $SorDir -PassThru -NoNewWindow `
      -RedirectStandardError (Join-Path $SorDir "pc_$($v.typ)_$($v.nev).err")
    try { $p.PriorityClass = 'BelowNormal' } catch {}
    $p.WaitForExit()
    if ($p.ExitCode -ne 0) { throw "sorcalc $($v.typ) nev=$($v.nev) exit=$($p.ExitCode)" }
  }
}

# ---- 2. 拼 sor_player_best.copy.tsv (7 列: wca_id is_avg scope incl_cancelled best_rank combo_count best_events) ----
# 每套 best_*.tsv 4 列: wca_id \t best_rank \t combo_count \t best_events. 在 wca_id 后插入 is_avg/scope/incl_cancelled.
if (Test-Path $CopyTsv) { Remove-Item $CopyTsv -Force }
$sw = [System.IO.StreamWriter]::new($CopyTsv, $false, [System.Text.UTF8Encoding]::new($false))
try {
  foreach ($v in $VARIANTS) {
    $src = Join-Path $SorDir "best_$($v.typ)_$($v.nev).tsv"
    if (-not (Test-Path $src)) { throw "missing $src (跑 -SkipSolve 前需先有全部 4 套)" }
    $isavg = if ($v.typ -eq 'average') { 't' } else { 'f' }
    $incl  = if ($v.nev -eq 21) { 't' } else { 'f' }
    $prefix = "`t$isavg`tworld`t$incl`t"
    $rd = [System.IO.StreamReader]::new($src)
    try {
      while (($line = $rd.ReadLine()) -ne $null) {
        if ($line.Length -eq 0) { continue }
        $tab = $line.IndexOf("`t")
        if ($tab -lt 0) { continue }
        $sw.WriteLine($line.Substring(0, $tab) + $prefix + $line.Substring($tab + 1))
      }
    } finally { $rd.Dispose() }
  }
} finally { $sw.Dispose() }
$rows = (Get-Content $CopyTsv | Measure-Object -Line).Lines
Write-Host "[$(Get-Date -Format HH:mm:ss)] built $(Split-Path $CopyTsv -Leaf): $rows 行 (4 套合并)"
if ($NoPublish) { Write-Host "[no-publish] 停在本地, copy.tsv 已就绪"; return }

# ---- 3. 生成 pb-only 灌库 SQL (幂等 ALTER + 改 PK + TRUNCATE sor_player_best + \copy + ANALYZE; 不碰 sor_census*) ----
@'
\set ON_ERROR_STOP 1
CREATE TABLE IF NOT EXISTS sor_player_best (
  wca_id VARCHAR(20) NOT NULL, is_avg BOOLEAN NOT NULL, scope VARCHAR(8) NOT NULL DEFAULT 'world',
  incl_cancelled BOOLEAN NOT NULL DEFAULT true, best_rank INTEGER NOT NULL,
  combo_count INTEGER NOT NULL DEFAULT 1, best_events TEXT NOT NULL,
  PRIMARY KEY (wca_id, is_avg, scope, incl_cancelled)
);
ALTER TABLE sor_player_best ADD COLUMN IF NOT EXISTS combo_count INTEGER NOT NULL DEFAULT 1;
ALTER TABLE sor_player_best ADD COLUMN IF NOT EXISTS incl_cancelled BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE sor_player_best DROP CONSTRAINT IF EXISTS sor_player_best_pkey;
ALTER TABLE sor_player_best ADD PRIMARY KEY (wca_id, is_avg, scope, incl_cancelled);
TRUNCATE sor_player_best;
\copy sor_player_best (wca_id, is_avg, scope, incl_cancelled, best_rank, combo_count, best_events) FROM '/tmp/sor_player_best.copy.tsv';
ANALYZE sor_player_best;
SELECT incl_cancelled, is_avg, count(*) FROM sor_player_best GROUP BY 1,2 ORDER BY 1,2;
'@ | Set-Content -Path $LoadSql -Encoding utf8

# ---- 4. scp + 灌 prod + 清 nginx api_cache (player-best 走 24h 缓存) ----
$pw = Get-DbPassword
Write-Host "[$(Get-Date -Format HH:mm:ss)] scp -> ${Server}:/tmp/"
& scp $CopyTsv $LoadSql "${Server}:/tmp/"
if ($LASTEXITCODE -ne 0) { throw "scp failed" }
Write-Host "[$(Get-Date -Format HH:mm:ss)] load prod ($PgDb)"
& ssh $Server "PGPASSWORD=$pw psql -U $PgUser -h 127.0.0.1 -d $PgDb -v ON_ERROR_STOP=1 -f /tmp/load_sor_pb.sql"
if ($LASTEXITCODE -ne 0) { throw "prod load failed" }
& ssh $Server 'grep -rl "sum-of-ranks/player-best" /var/cache/nginx/api/ 2>/dev/null | xargs -r rm -f; true'
Write-Host "[$(Get-Date -Format HH:mm:ss)] done — sor_player_best 已刷新, nginx player-best 缓存已清"
