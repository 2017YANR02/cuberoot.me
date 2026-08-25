#!/usr/bin/env pwsh
# Seed the local pg13 docker (127.0.0.1:5433 / cuberoot_db) with the current PROD
# copy of the given tables (schema + rows) so `dev:local` + LOCAL_DOMAINS serves real
# data locally for edit-before-push. Re-runnable: pg_dump --clean --if-exists drops +
# recreates each named table every run. The prod pull is READ-ONLY (pg_dump).
#
# Usage:  pwsh -File seed-local.ps1 <table> [<table> ...]
#   e.g.  pwsh -File seed-local.ps1 alg_sets alg_cases        # the alg domain
#         pwsh -File seed-local.ps1 wiki_terms                 # the wiki domain
# Pass EVERY table the domain's queries read (a domain that JOINs N tables needs all N).
#
# Prod DB password: $env:PROD_PG_PASS if set, else parsed from the repo-root
# .password.md (gitignored). Nothing secret is committed in this script.
param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Tables)
$ErrorActionPreference = 'Stop'

if (-not $Tables -or $Tables.Count -eq 0) {
  throw "no tables given. Usage: pwsh -File seed-local.ps1 <table> [<table> ...]  (e.g. alg_sets alg_cases)"
}
# only [a-z0-9_] table names — these get interpolated into a remote shell command.
# -cnotmatch = case-SENSITIVE (PowerShell -match defaults to case-insensitive, which
# would leak uppercase); pg identifiers are lowercase anyway.
foreach ($t in $Tables) {
  if ($t -cnotmatch '^[a-z0-9_]+$') { throw "invalid table name '$t' (expected [a-z0-9_])" }
}
$tFlags = ($Tables | ForEach-Object { "-t $_" }) -join ' '

$repoRoot = (Resolve-Path "$PSScriptRoot/../../../..").Path
$pw = $env:PROD_PG_PASS
if (-not $pw) {
  $line = Select-String -Path "$repoRoot/.password.md" -Pattern 'recon_user.{0,10}?(\d{5,})' | Select-Object -First 1
  if ($line) { $pw = $line.Matches[0].Groups[1].Value }
}
if (-not $pw) { throw "prod PG password not found. Set `$env:PROD_PG_PASS or add it to .password.md" }

Write-Host "Pulling $($Tables -join ', ') from prod (cuberoot_db) -> pg13/cuberoot_db ..." -ForegroundColor Green
# pg_dump on prod (read-only) -> pipe straight into the local pg13 container's psql.
ssh root@cuberoot "PGPASSWORD=$pw pg_dump -U recon_user -h 127.0.0.1 -d cuberoot_db --clean --if-exists --no-owner --no-privileges $tFlags" |
  docker exec -i pg13 psql -U postgres -d cuberoot_db -v ON_ERROR_STOP=1 -q

Write-Host "Done. Row counts in pg13:" -ForegroundColor Green
foreach ($t in $Tables) {
  docker exec pg13 psql -U postgres -d cuberoot_db -tAc "select '$t='||count(*) from $t;"
}
