#!/usr/bin/env pwsh
# verify.ps1 — 跑全部 analyzer × 测试输入,计时 + 对照 golden(bit-exact)。
#
# 用法:
#   pwsh verify.ps1                       # 跑 scramble_5 + scramble_100,diff golden
#   pwsh verify.ps1 -Generate             # 把当前输出写成 golden(建/更新基线)
#   pwsh verify.ps1 -Inputs scramble_5.txt
#   pwsh verify.ps1 -TableDir D:\my-tables
#
# 表:默认用 ./tables(需含 huge 表:pt_cross_C4C5E0E1/C4C6E0E2 各 10GB + mt_edge6 3GB)。
# golden:testdata/golden/<input_base>_<suffix>.csv,= 受信任的本程序输出(上游只给前 20 行,
# 余下由本程序产出 —— 已在前 20 行对齐 C++ golden bit-exact)。

[CmdletBinding()]
param(
  [switch]$Generate,
  [string[]]$Inputs = @("scramble_5.txt", "scramble_100.txt"),
  [string]$TableDir
)
$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
if (-not $TableDir) { $TableDir = Join-Path $root "tables" }
$rel  = Join-Path $root "target\release"
$gold = Join-Path $root "testdata\golden"
$work = Join-Path $root "target\verify-work"
New-Item -ItemType Directory -Force -Path $work, $gold | Out-Null

if (-not (Test-Path (Join-Path $TableDir "pt_cross_C4C5E0E1.bin"))) {
  Write-Host "[WARN] $TableDir 缺 huge 表;huge analyzer 会现场生成(慢/占盘)。" -ForegroundColor Yellow
}

$cases = @(
  @{ name = "std";         bin = "std_analyzer.exe";         suffix = "_std";         env = @{ CUBE_RUN_FULL_STD = "1"; CUBE_ALLOW_HUGE_TABLES = "1" } },
  @{ name = "pseudo";      bin = "pseudo_analyzer.exe";      suffix = "_pseudo";      env = @{ CUBE_ALLOW_HUGE_TABLES = "1" } },
  @{ name = "pair";        bin = "pair_analyzer.exe";        suffix = "_pair";        env = @{ CUBE_ALLOW_HUGE_TABLES = "1" } },
  @{ name = "eo";          bin = "eo_cross_analyzer.exe";    suffix = "_eo";          env = @{ CUBE_ALLOW_HUGE_TABLES = "1" } },
  @{ name = "pseudo_pair"; bin = "pseudo_pair_analyzer.exe"; suffix = "_pseudo_pair"; env = @{ CUBE_ALLOW_HUGE_TABLES = "1" } }
)
$clearEnv = @("CUBE_RUN_FULL_STD", "CUBE_ALLOW_HUGE_TABLES", "CUBE_PSEUDO_SKIP_XCROSS",
  "CUBE_PSEUDO_SKIP_XXCROSS", "CUBE_PSEUDO_SKIP_XXXCROSS", "CUBE_PAIR_NO_DIAG", "CUBE_EO_NO_DIAG")

$results = @()
foreach ($inp in $Inputs) {
  $src = Join-Path $root "testdata\$inp"
  if (-not (Test-Path $src)) { Write-Host "[SKIP] missing $inp"; continue }
  $base = [IO.Path]::GetFileNameWithoutExtension($inp)
  Copy-Item $src (Join-Path $work $inp) -Force
  foreach ($c in $cases) {
    foreach ($k in $clearEnv) { if (Test-Path "Env:$k") { Remove-Item "Env:$k" } }
    $env:CUBE_TABLE_DIR = $TableDir
    foreach ($k in $c.env.Keys) { Set-Item "Env:$k" $c.env[$k] }
    $exe = Join-Path $rel $c.bin
    $out = Join-Path $work "$base$($c.suffix).csv"
    if (Test-Path $out) { Remove-Item $out }
    $t = Measure-Command {
      Push-Location $work
      try { "$inp`nexit" | & $exe | Out-Null } finally { Pop-Location }
    }
    $secs = [math]::Round($t.TotalSeconds, 2)
    $goldFile = Join-Path $gold "$base$($c.suffix).csv"
    $rows = if (Test-Path $out) { (Get-Content $out).Count } else { 0 }
    if ($Generate) {
      Copy-Item $out $goldFile -Force
      $status = "GEN"
    }
    elseif (-not (Test-Path $goldFile)) { $status = "NO-GOLDEN" }
    else {
      $a = (Get-Content $out -Raw) -replace "`r", ""
      $b = (Get-Content $goldFile -Raw) -replace "`r", ""
      $status = if ($a -eq $b) { "OK" } else { "FAIL" }
    }
    Write-Host ("{0,-12} {1,-16} {2,8}s  rows={3,-5} {4}" -f $c.name, $inp, $secs, $rows, $status)
    $results += [pscustomobject]@{ analyzer = $c.name; input = $inp; seconds = $secs; rows = $rows; status = $status }
  }
}

Write-Host "`n=== summary ==="
$results | Format-Table -AutoSize
$fails = @($results | Where-Object { $_.status -eq "FAIL" }).Count
if ($fails -gt 0) { Write-Host "FAILED: $fails" -ForegroundColor Red; exit 1 }
Write-Host "all good ($($results.Count) runs)" -ForegroundColor Green
