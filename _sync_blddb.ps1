<#
.SYNOPSIS
    BLDDB 旧根路径兼容入口；实现位于 scripts/upstream/sync-blddb.ps1。
#>
param(
    [string]$BlddbDir = 'D:\cube\blddb',
    [string]$ProjectDir = $PSScriptRoot,
    [switch]$SkipPull,
    [switch]$SkipInstall,
    [string]$RepoRoot,
    [switch]$ValidateOnly
)

$ErrorActionPreference = 'Stop'
$forward = @{} + $PSBoundParameters
$forward.RepoRoot = if ($PSBoundParameters.ContainsKey('RepoRoot')) { $RepoRoot } else { $ProjectDir }

& (Join-Path $PSScriptRoot 'scripts/upstream/sync-blddb.ps1') @forward
