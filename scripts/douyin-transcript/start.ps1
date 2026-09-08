param([string]$Url)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw '请先安装 Node.js 22 或更新的 LTS 版本：https://nodejs.org/en/download/' }
$entry = Join-Path $PSScriptRoot 'start.mjs'
if ($Url) { & node $entry $Url } else { & node $entry }
exit $LASTEXITCODE
