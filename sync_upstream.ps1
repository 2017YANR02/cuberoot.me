<#
.SYNOPSIS
    上游同步的稳定根入口；实现位于 scripts/upstream/sync-all.ps1。
#>
param(
    [ValidateSet('cstimer', 'solver', 'algtrainers', 'blddb', 'recordranks')]
    [string[]]$Only,
    [switch]$SkipPull,
    [switch]$DryRun,
    [string]$RepoRoot = $PSScriptRoot,
    [switch]$ValidateOnly
)

$ErrorActionPreference = 'Stop'
$forward = @{} + $PSBoundParameters
if (-not $PSBoundParameters.ContainsKey('RepoRoot'))
{
    $forward.RepoRoot = $PSScriptRoot
}

& (Join-Path $PSScriptRoot 'scripts/upstream/sync-all.ps1') @forward
