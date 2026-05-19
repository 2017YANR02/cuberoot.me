#!/usr/bin/env pwsh
# 下载自托管字体到 public/fonts/。
# 来源:@fontsource jsDelivr CDN (npm package 镜像)。
# 用法:从 core/packages/client/ 跑 `pwsh tools/fetch-fonts.ps1`
#       或者手动按下表下载,放到 public/fonts/。
#
# 替代 CDN(任意一个能访问就行):
#   https://cdn.jsdelivr.net/npm/<pkg>@5/files/<file>
#   https://unpkg.com/<pkg>@5/files/<file>
#   https://www.unpkg.com/<pkg>@5/files/<file>
#   https://registry.npmmirror.com/<pkg>/-/<pkg>-<ver>.tgz (含全部 files,需解 tar)

$target = Join-Path $PSScriptRoot '..\public\fonts'
New-Item -ItemType Directory -Force $target | Out-Null

$cdns = @(
  'https://cdn.jsdelivr.net/npm',
  'https://unpkg.com'
)

$files = @(
  @{ pkg = '@fontsource/inter'; file = 'inter-latin-300-normal.woff2' },
  @{ pkg = '@fontsource/inter'; file = 'inter-latin-400-normal.woff2' },
  @{ pkg = '@fontsource/inter'; file = 'inter-latin-500-normal.woff2' },
  @{ pkg = '@fontsource/inter'; file = 'inter-latin-600-normal.woff2' },
  @{ pkg = '@fontsource/inter'; file = 'inter-latin-700-normal.woff2' },
  @{ pkg = '@fontsource/jetbrains-mono'; file = 'jetbrains-mono-latin-400-normal.woff2' },
  @{ pkg = '@fontsource/jetbrains-mono'; file = 'jetbrains-mono-latin-500-normal.woff2' },
  @{ pkg = '@fontsource/roboto-mono'; file = 'roboto-mono-latin-400-normal.woff2' },
  @{ pkg = '@fontsource/roboto-mono'; file = 'roboto-mono-latin-500-normal.woff2' },
  @{ pkg = '@fontsource-variable/fraunces'; file = 'fraunces-latin-wght-normal.woff2' }
)

foreach ($f in $files) {
  $out = Join-Path $target $f.file
  if (Test-Path $out) {
    Write-Host "skip $($f.file) (exists)" -ForegroundColor DarkGray
    continue
  }
  $ok = $false
  foreach ($cdn in $cdns) {
    $url = "$cdn/$($f.pkg)@5/files/$($f.file)"
    Write-Host "GET $url" -ForegroundColor DarkCyan
    try {
      Invoke-WebRequest -Uri $url -OutFile $out -TimeoutSec 30
      Write-Host "  -> $out" -ForegroundColor Green
      $ok = $true
      break
    } catch {
      Write-Host "  failed: $($_.Exception.Message)" -ForegroundColor Yellow
    }
  }
  if (-not $ok) {
    Write-Host "FAILED $($f.file) — 手动下载 + 放到 $target\" -ForegroundColor Red
  }
}
