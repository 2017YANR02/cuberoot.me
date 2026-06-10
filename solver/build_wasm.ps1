#!/usr/bin/env pwsh
# build_wasm.ps1 — 把 cross 求解器(小表 cascade)编成浏览器 WASM。
#
# 产物落 pkg-web/:
#   cross_solver.js / cross_solver_bg.wasm  —— wasm-bindgen 胶水 + 二进制(~48KB)
#   cross-solver-worker.js / cross-solver-client.js —— 模块 worker + 主线程封装
#   tables/*.bin.gz —— 6 张表 gzip(~27MB,运行时 fetch + DecompressionStream 解压)
#
# 前置:
#   rustup target add wasm32-unknown-unknown
#   cargo install wasm-bindgen-cli --version 0.2.122   (CLI 必须与 Cargo.toml 的 wasm-bindgen 版本精确匹配)
#
# 注意:
#   - .cargo/config.toml 已把 target-cpu=native 限定到 non-wasm,别让它泄漏到 wasm。
#   - rustc >=1.82 默认给 wasm 开 reference-types;wasm-bindgen CLI 必须够新(0.2.122 已验)。
$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$out = Join-Path $root "pkg-web"
$wasm = Join-Path $root "target\wasm32-unknown-unknown\release\cube_solver.wasm"
Push-Location $root   # cargo 需在 crate 根跑(且读 .cargo/config.toml)

try {
Write-Host "[1/4] cargo build wasm32 (release)..." -ForegroundColor Cyan
cargo build --lib --release --target wasm32-unknown-unknown

Write-Host "[2/4] wasm-bindgen (target web)..." -ForegroundColor Cyan
Remove-Item -Recurse -Force (Join-Path $out "cross_solver*") -ErrorAction SilentlyContinue
wasm-bindgen $wasm --out-dir $out --target web --out-name cross_solver

Write-Host "[3/4] gzip tables..." -ForegroundColor Cyan
$tdir = Join-Path $out "tables"
New-Item -ItemType Directory -Force -Path $tdir | Out-Null
$names = @("pt_cross", "pt_cross_C4E0", "mt_edge2", "mt_edge3", "mt_edge4", "mt_corn", "mt_edge", "pt_cross_ins_C4", "pt_pair_C4E0", "pt_ep4eo12", "mt_eo12", "mt_eo12_alt", "mt_ep4", "pt_pscross")
foreach ($n in $names) {
  $src = Join-Path $root "tables\$n.bin"
  $dst = Join-Path $tdir "$n.bin.gz"
  $in = [IO.File]::OpenRead($src)
  $outfs = [IO.File]::Create($dst)
  $gz = New-Object IO.Compression.GZipStream($outfs, [IO.Compression.CompressionLevel]::Optimal)
  $in.CopyTo($gz); $gz.Close(); $outfs.Close(); $in.Close()
}

Write-Host "[4/4] done. pkg-web/ ready." -ForegroundColor Green
Get-ChildItem $out -Recurse -File | ForEach-Object {
  "{0,12:N0}  {1}" -f $_.Length, $_.FullName.Substring($out.Length + 1)
}
} finally { Pop-Location }
