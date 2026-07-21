#!/usr/bin/env pwsh
# Seed the local pg13 docker (127.0.0.1:5433 / cuberoot_db) with the current PROD
# alg data (alg_sets + alg_cases, schema + rows) so `dev:local` + LOCAL_ALG=1 serves
# real alg data locally for edit-before-push. Re-runnable: pg_dump --clean --if-exists
# drops + recreates the two alg tables each run. The prod pull is READ-ONLY (pg_dump).
#
# Prod DB password: $env:PROD_PG_PASS if set, else parsed from the repo-root
# .password.md (gitignored). Nothing secret is committed in this script.
$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path "$PSScriptRoot/../../../..").Path
$pw = $env:PROD_PG_PASS
if (-not $pw) {
  $line = Select-String -Path "$repoRoot/.password.md" -Pattern 'recon_user.{0,10}?(\d{5,})' | Select-Object -First 1
  if ($line) { $pw = $line.Matches[0].Groups[1].Value }
}
if (-not $pw) { throw "prod PG password not found. Set `$env:PROD_PG_PASS or add it to .password.md" }

Write-Host "Pulling alg_sets + alg_cases from prod (cuberoot_db) -> pg13/cuberoot_db ..." -ForegroundColor Green
# pg_dump on prod (read-only) -> pipe straight into the local pg13 container's psql.
ssh root@cuberoot "PGPASSWORD=$pw pg_dump -U recon_user -h 127.0.0.1 -d cuberoot_db --clean --if-exists --no-owner --no-privileges -t alg_sets -t alg_cases" |
  docker exec -i pg13 psql -U postgres -d cuberoot_db -v ON_ERROR_STOP=1 -q

Write-Host "Done. Row counts in pg13:" -ForegroundColor Green
docker exec pg13 psql -U postgres -d cuberoot_db -tAc "select 'alg_sets='||count(*) from alg_sets; select 'alg_cases='||count(*) from alg_cases;"
