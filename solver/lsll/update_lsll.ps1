# LSLL 最优解 → PG(表 lsll_cases,migration 0094)。
#
# 照 `core/packages/scramble-stats-build/update_cross_stats.ps1` 的 Load-*ToPg 那套:
# 本地照常导出**全量** CSV(本地算力不计成本),灌库时只 UPSERT 内容真变的行 + DELETE 已消失的键
# (复用同一个 `pg_incremental_diff.mjs`,自然键 = 第 1 个逗号字段 = canonical_key)。
# manifest 落在 incremental/,**仅在灌库成功后**才落盘(失败不更新,下次重试)。
# 想强制全量重建:删 incremental/pg_lsll_manifest.tsv 即回退基线路径。
#
# 服务器端密码从它自己的 /root/core-api/.env 读,不把任何凭据写进(进 git 的)本脚本。
#
# 用法:
#   pwsh update_lsll.ps1              # 导出 + 增量灌 **线上** PG
#   pwsh update_lsll.ps1 -Local       # 导出 + 灌**本地** pg13(docker,5433)—— 配 dev:local 预览用
#   pwsh update_lsll.ps1 -ExportOnly  # 只出 CSV,不碰任何库
#   pwsh update_lsll.ps1 -Solve       # 先把 corpus.txt(579,368 个 case)跑完,再导出 + 灌
#
# 覆盖率分母恒为 corpus.txt 的 579,368。求解中途也能随时单跑导出 + 灌,
# 没算到的 case 页面显示「计算中」。
[CmdletBinding()]
param(
  [switch]$Solve,
  [switch]$Local,
  [switch]$ExportOnly
)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8   # 中文进度别在重定向时变乱码
$Root      = $PSScriptRoot
$RepoRoot  = Resolve-Path (Join-Path $Root '..' '..')
$IncrDir   = Join-Path $Root 'incremental'
$Csv       = Join-Path $Root 'lsll_cases.csv'
# manifest 记的是「**这个库**已经有哪些行」,所以必须按目标库分开存:同一份 manifest 复用到
# 两个库,会让先灌过本地的那批在灌线上时被当成「无变化」跳过,线上永远缺那几行(踩过)。
$ManifestName = if($Local){ 'pg_lsll_manifest_local.tsv' } else { 'pg_lsll_manifest.tsv' }
$Manifest  = Join-Path $IncrDir $ManifestName
$DiffTool  = Join-Path $RepoRoot 'core/packages/scramble-stats-build/pg_incremental_diff.mjs'
$RemoteHost = 'cuberoot'
New-Item -ItemType Directory -Force $IncrDir | Out-Null

function Step($m){ Write-Host "`n=== $m ===" -ForegroundColor Cyan }

if($Solve){
  if(-not (Test-Path (Join-Path $Root 'corpus.txt'))){
    throw "corpus.txt 不存在 —— 先生成语料:cd core; NODE_OPTIONS=--no-experimental-strip-types pnpm --filter @cuberoot/client exec tsx scripts/lsll-corpus.mts"
  }
  Step '求解 corpus.txt(solve_loop.mjs,按 key 续跑)'
  & node (Join-Path $Root 'solve_loop.mjs')
  if($LASTEXITCODE -ne 0){ throw "solve_loop.mjs 退出 $LASTEXITCODE" }
}

Step '导出 CSV'
& node (Join-Path $Root 'export_cases.mjs') --out $Csv
if($LASTEXITCODE -ne 0){ throw 'export_cases.mjs 失败' }
if($ExportOnly){ Write-Host "`n-ExportOnly:到此为止,没碰库。" -ForegroundColor Yellow; return }

