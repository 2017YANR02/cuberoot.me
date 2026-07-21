#!/usr/bin/env pwsh
# Run the Hono API locally against the pg13 docker (127.0.0.1:5433 / cuberoot_db)
# on :3001, for LOCAL_ALG=1 frontend dev. Seed alg data first: seed-local-alg.ps1.
#
# Only /v1/alg/* is proxied to this server in dev (client next.config, gated by
# LOCAL_ALG=1); every other endpoint still hits prod, so this DB only needs the
# alg tables. pg13 host password is the container's POSTGRES_PASSWORD (`dev`).
$ErrorActionPreference = 'Stop'

$env:DB_HOST    = '127.0.0.1'
$env:DB_PORT    = '5433'
$env:DB_USER    = 'postgres'
$env:DB_PASS    = 'dev'
$env:DB_NAME    = 'cuberoot_db'
$env:PORT       = '3001'
$env:JWT_SECRET = 'dev-secret-local-only'

Set-Location "$PSScriptRoot/.."
Write-Host "Hono API -> pg13 (127.0.0.1:5433/cuberoot_db) on http://127.0.0.1:3001" -ForegroundColor Green
Write-Host "Frontend: set `$env:LOCAL_ALG='1' before `pnpm --filter @cuberoot/client dev` to route /v1/alg here." -ForegroundColor Cyan
pnpm exec tsx watch src/index.ts
