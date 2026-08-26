[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

if ($PSVersionTable.PSVersion.Major -lt 7) {
    throw '请使用 pwsh 7 运行此脚本。'
}

$threads = 14
$memoryFloorGiB = 1.25
$expectedBytes = 7_782_727_680L
$scriptDir = $PSScriptRoot
$repoRoot = [IO.Path]::GetFullPath((Join-Path $scriptDir '..\..'))
$modulePath = Join-Path $repoRoot 'core\packages\client\public\cubeopt\cube48opt8.mjs'
$wasmPath = Join-Path $repoRoot 'core\packages\client\public\cubeopt\cube48opt8.wasm'
$generatorPath = Join-Path $scriptDir 'gen-table.mjs'
$outputDir = Join-Path $repoRoot 'solver\tables\h48'
$tablePath = Join-Path $outputDir 'h48prun31h8.dat'

foreach ($requiredPath in @($modulePath, $wasmPath, $generatorPath)) {
    if (-not (Test-Path -LiteralPath $requiredPath -PathType Leaf)) {
        throw "缺少必需文件: $requiredPath"
    }
}

if (Test-Path -LiteralPath $tablePath -PathType Leaf) {
    $existingBytes = (Get-Item -LiteralPath $tablePath).Length
    if ($existingBytes -eq $expectedBytes) {
        Write-Host "opt8 表已存在且大小正确: $tablePath"
        exit 0
    }
    Write-Warning "现有表大小不正确($existingBytes bytes)，生成成功后会覆盖它。"
}

$nodePath = (Get-Command node -CommandType Application -ErrorAction Stop).Source
$freeGiB = (Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory / 1MB
$minimumStartGiB = ($expectedBytes / 1GB) + $memoryFloorGiB
Write-Host ('可用内存: {0:N2} GiB；启动下限: {1:N2} GiB；运行中止线: {2:N2} GiB' -f $freeGiB, $minimumStartGiB, $memoryFloorGiB)
if ($freeGiB -lt $minimumStartGiB) {
    throw '当前可用内存不足。请关闭占用内存的程序后重试。'
}

New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

$oldThreads = [Environment]::GetEnvironmentVariable('THREADS', 'Process')
$oldModule = [Environment]::GetEnvironmentVariable('MODULE', 'Process')
$oldOut = [Environment]::GetEnvironmentVariable('OUT', 'Process')
$generatorProcess = $null

try {
    $env:THREADS = [string]$threads
    $env:MODULE = $modulePath
    $env:OUT = $outputDir

    $generatorProcess = Start-Process `
        -FilePath $nodePath `
        -ArgumentList $generatorPath `
        -WorkingDirectory $repoRoot `
        -PassThru `
        -NoNewWindow
    $generatorProcess.PriorityClass = [Diagnostics.ProcessPriorityClass]::BelowNormal

    Write-Host "opt8 建表已启动：PID $($generatorProcess.Id)，$threads 线程，低优先级。"
    $lastReport = [DateTime]::MinValue

    while (-not $generatorProcess.HasExited) {
        Start-Sleep -Seconds 5
        $generatorProcess.Refresh()

        $freeGiB = (Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory / 1MB
        if ($freeGiB -lt $memoryFloorGiB) {
            Stop-Process -Id $generatorProcess.Id -Force -ErrorAction SilentlyContinue
            throw ('可用内存降到 {0:N2} GiB，低于 {1:N2} GiB 自动中止线，已停止建表。' -f $freeGiB, $memoryFloorGiB)
        }

        if (((Get-Date) - $lastReport).TotalSeconds -ge 30) {
            $rssGiB = if ($generatorProcess.HasExited) { 0 } else { $generatorProcess.WorkingSet64 / 1GB }
            $elapsed = (Get-Date) - $generatorProcess.StartTime
            Write-Host ('监控：已运行 {0:hh\:mm\:ss}，可用 {1:N2} GiB，进程 RSS {2:N2} GiB' -f $elapsed, $freeGiB, $rssGiB)
            $lastReport = Get-Date
        }
    }

    $generatorProcess.WaitForExit()
    if ($generatorProcess.ExitCode -ne 0) {
        throw "建表进程退出码: $($generatorProcess.ExitCode)"
    }

    $finalBytes = (Get-Item -LiteralPath $tablePath).Length
    if ($finalBytes -ne $expectedBytes) {
        throw "表大小不正确: $finalBytes bytes；预期 $expectedBytes bytes。"
    }

    Write-Host "opt8 表生成完成: $tablePath"
    Write-Host "大小: $finalBytes bytes"
}
finally {
    if ($null -ne $generatorProcess -and -not $generatorProcess.HasExited) {
        Stop-Process -Id $generatorProcess.Id -Force -ErrorAction SilentlyContinue
    }
    [Environment]::SetEnvironmentVariable('THREADS', $oldThreads, 'Process')
    [Environment]::SetEnvironmentVariable('MODULE', $oldModule, 'Process')
    [Environment]::SetEnvironmentVariable('OUT', $oldOut, 'Process')
}