# ---- 行级增量 diff ----
Step '算增量'
$manifestExisted = Test-Path $Manifest
$delta   = Join-Path $env:TEMP 'lsll_delta.csv'
$deleted = Join-Path $env:TEMP 'lsll_deleted.txt'
$newMan  = "$Manifest.new"
$json = & node $DiffTool --csv $Csv --manifest $Manifest --key-cols 1 --header `
  --out-delta $delta --out-deleted $deleted --out-manifest $newMan
if($LASTEXITCODE -ne 0){ throw 'pg_incremental_diff 失败' }
$st = ($json | Select-Object -Last 1 | ConvertFrom-Json)
$rows = (Get-Content $Csv | Measure-Object -Line).Lines - 1

if($manifestExisted -and $st.deltaRows -eq 0 -and $st.deleted -eq 0){
  Write-Host "  无变化,跳过灌库(manifest 命中全量 $rows 行)" -ForegroundColor DarkGray
  Move-Item -Force $newMan $Manifest
  Remove-Item $delta,$deleted -Force -EA SilentlyContinue
  return
}

# 有 manifest → 只灌 delta;没有(首次)→ 灌全量 CSV 建基线。两条路都是 UPSERT,幂等可重跑。
$src = if($manifestExisted){ $delta } else { $Csv }
$what = if($manifestExisted){ "增量 UPSERT $($st.deltaRows) 行 + DELETE $($st.deleted) 键(全量 $rows)" }
        else { "基线全量 UPSERT $rows 行" }

$sqlBody = @'
\set ON_ERROR_STOP on
BEGIN;
CREATE TEMP TABLE _lsll_stage (LIKE lsll_cases) ON COMMIT DROP;
ALTER TABLE _lsll_stage DROP COLUMN stm, DROP COLUMN mcc_order, DROP COLUMN updated_at;
\copy _lsll_stage (canonical_key,htm,qtm,exhaustive,optimal_algs) FROM '__SRC__' WITH (FORMAT csv, HEADER true)
INSERT INTO lsll_cases AS t (canonical_key,htm,qtm,exhaustive,optimal_algs)
  SELECT canonical_key,htm,qtm,exhaustive,optimal_algs FROM _lsll_stage
  ON CONFLICT (canonical_key) DO UPDATE
    SET htm=EXCLUDED.htm, qtm=EXCLUDED.qtm, exhaustive=EXCLUDED.exhaustive,
        optimal_algs=EXCLUDED.optimal_algs, updated_at=now();
__DELETE__
COMMIT;
SELECT count(*) AS lsll_cases_total, count(*) FILTER (WHERE exhaustive) AS exhaustive_rows FROM lsll_cases;
'@

if($Local){
  Step "灌本地 pg13 · $what"
  # 本机没装 psql 客户端,一律走容器内的(同 scripts/seed-local.ps1)。所以 CSV 先 docker cp 进去,
  # `\copy` 的路径是**容器内**路径。表没建就先把 migration 0094 灌进去(幂等 IF NOT EXISTS)。
  docker cp (Join-Path $RepoRoot 'core/packages/server/migrations/0094_lsll_cases.sql') pg13:/tmp/0094.sql | Out-Null
  docker exec pg13 psql -U postgres -d cuberoot_db -v ON_ERROR_STOP=1 -q -f /tmp/0094.sql
  if($LASTEXITCODE -ne 0){ throw '本地建表失败(pg13 起了吗?)' }
  docker cp $src pg13:/tmp/lsll_src.csv | Out-Null
  $sql = $sqlBody.Replace('__SRC__', '/tmp/lsll_src.csv').Replace('__DELETE__', '')
  $localSql = Join-Path $env:TEMP 'lsll_load_local.sql'
  [IO.File]::WriteAllText($localSql, ($sql -replace "`r`n","`n"), [Text.UTF8Encoding]::new($false))
  docker cp $localSql pg13:/tmp/lsll_load.sql | Out-Null
  docker exec pg13 psql -U postgres -d cuberoot_db -v ON_ERROR_STOP=1 -f /tmp/lsll_load.sql
  if($LASTEXITCODE -ne 0){ throw '本地灌库失败' }
  docker exec pg13 rm -f /tmp/lsll_src.csv /tmp/lsll_load.sql /tmp/0094.sql
  Remove-Item $localSql -Force -EA SilentlyContinue
} else {
  Step "灌线上 PG · $what"
  $pwExpr = '$(grep -oP ''DB_PASS=\K.*'' /root/core-api/.env | tr -d ''[:space:]'')'
  $remoteSrc = '/root/_lsll_src.csv'; $remoteDel = '/root/_lsll_del.csv'; $remoteSql = '/root/_lsll.sql'
  $delSql = if($manifestExisted -and $st.deleted -gt 0){ @"
CREATE TEMP TABLE _lsll_del (canonical_key varchar(12)) ON COMMIT DROP;
\copy _lsll_del FROM '$remoteDel' WITH (FORMAT csv)
DELETE FROM lsll_cases t USING _lsll_del d WHERE t.canonical_key = d.canonical_key;
"@ } else { '' }
  $sql = $sqlBody.Replace('__SRC__', $remoteSrc).Replace('__DELETE__', $delSql)
  $localSql = Join-Path $env:TEMP 'lsll_load.sql'
  [IO.File]::WriteAllText($localSql, ($sql -replace "`r`n","`n"), [Text.UTF8Encoding]::new($false))

  scp $src "${RemoteHost}:$remoteSrc"; if($LASTEXITCODE -ne 0){ throw 'CSV scp 失败' }
  $rmList = "$remoteSrc $remoteSql"
  if($delSql){ scp $deleted "${RemoteHost}:$remoteDel"; if($LASTEXITCODE -ne 0){ throw 'deleted scp 失败' }; $rmList += " $remoteDel" }
  scp $localSql "${RemoteHost}:$remoteSql"; if($LASTEXITCODE -ne 0){ throw 'SQL scp 失败' }
  ssh $RemoteHost "PGPASSWORD=$pwExpr psql -U recon_user -h 127.0.0.1 -d cuberoot_db -v ON_ERROR_STOP=1 -f $remoteSql; rc=`$?; rm -f $rmList; exit `$rc"
  if($LASTEXITCODE -ne 0){ throw '线上灌库失败' }
  Remove-Item $localSql -Force -EA SilentlyContinue
}

Move-Item -Force $newMan $Manifest
Remove-Item $delta,$deleted -Force -EA SilentlyContinue
Write-Host "`n完成(manifest 已更新,全量 $rows 行)。" -ForegroundColor Green
